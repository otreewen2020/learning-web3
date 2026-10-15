/* Lab DeFi 实验站前端
 * 架构：浏览器内用 ethers.js 本地签名（私钥不出浏览器），
 *       经 /rpc 代理转发到 Besu（绕过 CORS + 固定 gasPrice）
 *
 * 本环境踩坑（详见 README）：
 *  1) Besu 对参数校验失败的回吐误导性错误 "Invalid block, unable to parse RLP"
 *     → rpc() 统一递增间隔重试兜底；
 *  2) ethers UMD 构建缺 ContractFactory.getCreateCall 等 API、provider 轮询器坏 →
 *     完全绕开 provider 交易流水线：手工 ABI 编码 + signTransaction + eth_sendRawTransaction。
 */
const CHAIN_ID = 1337;
const KEY = "lab.tokens";   // localStorage: 已发行代币登记簿
const TXKEY = "lab.txhist"; // localStorage: 交易记录
const WKKEY = "lab.wallet"; // localStorage: 上次使用的私钥
const NFTKEY = "lab.nfts";        // localStorage: 我的藏品
const NFTADDR = "lab.nft.contract"; // localStorage: NFT 合约地址

let wallet, RPC_ABS, factoryData;
const $ = (id) => document.getElementById(id);

// ── RPC：显式数组传参 + 递增间隔重试 ──────────────────
async function rpc(method, paramsArr) {
  const delays = [0, 500, 2000, 5000, 5000];
  let lastErr = null;
  const payload = JSON.stringify(
    paramsArr && paramsArr.length
      ? { jsonrpc: "2.0", id: 1, method, params: paramsArr }
      : { jsonrpc: "2.0", id: 1, method });
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt]) await new Promise((r) => setTimeout(r, delays[attempt]));
    try {
      const res = await fetch(RPC_ABS, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      const j = await res.json();
      if (j && j.result !== undefined) return j.result;
      if (j && j.error) lastErr = new Error(j.error.message || JSON.stringify(j.error));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("RPC 请求失败");
}

// 轻量单次 RPC（不重试），用于轮询
async function rpcOnce(method, ...params) {
  const res = await fetch(RPC_ABS, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
  return j.result;
}

async function waitReceipt(txHash, timeoutSec = 120) {
  const t0 = Date.now();
  while ((Date.now() - t0) / 1000 < timeoutSec) {
    let rc = null;
    try {
      rc = await rpcOnce("eth_getTransactionReceipt", txHash);
    } catch {
      rc = null;
    }
    if (rc) return rc;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("等待回执超时");
}

// 本地签名 + 直接广播的交易发送器（不经 ethers 事务流水线）
// signer 可传任意 ethers.Wallet（预言机数据源用各自私钥报价）；默认用全局钱包
async function sendSigned(txFields, signer = wallet) {
  const nonce = await rpc("eth_getTransactionCount", [signer.address, "latest"]);
  const gasPrice = BigInt(txFields.gasPrice ?? "1000000000");
  const value = txFields.value ?? 0n;
  // 发送前预检：余额必须覆盖 gas 开销 + 转账金额，
  // 否则 Besu 只会回一句难懂的 "Upfront cost exceeds account balance"
  const balWei = BigInt(await rpc("eth_getBalance", [signer.address, "latest"]));
  const cost = BigInt(txFields.gasLimit) * gasPrice + value;
  if (balWei < cost) {
    throw new Error(
      `当前账户 ${signer.address.slice(0, 10)}… 余额不足：` +
      `现有 ${window.ethers.formatEther(balWei)} ETH，` +
      `本次约需 ${window.ethers.formatEther(cost)} ETH（gas${value > 0n ? " + 转账金额" : ""}）。` +
      `请点"使用开发账户"切换，或先给当前账户转入 ETH`);
  }
  const tx = {
    type: 2,
    chainId: CHAIN_ID,
    nonce: Number(BigInt(nonce)),
    maxPriorityFeePerGas: 0n,
    maxFeePerGas: gasPrice,
    gasLimit: txFields.gasLimit,
    to: txFields.to ?? null,
    data: txFields.data ?? "0x",
    value,
  };
  const signed = await signer.signTransaction(tx);
  const hash = await rpc("eth_sendRawTransaction", [signed]);
  return hash;
}

function log(msg, cls = "") {
  const el = $("log");
  if (el.textContent === "等待操作…") el.textContent = "";
  const line = document.createElement("div");
  if (cls) line.className = cls;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

// ── 交易记录 ──────────────────────────────────────────
function txList() { return JSON.parse(localStorage.getItem(TXKEY) || "[]"); }

function recordTx(hash, desc) {
  const l = txList();
  l.unshift({ hash, desc, time: new Date().toLocaleTimeString(), status: "⏳ 等待出块" });
  localStorage.setItem(TXKEY, JSON.stringify(l.slice(0, 20)));
  renderTxs();
}

function settleTx(hash, ok, block) {
  const l = txList();
  const e = l.find((x) => x.hash === hash);
  if (e) {
    e.status = ok ? `✅ 区块 ${block}` : "❌ 失败";
    localStorage.setItem(TXKEY, JSON.stringify(l));
    renderTxs();
  }
}

function renderTxs() {
  const l = txList();
  const box = $("txs");
  if (!l.length) { box.innerHTML = '<div class="hint">暂无交易记录</div>'; return; }
  box.innerHTML = "";
  for (const t of l) {
    const d = document.createElement("div");
    d.className = "tx";
    d.innerHTML = `<div>${t.status}<br><b>${t.desc}</b><br>
      <small>${t.hash.slice(0, 26)}… · ${t.time}</small></div>
      <a data-h="${t.hash}">复制hash</a>`;
    box.appendChild(d);
  }
  box.querySelectorAll("a").forEach((a) =>
    a.onclick = () => { navigator.clipboard.writeText(a.dataset.h); log("交易hash已复制"); });
}

// ── 账户（钱包）───────────────────────────────────────
function setWallet(pk) {
  wallet = new window.ethers.Wallet(pk.replace(/^(?!0x)/, "0x"));
  localStorage.setItem(WKKEY, wallet.privateKey);
  $("addr").value = wallet.address;
  $("priv").value = "";
  $("tr-from").textContent = "转出账户：" + wallet.address;
  $("nft-from").textContent = "转出账户：" + wallet.address;
  $("stake-from").textContent = "操作账户：" + wallet.address;
  $("dex-from").textContent = "操作账户：" + wallet.address;
  $("lend-from").textContent = "操作账户：" + wallet.address;
  $("orc-from").textContent = "操作账户（管理员）：" + wallet.address;
  $("lg-from").textContent = "操作账户：" + wallet.address;
  $("gv-from").textContent = "操作账户：" + wallet.address;
  refreshBalance();
  renderTxs();
  log(`账户就绪: ${wallet.address}`, "ok");
}

async function refreshBalance() {
  if (!wallet) return;
  try {
    const wei = await rpc("eth_getBalance", [wallet.address, "latest"]);
    $("bal").value = window.ethers.formatEther(wei) + " ETH";
  } catch {}
}

// 查询任意地址余额（原生 ETH + 自动扫描 ERC-20 代币）
async function queryBalance() {
  const addr = ($("q-addr").value || "").trim();
  if (!window.ethers.isAddress(addr)) return log("请输入有效地址（0x…）", "err");
  try {
    const wei = await rpc("eth_getBalance", [addr, "latest"]);
    $("q-bal").value = window.ethers.formatEther(wei) + " ETH";
    log("余额查询 " + addr.slice(0, 10) + "…：" + window.ethers.formatEther(wei) + " ETH");
  } catch (e) { log("查询失败: " + e.message, "err"); return; }
  queryTokenBalances(addr); // 异步补查代币余额，不阻塞 ETH 结果
}

// 扫描某地址的 ERC-20 余额：本浏览器登记簿代币 + 最近 4096 块 Transfer 事件发现的代币
async function queryTokenBalances(addr) {
  const box = $("q-tokens");
  if (!box) return;
  const pad = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const enc = window.ethers.AbiCoder.defaultAbiCoder();
  const dec = (arr, hex) => { try { return enc.decode(arr, hex)[0]; } catch { return null; } };
  box.innerHTML = '<div class="hint">正在扫描该地址的代币余额…</div>';
  try {
    // 1) 候选代币 = 登记簿 + 链上日志扫描（转出/转入双向）
    const cand = new Map();
    JSON.parse(localStorage.getItem(KEY) || "[]").forEach((t) =>
      cand.set(t.address.toLowerCase(), { name: t.name, symbol: t.symbol }));
    try {
      const latest = parseInt(await rpc("eth_blockNumber"), 16);
      const fromBlock = "0x" + Math.max(0, latest - 4095).toString(16);
      const topic = pad(addr);
      const sig = window.ethers.id("Transfer(address,address,uint256)");
      const [sent, got] = await Promise.all([
        rpc("eth_getLogs", [{ fromBlock, toBlock: "latest", topics: [sig, topic] }]),
        rpc("eth_getLogs", [{ fromBlock, toBlock: "latest", topics: [sig, null, topic] }]),
      ]);
      (sent || []).concat(got || []).forEach((L) => {
        if (L.address && !cand.has(L.address.toLowerCase())) cand.set(L.address.toLowerCase(), {});
      });
    } catch {} // 日志扫描失败不影响登记簿代币查询
    // 2) 逐个查：合约存在 → 余额；无代码 → 标记失效（多为链重置前的旧登记）
    const rows = [];
    for (const [t, meta] of cand) {
      let code = "0x";
      try { code = await rpc("eth_getCode", [t, "latest"]); } catch {}
      if (!code || code === "0x") {
        rows.push(`<div class="hint">⚠️ ${meta.name || "代币"} <small>${t.slice(0, 10)}…</small> — 合约不存在（链重置前的旧登记）</div>`);
        continue;
      }
      try {
        const balHex = await rpc("eth_call", [{ to: t, data: "0x70a08231" + pad(addr) }, "latest"]);
        const bal = window.ethers.formatUnits(balHex && balHex !== "0x" ? balHex : "0x0");
        let label = meta.name && meta.symbol ? `${meta.name} (${meta.symbol})` : "";
        if (!label) { // 未登记的代币：链上读 name()/symbol()
          const [sym, nm] = await Promise.all([
            rpc("eth_call", [{ to: t, data: "0x95d89b41" }, "latest"]).catch(() => null),
            rpc("eth_call", [{ to: t, data: "0x06fdde03" }, "latest"]).catch(() => null),
          ]);
          const s = sym ? dec(["string"], sym) : null;
          const n = nm ? dec(["string"], nm) : null;
          label = (n || s) ? `${n || "?"} (${s || "?"})` : "未命名代币";
        }
        rows.push(`<div class="tok"><b>${label}</b>：${bal}<br><small>${t}</small></div>`);
      } catch { rows.push(`<div class="hint">⚠️ ${t.slice(0, 10)}… 余额查询失败</div>`); }
    }
    box.innerHTML = rows.length
      ? '<div class="hint">代币余额（登记簿 + 最近 4096 块链上扫描）：</div>' + rows.join("")
      : '<div class="hint">该地址未发现任何 ERC-20 代币余额（可先到「代币」页发行/接收代币）。</div>';
  } catch (e) {
    box.innerHTML = "";
    log("代币余额扫描失败: " + e.message, "err");
  }
}

function useDevWallet() {
  fetch("/dev-key").then((r) => r.text()).then((pk) => {
    if (!pk) return log("服务器无开发私钥", "err");
    setWallet(pk.trim());
    log("已切换到本机开发账户", "ok");
  }).catch((e) => log("加载失败: " + e.message, "err"));
}

function createWallet() {
  const w = window.ethers.Wallet.createRandom();
  setWallet(w.privateKey);
  // setWallet 会清空输入框，这里重新填入方便复制备份
  $("priv").value = w.privateKey;
  log(`🆕 新钱包已创建，私钥已填入下方输入框，请自行保存备份！新钱包余额为 0，可用开发账户转 ETH 进去`, "ok");
}

// ── 转账 ETH ──────────────────────────────────────────
async function sendEth() {
  if (!wallet) return log("请先加载账户", "err");
  const to = $("eth-to").value.trim();
  const amt = $("eth-amt").value;
  // 地址规范成 0x + 40 位小写（Besu 对非规范地址报误导性错误）
  const toNorm = "0x" + to.toLowerCase().replace(/^0x/, "");
  if (!/^0x[0-9a-f]{40}$/.test(toNorm)) return log("接收地址不合法: " + to, "err");
  if (!amt || Number(amt) <= 0) return log("请填写转账数量", "err");
  const btn = $("btn-eth-send");
  btn.disabled = true;
  try {
    const value = window.ethers.parseEther(String(amt));
    log(`转账 ${amt} ETH → ${toNorm.slice(0, 10)}…`);
    const hash = await sendSigned({ to: toNorm, value, gasLimit: "21000" });
    recordTx(hash, `ETH ${amt} → ${toNorm.slice(0, 10)}…`);
    log(`交易已广播: ${hash}，等待出块（约 15 秒）…`);
    const rc = await waitReceipt(hash);
    const ok = Number(rc.status) === 1;
    settleTx(hash, ok, Number(rc.blockNumber));
    if (!ok) throw new Error("回执 status=0（余额不足？）");
    log(`✅ ETH 转账成功（区块 ${Number(rc.blockNumber)}，gasUsed ${Number(rc.gasUsed)}）`, "ok");
    refreshBalance();
  } catch (e) {
    log("❌ 转账失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

// ── 初始化 ────────────────────────────────────────────
async function init() {
  if (!window.ethers) { log("ethers.js 未加载", "err"); return; }
  RPC_ABS = new URL("/rpc", location.href).href;

  try {
    const bn = await rpc("eth_blockNumber", []);
    $("chain-info").innerHTML =
      `Besu 本地链 · Chain ID ${CHAIN_ID}<br>区块高度 ${parseInt(bn, 16)} · 出块间隔 15s`;
  } catch (e) {
    $("chain-info").textContent = "链连接失败：" + e.message;
    log("无法连接 Besu 节点：" + e.message, "err");
    return;
  }

  factoryData = await (await fetch("/factory")).json();
  log(`发币模板已加载（字节码 ${Math.round(factoryData.bytecode.length / 2 / 1024)}KB）`, "ok");
  try {
    nftData = await (await fetch("/nft")).json();
    log(`NFT 模板已加载（字节码 ${Math.round(nftData.bytecode.length / 2 / 1024)}KB）`, "ok");
  } catch (e) {
    log("NFT 模板加载失败：" + e.message, "err");
  }
  try {
    stakingData = await (await fetch("/staking")).json();
    log(`质押池模板已加载（字节码 ${Math.round(stakingData.bytecode.length / 2 / 1024)}KB）`, "ok");
  } catch (e) {
    log("质押池模板加载失败：" + e.message, "err");
  }
  try {
    ammData = await (await fetch("/amm")).json();
    log(`AMM 模板已加载（字节码 ${Math.round(ammData.bytecode.length / 2 / 1024)}KB）`, "ok");
  } catch (e) {
    log("AMM 模板加载失败：" + e.message, "err");
  }
  try {
    lendingData = await (await fetch("/lending")).json();
    log(`借贷市场模板已加载（字节码 ${Math.round(lendingData.bytecode.length / 2 / 1024)}KB）`, "ok");
  } catch (e) {
    log("借贷市场模板加载失败：" + e.message, "err");
  }
  try {
    oracleData = await (await fetch("/oracle")).json();
    log(`预言机模板已加载（字节码 ${Math.round(oracleData.bytecode.length / 2 / 1024)}KB）`, "ok");
  } catch (e) {
    log("预言机模板加载失败：" + e.message, "err");
  }
  try {
    legoData = await (await fetch("/lego")).json();
    log(`乐高金库模板已加载（字节码 ${Math.round(legoData.bytecode.length / 2 / 1024)}KB）`, "ok");
  } catch (e) {
    log("乐高金库模板加载失败：" + e.message, "err");
  }
  try {
    govData = await (await fetch("/governance")).json();
    log(`治理套件模板已加载（4 个合约）`, "ok");
  } catch (e) {
    log("治理套件模板加载失败：" + e.message, "err");
  }

  // 账户：优先上次使用的钱包 → 开发私钥
  let pk = localStorage.getItem(WKKEY) || "";
  if (pk) {
    log("已恢复上次使用的钱包", "ok");
    setWallet(pk);
  } else {
    try {
      pk = (await (await fetch("/dev-key")).text()).trim();
      if (pk) { log("已自动加载本机开发账户", "ok"); setWallet(pk); }
    } catch {}
  }

  renderTokens();
  renderNFTs();
  renderStakeTokens();
  renderDexTokens();
  renderLendTokens();
  renderOracleTokens();
  renderReporters();
  renderLegoTokens();
  renderGov();
  renderTxs();
}

// ── 发行代币 ──────────────────────────────────────────
async function deployToken() {
  if (!wallet) { log("请先加载账户", "err"); return; }
  const name = $("t-name").value.trim();
  const symbol = $("t-symbol").value.trim().toUpperCase();
  const supply = $("t-supply").value;
  if (!name || !symbol || !supply) { log("请填写名称/符号/总量", "err"); return; }

  const btn = $("btn-deploy");
  btn.disabled = true;
  try {
    log(`开始发行 ${name} (${symbol})，总量 ${supply} ...`);
    // 手工编码 constructor(string,string,uint256) 参数并拼接到字节码
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const ctorArgs = enc.encode(["string", "string", "uint256"], [name, symbol, supply]);
    const txHash = await sendSigned({
      data: factoryData.bytecode + ctorArgs.slice(2),
      gasLimit: factoryData.gasLimit, gasPrice: factoryData.gasPrice,
    });
    recordTx(txHash, `发行 ${name} (${symbol})`);
    log(`交易已广播: ${txHash}，等待出块（约 15 秒）…`);

    const rc = await waitReceipt(txHash);
    const ok = Number(rc.status) === 1;
    settleTx(txHash, ok, Number(rc.blockNumber));
    if (!ok) throw new Error(`回执 status=${rc.status}`);
    const addr = rc.contractAddress;
    log(`✅ 发行成功! 合约地址 ${addr}（区块 ${Number(rc.blockNumber)}，gasUsed ${Number(rc.gasUsed)}）`, "ok");

    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    list.unshift({ address: addr, name, symbol, supply, time: new Date().toLocaleString() });
    localStorage.setItem(KEY, JSON.stringify(list));
    renderTokens();
    refreshBalance();
  } catch (e) {
    log("❌ 发行失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

// ── 代币列表 & 转账 ───────────────────────────────────
function renderTokens() {
  const list = JSON.parse(localStorage.getItem(KEY) || "[]");
  const box = $("tokens");
  const trBox = $("transfer-box");
  if (!list.length) {
    box.innerHTML = '<div class="hint">暂无，发行后显示在这里</div>';
    trBox.style.display = "none";
    return;
  }
  box.innerHTML = "";
  const sel = $("tr-token");
  sel.innerHTML = "";
  for (const t of list) {
    const div = document.createElement("div");
    div.className = "tok";
    div.innerHTML = `<div><b>${t.name}</b> (${t.symbol})<br>
      <small>${t.address}</small><br>
      <small>发行 ${t.supply} · ${t.time}</small></div>
      <a data-addr="${t.address}">复制</a>`;
    box.appendChild(div);
    const opt = document.createElement("option");
    opt.value = t.address;
    opt.textContent = `${t.name} (${t.symbol})`;
    sel.appendChild(opt);
  }
  box.querySelectorAll("a").forEach((a) =>
    a.onclick = () => { navigator.clipboard.writeText(a.dataset.addr); log("地址已复制"); });
  trBox.style.display = "block";
  // 收款查询卡片的 datalist 同步登记代币
  const dl = $("rcv-token-list");
  if (dl) {
    dl.innerHTML = "";
    for (const t of list) {
      const o = document.createElement("option");
      o.value = t.address;
      o.label = `${t.name} (${t.symbol})`;
      dl.appendChild(o);
    }
  }
  renderStakeTokens();
}

// ── 收款查询：按地址查某代币的余额 + 链上入账（Transfer 事件）─────
const XFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// Besu 的 topics 过滤（尤其含 null 通配位）在部分范围下不稳定/超限，
// 统一拉全量再本地过滤；分段倒序扫（每段 512 块，最多 4096 块），凑满 10 条即停。
async function getTransferLogs(tAddr, aAddr, opts) {
  const pad = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const want = pad(aAddr);
  const both = !!(opts && opts.bothEnds); // topics[1]（from）也匹配：用于 NFT 持仓重放
  const head = BigInt(await rpcOnce("eth_blockNumber"));
  const all = [];
  const getLogsSafe = async (filter) => {
    const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getLogs", params: [filter] });
    const res = await fetch(RPC_ABS, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body });
    const j = await res.json();
    if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
    return j.result || [];
  };
  // Besu 偶发 "Invalid filter params"/级联失败：每段最多重试 3 次（递增间隔）
  // 匹配上限：默认 10 条（ERC-20 入账流水）；bothEnds（NFT 持仓重放）需扫全 4096 块
  const cap = both ? Infinity : 10;
  for (let end = head, scanned = 0n; scanned < 4096n && all.length < cap; ) {
    const from = end > 512n ? end - 512n : 0n;
    const flt = { address: tAddr, fromBlock: "0x" + from.toString(16), toBlock: "0x" + end.toString(16) };
    let logs = null;
    for (let k = 0; logs === null; k++) {
      try { logs = await getLogsSafe(flt); }
      catch (e) {
        if (k >= 2) throw e;
        await new Promise((r) => setTimeout(r, 400 * (k + 1)));
      }
    }
    for (const L of logs) {
      if (!(L.topics && L.topics[0].toLowerCase() === XFER_TOPIC)) continue;
      const hitTo = (L.topics[2] || "").toLowerCase().endsWith(want);
      const hitFrom = both && (L.topics[1] || "").toLowerCase().endsWith(want);
      if (hitTo || hitFrom) all.push(L);
    }
    scanned += end - from;
    end = from;
    if (from === 0n) break;
  }
  return all;
}

async function queryReceipts() {
  const out = $("rcv-result");
  if (queryReceipts._running) return;           // 防重入：自动查询+手动点击叠加
  queryReceipts._running = true;
  try { await queryReceiptsInner(out); }
  catch (e) { out.innerHTML = '<div class="hint">查询失败：' + (e.message || e) + '</div>'; }
  finally { queryReceipts._running = false; }
}

async function queryReceiptsInner(out) {
  const tAddr = $("rcv-token").value.trim();
  const aAddr = $("rcv-addr").value.trim();
  const okT = /^0x[0-9a-fA-F]{40}$/.test(tAddr);
  const okA = /^0x[0-9a-fA-F]{40}$/.test(aAddr);
  if (!okT || !okA) { out.innerHTML = '<div class="hint">请填写合法的代币合约地址与接收地址（0x…40 位）。</div>'; return; }
  out.innerHTML = '<div class="hint">查询中（链上日志扫描，数秒）…</div>';
  // 登记簿里查名字用于展示
  const list = JSON.parse(localStorage.getItem(KEY) || "[]");
  const meta = list.find((t) => t.address.toLowerCase() === tAddr.toLowerCase());
  const label = meta ? `${meta.name} (${meta.symbol})` : "自定义代币";
  const pad = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const logs = await getTransferLogs(tAddr, aAddr);
  const balWei = await rpc("eth_call", [{ to: tAddr, data: "0x70a08231" + pad(aAddr) }, "latest"]);
  const bal = window.ethers.formatUnits(balWei);
  const rows = (logs || []).slice(-10).reverse().map((L) => {
    const from = "0x" + (L.topics[1] || "").slice(26);
    const value = window.ethers.formatUnits(L.data && L.data !== "0x" ? L.data : "0x0");
    const bn = parseInt(L.blockNumber, 16);
    const mint = /^0{4,24}[1-9a-f][0-9a-f]*$/i.test(from.slice(2)) && /^0x0{64}$/.test(L.topics[1]);
    return `<div class="tok"><div><b>+${value}</b>${mint ? "（铸造）" : `<br><small>来自 ${from.slice(0, 10)}…</small>`}<br>
      <small>区块 ${bn}${L.transactionHash ? ` · <a data-h="${L.transactionHash}">交易</a>` : ""}</small></div></div>`;
  }).join("");
  out.innerHTML = `<div class="hint">代币：<b>${label}</b><br>
    地址 <b>${aAddr.slice(0, 10)}…</b> 当前余额 <b>${bal}</b><br>
    最近入账记录（链上 Transfer 事件，最多 10 条）：</div>
    ${rows || '<div class="hint">该地址暂无入账记录</div>'}`;
  out.querySelectorAll("a[data-h]").forEach((a) =>
    a.onclick = () => { navigator.clipboard.writeText(a.dataset.h); log("交易哈希已复制"); });
  if (logs && logs.length) log(`收款查询：${label} 入账 ${logs.length} 笔，余额 ${bal}`);
}

async function transfer() {
  if (!wallet) { log("请先加载账户", "err"); return; }
  const addr = $("tr-token").value;
  const to = $("tr-to").value.trim();
  const amount = $("tr-amount").value;
  if (!addr || !to || !amount) { log("请选择代币并填写地址/数量", "err"); return; }
  const btn = $("btn-transfer");
  btn.disabled = true;
  try {
    const { parseUnits } = window.ethers;
    const toNorm = "0x" + to.toLowerCase().replace(/^0x/, "");
    if (!/^0x[0-9a-f]{40}$/.test(toNorm)) throw new Error("接收地址不合法: " + to);
    log(`转账 ${amount} → ${toNorm.slice(0, 10)}…`);
    // transfer(address,uint256) 选择器 0xa9059cbb + 手工编码参数
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const data = "0xa9059cbb" + enc.encode(
      ["address", "uint256"],
      [toNorm, parseUnits(String(amount))]
    ).slice(2);
    const txHash = await sendSigned({ to: addr, data, gasLimit: "1000000", gasPrice: "1000000000" });
    recordTx(txHash, `代币转账 ${amount} → ${toNorm.slice(0, 10)}…`);
    log(`交易已广播: ${txHash}，等待出块（约 15 秒）…`);
    const rc = await waitReceipt(txHash);
    const ok = Number(rc.status) === 1;
    settleTx(txHash, ok, Number(rc.blockNumber));
    if (!ok) throw new Error("回执 status=0（余额不足？）");
    log(`✅ 转账成功（区块 ${Number(rc.blockNumber)}，gasUsed ${Number(rc.gasUsed)}）`, "ok");
    // 接收方余额（偶发失败不影响转账结果本身）
    try {
      const toHex = toNorm.slice(2).padStart(64, "0");
      const balWei = await rpc("eth_call", [{
        to: addr,
        data: "0x70a08231" + toHex,
      }, "latest"]);
      log(`接收方现有 ${window.ethers.formatUnits(balWei)} 代币`, "ok");
    } catch {
      log("（余额查询暂不可用，可稍后重试）");
    }
    // 自动在"收款查询"卡片展示接收地址的入账详情
    try {
      $("rcv-token").value = addr;
      $("rcv-addr").value = toNorm;
      await queryReceipts();
    } catch { /* 展示失败不影响转账结果 */ }
    refreshBalance();
  } catch (e) {
    log("❌ 转账失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

// ── NFT（ERC-721）─────────────────────────────────────
let nftData = null;                          // /nft 模板（abi+bytecode）
let nftVerify = {};                          // tokenId -> {owner, uri} 链上确权缓存

function nftAddr() { return localStorage.getItem(NFTADDR) || ""; }

const SEL = { // 函数选择器（ethers.id 现算，避免手抄出错）
  mint: () => window.ethers.id("mint(address,string)").slice(0, 10),
  ownerOf: "0x6352211e",
  tokenURI: "0xc87b56dd",
  transferFrom: "0x23b872dd",
};
const PAD32 = (n) => BigInt(n).toString(16).padStart(64, "0");

// 首次铸造时自动部署 LabNFT（名称/符号可配，URI 在 mint 时传入）
async function ensureNFTContract() {
  if (nftAddr()) return nftAddr();
  const name = ($("n-name").value.trim() || "Lab NFT").slice(0, 20);
  const symbol = "LABN";
  log(`首次铸造：先部署 NFT 合约 ${name} (${symbol})…`);
  const enc = window.ethers.AbiCoder.defaultAbiCoder();
  const ctor = enc.encode(["string", "string"], [name, symbol]);
  const hash = await sendSigned({
    data: nftData.bytecode + ctor.slice(2),
    gasLimit: nftData.gasLimit, gasPrice: nftData.gasPrice,
  });
  recordTx(hash, `部署 NFT 合约 ${name}`);
  const rc = await waitReceipt(hash);
  const ok = Number(rc.status) === 1;
  settleTx(hash, ok, Number(rc.blockNumber));
  if (!ok) throw new Error("NFT 合约部署回执 status=0");
  localStorage.setItem(NFTADDR, rc.contractAddress);
  log(`✅ NFT 合约部署成功: ${rc.contractAddress}（区块 ${Number(rc.blockNumber)}）`, "ok");
  return rc.contractAddress;
}

async function mintNFT() {
  if (!wallet) return log("请先加载账户", "err");
  const uri = $("n-uri").value.trim();
  if (!uri) return log("请填写 tokenURI", "err");
  const btn = $("btn-mint");
  btn.disabled = true;
  try {
    const addr = await ensureNFTContract();
    log(`铸造 NFT → ${wallet.address.slice(0, 10)}… URI: ${uri.slice(0, 40)}${uri.length > 40 ? "…" : ""}`);
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const data = SEL.mint() + enc.encode(["address", "string"], [wallet.address, uri]).slice(2);
    const hash = await sendSigned({ to: addr, data, gasLimit: "1000000", gasPrice: "1000000000" });
    recordTx(hash, "铸造 NFT");
    log(`交易已广播: ${hash}，等待出块…`);
    const rc = await waitReceipt(hash);
    const ok = Number(rc.status) === 1;
    settleTx(hash, ok, Number(rc.blockNumber));
    if (!ok) throw new Error("铸造回执 status=0");
    // 从 Transfer(from=0x0) 日志解析分配到的 tokenId
    const TSIG = window.ethers.id("Transfer(address,address,uint256)");
    const ZERO = window.ethers.ZeroHash;
    let id = null;
    for (const lg of rc.logs || []) {
      if (lg.topics[0] === TSIG && lg.topics[1] === ZERO) id = Number(BigInt(lg.topics[3]));
    }
    if (!id) throw new Error("回执中未找到铸造事件");
    log(`✅ 铸造成功! tokenId=${id}（区块 ${Number(rc.blockNumber)}，gasUsed ${Number(rc.gasUsed)}）`, "ok");
    const list = JSON.parse(localStorage.getItem(NFTKEY) || "[]");
    list.unshift({
      id, uri,
      name: $("n-name").value.trim() || "Lab 藏品",
      minter: wallet.address, time: new Date().toLocaleString(),
    });
    localStorage.setItem(NFTKEY, JSON.stringify(list));
    $("n-uri").value = "";
    renderNFTs();
    refreshBalance();
  } catch (e) {
    log("❌ 铸造失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

function renderNFTs() {
  const list = JSON.parse(localStorage.getItem(NFTKEY) || "[]");
  const box = $("nfts");
  const sel = $("nft-token");
  sel.innerHTML = "";
  if (!list.length) { box.innerHTML = '<div class="hint">暂无，铸造后显示在这里</div>'; return; }
  box.innerHTML = "";
  for (const t of list) {
    const v = nftVerify[t.id];
    const div = document.createElement("div");
    div.className = "tok";
    div.innerHTML = `<div><b>#${t.id} ${t.name}</b><br>
      <small>${t.uri.length > 60 ? t.uri.slice(0, 60) + "…" : t.uri}</small><br>
      <small>铸造 ${t.time}${v ? ` · 链上持有人 ${v.owner.slice(0, 10)}…` : ""}</small></div>
      <a data-id="${t.id}">复制URI</a>`;
    box.appendChild(div);
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = `#${t.id} ${t.name}`;
    sel.appendChild(opt);
  }
  box.querySelectorAll("a").forEach((a) =>
    a.onclick = () => {
      const t = JSON.parse(localStorage.getItem(NFTKEY) || "[]").find((x) => String(x.id) === a.dataset.id);
      navigator.clipboard.writeText(t.uri); log(`#${t.id} URI 已复制`);
    });
}

// 链上确权：逐枚调 ownerOf + tokenURI，回显真实持有人与元数据
async function verifyNFT() {
  const list = JSON.parse(localStorage.getItem(NFTKEY) || "[]");
  if (!list.length) return log("暂无藏品可确权", "err");
  const btn = $("btn-nft-verify");
  btn.disabled = true;
  try {
    const addr = nftAddr();
    if (!addr) return log("尚未部署 NFT 合约", "err");
    for (const t of list) {
      const ownerRet = await rpc("eth_call", [{ to: addr, data: SEL.ownerOf + PAD32(t.id) }, "latest"]);
      const uriRet = await rpc("eth_call", [{ to: addr, data: SEL.tokenURI + PAD32(t.id) }, "latest"]);
      const owner = "0x" + ownerRet.slice(-40);
      const uri = window.ethers.AbiCoder.defaultAbiCoder().decode(["string"], uriRet)[0];
      nftVerify[t.id] = { owner, uri };
      log(`#${t.id} 链上确权: 持有人 ${owner} · URI "${uri.slice(0, 40)}${uri.length > 40 ? "…" : ""}"`, "ok");
    }
    renderNFTs();
  } catch (e) {
    log("❌ 确权失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

async function nftTransfer() {
  if (!wallet) return log("请先加载账户", "err");
  const id = $("nft-token").value;
  const to = $("nft-to").value.trim();
  if (!id) return log("请选择藏品", "err");
  const toNorm = "0x" + to.toLowerCase().replace(/^0x/, "");
  if (!/^0x[0-9a-f]{40}$/.test(toNorm)) return log("接收地址不合法: " + to, "err");
  const btn = $("btn-nft-send");
  btn.disabled = true;
  try {
    const addr = nftAddr();
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const data = SEL.transferFrom + enc.encode(
      ["address", "address", "uint256"], [wallet.address, toNorm, BigInt(id)]).slice(2);
    log(`NFT #${id} 转手 → ${toNorm.slice(0, 10)}…`);
    const hash = await sendSigned({ to: addr, data, gasLimit: "1000000", gasPrice: "1000000000" });
    recordTx(hash, `NFT #${id} 转手 → ${toNorm.slice(0, 10)}…`);
    log(`交易已广播: ${hash}，等待出块…`);
    const rc = await waitReceipt(hash);
    const ok = Number(rc.status) === 1;
    settleTx(hash, ok, Number(rc.blockNumber));
    if (!ok) throw new Error("转手回执 status=0（你不是持有人？）");
    log(`✅ NFT #${id} 已转给 ${toNorm}（区块 ${Number(rc.blockNumber)}，gasUsed ${Number(rc.gasUsed)}）`, "ok");
    delete nftVerify[id];
    // 自动在"收款查询"卡片展示接收地址的持有清单
    try {
      $("nrcv-addr").value = toNorm;
      await queryNFTReceipts();
    } catch { /* 展示失败不影响转手结果 */ }
    refreshBalance();
  } catch (e) {
    log("❌ 转手失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

// 收款查询：按地址查当前持有的全部 NFT（按 Transfer 事件重放持仓集合）
async function queryNFTReceipts() {
  const out = $("nrcv-result");
  if (queryNFTReceipts._running) return;
  queryNFTReceipts._running = true;
  try { await queryNFTReceiptsInner(out); }
  catch (e) { out.innerHTML = '<div class="hint">查询失败：' + (e.message || e) + '</div>'; }
  finally { queryNFTReceipts._running = false; }
}

async function queryNFTReceiptsInner(out) {
  const cAddr = $("nrcv-addr0").value.trim() || nftAddr();
  const aAddr = $("nrcv-addr").value.trim();
  const okC = /^0x[0-9a-fA-F]{40}$/.test(cAddr);
  const okA = /^0x[0-9a-fA-F]{40}$/.test(aAddr);
  if (!okC) { out.innerHTML = '<div class="hint">请填写合法 NFT 合约地址（或留空使用已部署合约）。</div>'; return; }
  if (!okA) { out.innerHTML = '<div class="hint">请填写合法的接收地址（0x…40 位）。</div>'; return; }
  out.innerHTML = '<div class="hint">查询中（链上日志扫描，数秒）…</div>';
  // 本地登记名映射（tokenId -> 名称）
  const my = JSON.parse(localStorage.getItem(NFTKEY) || "[]");
  const nameOf = (id) => (my.find((x) => String(x.id) === String(id)) || {}).name;
  // 按 Transfer 事件重放：to==该地址 → 加入；from==该地址 → 移出
  const pad = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const logs = await getTransferLogs(cAddr, aAddr, { bothEnds: true });
  const held = new Set();
  for (const L of logs) {
    const from = "0x" + (L.topics[1] || "").toLowerCase().slice(26);
    const to = "0x" + (L.topics[2] || "").toLowerCase().slice(26);
    const id = (L.topics[3] || "").toLowerCase();
    if (to === aAddr.toLowerCase()) held.add(id);
    else if (from === aAddr.toLowerCase()) held.delete(id);
  }
  const ids = [...held].sort((x, y) => Number(BigInt(x)) - Number(BigInt(y)));
  // 逐枚链上确权 ownerOf + tokenURI
  const rows = [];
  for (const idHex of ids.slice(0, 12)) {
    const idNum = BigInt(idHex);
    try {
      const ownerRet = await rpc("eth_call", [{ to: cAddr, data: SEL.ownerOf + PAD32(idNum) }, "latest"]);
      const uriRet = await rpc("eth_call", [{ to: cAddr, data: SEL.tokenURI + PAD32(idNum) }, "latest"]);
      const owner = "0x" + ownerRet.slice(-40);
      const uri = window.ethers.AbiCoder.defaultAbiCoder().decode(["string"], uriRet)[0];
      const nm = nameOf(idNum);
      rows.push(`<div class="tok"><div><b>#${idNum}</b>${nm ? " " + nm : ""}<br>
        <small>${uri.length > 60 ? uri.slice(0, 60) + "…" : uri}</small><br>
        <small>链上持有人 ${owner.slice(0, 10)}…</small></div></div>`);
    } catch {
      rows.push(`<div class="tok"><div><b>#${idNum}</b><br><small>元数据读取失败（已销毁？）</small></div></div>`);
    }
  }
  out.innerHTML = `<div class="hint">合约 <b>${cAddr.slice(0, 10)}…</b> · 地址 <b>${aAddr.slice(0, 10)}…</b> 当前持有 <b>${ids.length}</b> 枚</div>
    ${rows.join("") || '<div class="hint">该地址当前无持有</div>'}`;
  if (ids.length) log(`NFT 收款查询：${aAddr.slice(0, 10)}… 持有 ${ids.length} 枚`);
}

// ── 质押（Staking）────────────────────────────────────
let stakingData = null; // /staking 模板

const sSEL = { // 选择器现算；approve 为 ERC-20 稳定值
  depositReward: () => window.ethers.id("depositReward(uint256)").slice(0, 10),
  stake: () => window.ethers.id("stake(uint256)").slice(0, 10),
  withdraw: () => window.ethers.id("withdraw(uint256)").slice(0, 10),
  getReward: () => window.ethers.id("getReward()").slice(0, 10),
  earned: () => window.ethers.id("earned(address)").slice(0, 10),
  stakedOf: () => window.ethers.id("stakedOf(address)").slice(0, 10),
  totalStaked: () => window.ethers.id("totalStaked()").slice(0, 10),
  rewardRate: () => window.ethers.id("rewardRate()").slice(0, 10),
  periodFinish: () => window.ethers.id("periodFinish()").slice(0, 10),
  approve: "0x095ea7b3",
};
const poolKey = (token) => "lab.staking." + token;
const getPool = (token) => localStorage.getItem(poolKey(token)) || "";

// ERC-20 授权（approve spender amount）
async function erc20Approve(token, spender, amountHuman, purpose) {
  const { parseUnits } = window.ethers;
  const enc = window.ethers.AbiCoder.defaultAbiCoder();
  const data = sSEL.approve + enc.encode(
    ["address", "uint256"], [spender, parseUnits(String(amountHuman))]).slice(2);
  const hash = await sendSigned({ to: token, data, gasLimit: "200000", gasPrice: "1000000000" });
  recordTx(hash, purpose);
  log(`交易已广播: ${hash}，等待出块…`);
  const rc = await waitReceipt(hash);
  const ok = Number(rc.status) === 1;
  settleTx(hash, ok, Number(rc.blockNumber));
  if (!ok) throw new Error("approve 回执 status=0");
  log(`✅ 授权成功（区块 ${Number(rc.blockNumber)}）`, "ok");
}

// 部署 LabStaking（构造参数：质押代币地址）
async function deployStaking(token) {
  const enc = window.ethers.AbiCoder.defaultAbiCoder();
  const ctor = enc.encode(["address"], [token]);
  const hash = await sendSigned({
    data: stakingData.bytecode + ctor.slice(2),
    gasLimit: stakingData.gasLimit, gasPrice: stakingData.gasPrice,
  });
  recordTx(hash, "部署质押池");
  log(`部署质押池交易已广播，等待出块…`);
  const rc = await waitReceipt(hash);
  const ok = Number(rc.status) === 1;
  settleTx(hash, ok, Number(rc.blockNumber));
  if (!ok) throw new Error("质押池部署回执 status=0");
  localStorage.setItem(poolKey(token), rc.contractAddress);
  log(`✅ 质押池部署成功: ${rc.contractAddress}（区块 ${Number(rc.blockNumber)}）`, "ok");
  return rc.contractAddress;
}

// 部署（若无）→ 注入奖励金库（approve + depositReward，共 3 笔）
async function setupPool() {
  if (!wallet) return log("请先加载账户", "err");
  const token = $("stake-token").value;
  const amt = Number($("reward-amt").value);
  if (!token) return log("请先在代币页发行并选择代币", "err");
  if (!amt || amt <= 0) return log("请填写金库注入量", "err");
  const btn = $("btn-stake-pool");
  btn.disabled = true;
  try {
    let pool = getPool(token);
    if (!pool) {
      pool = await deployStaking(token);
    } else {
      log(`复用已有质押池 ${pool}`);
    }
    log(`注入奖励金库 ${amt}（approve → depositReward，约 30 秒）…`);
    await erc20Approve(token, pool, amt, "授权质押池扣款");
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const data = sSEL.depositReward() + enc.encode(["uint256"], [window.ethers.parseUnits(String(amt))]).slice(2);
    const hash = await sendSigned({ to: pool, data, gasLimit: "1000000", gasPrice: "1000000000" });
    recordTx(hash, "注入奖励金库 " + amt);
    log(`交易已广播: ${hash}，等待出块…`);
    const rc = await waitReceipt(hash);
    const ok = Number(rc.status) === 1;
    settleTx(hash, ok, Number(rc.blockNumber));
    if (!ok) throw new Error("depositReward 回执 status=0");
    log(`✅ 金库注入完成！未来 3600 秒内按秒发放（区块 ${Number(rc.blockNumber)}）`, "ok");
    $("stake-pool-info").textContent = "质押池: " + pool;
    refreshStake();
  } catch (e) {
    log("❌ 部署/注入失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

async function doStake() {
  if (!wallet) return log("请先加载账户", "err");
  const token = $("stake-token").value;
  const pool = getPool(token);
  const amt = Number($("stake-amt").value);
  if (!token || !pool) return log("请先部署质押池", "err");
  if (!amt || amt <= 0) return log("请填写质押数量", "err");
  const btn = $("btn-stake");
  btn.disabled = true;
  try {
    log(`质押 ${amt}：先授权 → 再 stake（约 30 秒）…`);
    await erc20Approve(token, pool, amt, "授权质押池扣款");
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const data = sSEL.stake() + enc.encode(["uint256"], [window.ethers.parseUnits(String(amt))]).slice(2);
    const hash = await sendSigned({ to: pool, data, gasLimit: "500000", gasPrice: "1000000000" });
    recordTx(hash, `质押 ${amt}`);
    log(`交易已广播: ${hash}，等待出块…`);
    const rc = await waitReceipt(hash);
    const ok = Number(rc.status) === 1;
    settleTx(hash, ok, Number(rc.blockNumber));
    if (!ok) throw new Error("stake 回执 status=0（代币余额不足？）");
    log(`✅ 质押成功（区块 ${Number(rc.blockNumber)}），奖励开始按秒累计`, "ok");
    refreshStake();
  } catch (e) {
    log("❌ 质押失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

async function claimReward() {
  if (!wallet) return log("请先加载账户", "err");
  const token = $("stake-token").value;
  const pool = getPool(token);
  if (!pool) return log("请先部署质押池", "err");
  const btn = $("btn-claim");
  btn.disabled = true;
  try {
    log("领取收益…");
    const hash = await sendSigned({ to: pool, data: sSEL.getReward(), gasLimit: "500000", gasPrice: "1000000000" });
    recordTx(hash, "领取质押收益");
    log(`交易已广播: ${hash}，等待出块…`);
    const rc = await waitReceipt(hash);
    const ok = Number(rc.status) === 1;
    settleTx(hash, ok, Number(rc.blockNumber));
    if (!ok) throw new Error("getReward 回执 status=0");
    log(`✅ 收益已到账（区块 ${Number(rc.blockNumber)}）`, "ok");
    refreshStake();
  } catch (e) {
    log("❌ 领取失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

async function unstakeAll() {
  if (!wallet) return log("请先加载账户", "err");
  const token = $("stake-token").value;
  const pool = getPool(token);
  if (!pool) return log("请先部署质押池", "err");
  const btn = $("btn-unstake");
  btn.disabled = true;
  try {
    // 先读出质押中数量
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const ret = await rpc("eth_call", [{
      to: pool,
      data: sSEL.stakedOf() + enc.encode(["address"], [wallet.address]).slice(2),
    }, "latest"]);
    const staked = BigInt(ret);
    if (staked === 0n) return log("没有质押中的本金", "err");
    log(`赎回全部本金 ${window.ethers.formatEther(staked)}…`);
    const data = sSEL.withdraw() + enc.encode(["uint256"], [staked]).slice(2);
    const hash = await sendSigned({ to: pool, data, gasLimit: "500000", gasPrice: "1000000000" });
    recordTx(hash, "赎回质押本金");
    log(`交易已广播: ${hash}，等待出块…`);
    const rc = await waitReceipt(hash);
    const ok = Number(rc.status) === 1;
    settleTx(hash, ok, Number(rc.blockNumber));
    if (!ok) throw new Error("withdraw 回执 status=0");
    log(`✅ 本金已赎回（区块 ${Number(rc.blockNumber)}）`, "ok");
    refreshStake();
  } catch (e) {
    log("❌ 赎回失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

// 刷新质押状态（全部只读 eth_call）
async function refreshStake() {
  const token = $("stake-token").value;
  const pool = getPool(token);
  if (!pool) { $("stake-pool-info").textContent = "尚未部署。每个代币各有一个质押池，部署 = 3 笔交易约 45 秒。"; return; }
  try {
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const { formatEther } = window.ethers;
    const call = (sel, args, types) => rpc("eth_call", [{
      to: pool,
      data: sel + (args ? enc.encode(args, types).slice(2) : ""),
    }, "latest"]).then((r) => BigInt(r === "0x" ? 0 : r));
    const staked = await call(sSEL.stakedOf(), ["address"], [wallet.address]);
    const earned = await call(sSEL.earned(), ["address"], [wallet.address]);
    const total = await call(sSEL.totalStaked(), [], []);
    const rate = await call(sSEL.rewardRate(), [], []);
    const finish = await call(sSEL.periodFinish(), [], []);
    const now = BigInt(Math.floor(Date.now() / 1000));
    $("st-total").value = formatEther(staked) + " （金库代币计）";
    $("st-earned").value = formatEther(earned);
    $("st-pool").value = formatEther(total);
    const remain = finish > now ? Number(finish - now) : 0;
    $("st-rate").value = `${formatEther(rate)}/秒 · 本期剩余 ${remain} 秒`;
    $("stake-pool-info").textContent = "质押池: " + pool;
  } catch (e) {
    log("刷新状态失败: " + (e.shortMessage || e.message), "err");
  }
}

function renderStakeTokens() {
  const list = JSON.parse(localStorage.getItem(KEY) || "[]");
  const sel = $("stake-token");
  const cur = sel.value;
  sel.innerHTML = "";
  for (const t of list) {
    const opt = document.createElement("option");
    opt.value = t.address;
    opt.textContent = `${t.name} (${t.symbol})`;
    sel.appendChild(opt);
  }
  if (cur && list.some((t) => t.address === cur)) sel.value = cur;
}

// ── DEX（AMM）─────────────────────────────────────────
let ammData = null; // /amm 模板

const aSEL = {
  addLiquidity: () => window.ethers.id("addLiquidity(uint256)").slice(0, 10),
  removeLiquidity: () => window.ethers.id("removeLiquidity(uint256)").slice(0, 10),
  swapETHForToken: () => window.ethers.id("swapETHForToken()").slice(0, 10),
  swapTokenForETH: () => window.ethers.id("swapTokenForETH(uint256)").slice(0, 10),
  getAmountOut: () => window.ethers.id("getAmountOut(uint256,bool)").slice(0, 10),
  reserveETH: () => window.ethers.id("reserveETH()").slice(0, 10),
  reserveToken: () => window.ethers.id("reserveToken()").slice(0, 10),
  lpOf: () => window.ethers.id("lpOf(address)").slice(0, 10),
};
const ammPoolKey = (token) => "lab.amm." + token;
const getAmmPool = (token) => localStorage.getItem(ammPoolKey(token)) || "";

// 部署 LabAMM（构造参数：代币地址）
async function deployAMM(token) {
  const enc = window.ethers.AbiCoder.defaultAbiCoder();
  const ctor = enc.encode(["address"], [token]);
  const hash = await sendSigned({
    data: ammData.bytecode + ctor.slice(2),
    gasLimit: ammData.gasLimit, gasPrice: ammData.gasPrice,
  });
  recordTx(hash, "部署 AMM 交易池");
  log(`部署 AMM 交易池交易已广播，等待出块…`);
  const rc = await waitReceipt(hash);
  const ok = Number(rc.status) === 1;
  settleTx(hash, ok, Number(rc.blockNumber));
  if (!ok) throw new Error("AMM 部署回执 status=0");
  localStorage.setItem(ammPoolKey(token), rc.contractAddress);
  log(`✅ AMM 交易池部署成功: ${rc.contractAddress}（区块 ${Number(rc.blockNumber)}）`, "ok");
  return rc.contractAddress;
}

// 注入流动性（首注建池 / 续注按比例）
async function ammAddLiquidity() {
  if (!wallet) return log("请先加载账户", "err");
  const token = $("dex-token").value;
  const ethAmt = Number($("add-eth").value);
  const tokenAmt = Number($("add-token").value);
  if (!token) return log("请选择代币", "err");
  if (!ethAmt || ethAmt <= 0) return log("请填写 ETH 数量", "err");
  if (!tokenAmt || tokenAmt <= 0) return log("请填写代币数量（首注必需）", "err");
  const btn = $("btn-amm-add");
  btn.disabled = true;
  try {
    let pool = getAmmPool(token);
    if (!pool) pool = await deployAMM(token);
    log(`注入流动性 ${ethAmt} ETH + 代币（授权 → addLiquidity，约 30 秒）…`);
    await erc20Approve(token, pool, tokenAmt, "授权 AMM 扣代币");
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const data = aSEL.addLiquidity() + enc.encode(["uint256"], [window.ethers.parseUnits(String(tokenAmt))]).slice(2);
    const hash = await sendSigned({
      to: pool, data, gasLimit: "3000000", gasPrice: "1000000000",
      value: window.ethers.parseEther(String(ethAmt)),
    });
    recordTx(hash, `注入流动性 ${ethAmt} ETH`);
    log(`交易已广播: ${hash}，等待出块…`);
    const rc = await waitReceipt(hash);
    const ok = Number(rc.status) === 1;
    settleTx(hash, ok, Number(rc.blockNumber));
    if (!ok) throw new Error("addLiquidity 回执 status=0（代币余额不足/续注比例超上限？）");
    log(`✅ 流动性注入成功（区块 ${Number(rc.blockNumber)}），获得 LP 份额`, "ok");
    refreshAMM();
  } catch (e) {
    log("❌ 注入失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

// 报价（只读）
async function ammQuote() {
  const token = $("dex-token").value;
  const pool = getAmmPool(token);
  if (!pool) return log("请先建池", "err");
  const amt = Number($("swap-amt").value);
  if (!amt || amt <= 0) return log("请填写数量", "err");
  const ethIn = $("swap-dir").value === "eth2t";
  try {
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const inWei = ethIn ? window.ethers.parseEther(String(amt)) : window.ethers.parseUnits(String(amt));
    const ret = await rpc("eth_call", [{
      to: pool,
      data: aSEL.getAmountOut() + enc.encode(["uint256", "bool"], [inWei, ethIn]).slice(2),
    }, "latest"]);
    const out = BigInt(ret);
    const { formatEther } = window.ethers;
    $("swap-quote").textContent = ethIn
      ? `预计获得 ≈ ${formatEther(out)} 代币（已扣 0.3% 手续费，实际以出块时池价为准）`
      : `预计获得 ≈ ${formatEther(out)} ETH（已扣 0.3% 手续费，实际以出块时池价为准）`;
  } catch (e) {
    $("swap-quote").textContent = "报价失败：" + (e.shortMessage || e.message);
  }
}

// 执行兑换
async function ammSwap() {
  if (!wallet) return log("请先加载账户", "err");
  const token = $("dex-token").value;
  const pool = getAmmPool(token);
  if (!pool) return log("请先建池", "err");
  const amt = Number($("swap-amt").value);
  if (!amt || amt <= 0) return log("请填写数量", "err");
  const ethIn = $("swap-dir").value === "eth2t";
  const btn = $("btn-amm-swap");
  btn.disabled = true;
  try {
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    let hash;
    if (ethIn) {
      log(`兑换 ${amt} ETH → 代币…`);
      hash = await sendSigned({
        to: pool, data: aSEL.swapETHForToken(), gasLimit: "1000000", gasPrice: "1000000000",
        value: window.ethers.parseEther(String(amt)),
      });
      recordTx(hash, `兑换 ${amt} ETH→代币`);
    } else {
      log(`兑换 ${amt} 代币 → ETH（授权 → swap，约 30 秒）…`);
      await erc20Approve(token, pool, amt, "授权 AMM 扣代币");
      const data = aSEL.swapTokenForETH() + enc.encode(["uint256"], [window.ethers.parseUnits(String(amt))]).slice(2);
      hash = await sendSigned({ to: pool, data, gasLimit: "1000000", gasPrice: "1000000000" });
      recordTx(hash, `兑换 ${amt} 代币→ETH`);
    }
    log(`交易已广播: ${hash}，等待出块…`);
    const rc = await waitReceipt(hash);
    const ok = Number(rc.status) === 1;
    settleTx(hash, ok, Number(rc.blockNumber));
    if (!ok) throw new Error("swap 回执 status=0（池子为空/余额不足？）");
    log(`✅ 兑换成功（区块 ${Number(rc.blockNumber)}）`, "ok");
    refreshAMM();
    refreshBalance();
  } catch (e) {
    log("❌ 兑换失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

// 撤出全部 LP
async function ammRemove() {
  if (!wallet) return log("请先加载账户", "err");
  const token = $("dex-token").value;
  const pool = getAmmPool(token);
  if (!pool) return log("请先建池", "err");
  const btn = $("btn-amm-remove");
  btn.disabled = true;
  try {
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const ret = await rpc("eth_call", [{
      to: pool,
      data: aSEL.lpOf() + enc.encode(["address"], [wallet.address]).slice(2),
    }, "latest"]);
    const lp = BigInt(ret === "0x" ? 0 : ret);
    if (lp === 0n) return log("没有 LP 份额", "err");
    log(`撤出全部 LP 份额 ${window.ethers.formatEther(lp)}…`);
    const data = aSEL.removeLiquidity() + enc.encode(["uint256"], [lp]).slice(2);
    const hash = await sendSigned({ to: pool, data, gasLimit: "1000000", gasPrice: "1000000000" });
    recordTx(hash, "撤出流动性");
    log(`交易已广播: ${hash}，等待出块…`);
    const rc = await waitReceipt(hash);
    const ok = Number(rc.status) === 1;
    settleTx(hash, ok, Number(rc.blockNumber));
    if (!ok) throw new Error("removeLiquidity 回执 status=0");
    log(`✅ 流动性已撤出，ETH + 代币按份额退回（区块 ${Number(rc.blockNumber)}）`, "ok");
    refreshAMM();
    refreshBalance();
  } catch (e) {
    log("❌ 撤出失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

// 刷新池状态（只读）
async function refreshAMM() {
  const token = $("dex-token").value;
  const pool = getAmmPool(token);
  if (!pool) { $("amm-info").textContent = "尚未建池。首注按你给的 ETH/代币比例定初始价格；续注按池内比例自动配对代币。"; return; }
  try {
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const { formatEther } = window.ethers;
    const eth = BigInt(await rpc("eth_call", [{ to: pool, data: aSEL.reserveETH() }, "latest"]));
    const tok = BigInt(await rpc("eth_call", [{ to: pool, data: aSEL.reserveToken() }, "latest"]));
    const lpRet = await rpc("eth_call", [{
      to: pool, data: aSEL.lpOf() + enc.encode(["address"], [wallet.address]).slice(2),
    }, "latest"]);
    const lp = BigInt(lpRet === "0x" ? 0 : lpRet);
    $("lp-eth").value = formatEther(eth);
    $("lp-token").value = formatEther(tok);
    $("lp-mine").value = formatEther(lp);
    $("lp-price").value = eth > 0n ? formatEther(tok * window.ethers.WeiPerEther / eth) + " " : "—";
    $("amm-info").textContent = "交易池: " + pool;
  } catch (e) {
    log("刷新池状态失败: " + (e.shortMessage || e.message), "err");
  }
}

function renderDexTokens() {
  const list = JSON.parse(localStorage.getItem(KEY) || "[]");
  const sel = $("dex-token");
  const cur = sel.value;
  sel.innerHTML = "";
  for (const t of list) {
    const opt = document.createElement("option");
    opt.value = t.address;
    opt.textContent = `${t.name} (${t.symbol})`;
    sel.appendChild(opt);
  }
  if (cur && list.some((t) => t.address === cur)) sel.value = cur;
}

// ── 借贷（Lending）────────────────────────────────────
let lendingData = null; // /lending 模板

const lSEL = {
  fund: () => window.ethers.id("fund(uint256)").slice(0, 10),
  deposit: () => window.ethers.id("deposit()").slice(0, 10),
  borrow: () => window.ethers.id("borrow(uint256)").slice(0, 10),
  repay: () => window.ethers.id("repay(uint256)").slice(0, 10),
  withdraw: () => window.ethers.id("withdraw(uint256)").slice(0, 10),
  ethCollateral: () => window.ethers.id("ethCollateral(address)").slice(0, 10),
  principalOf: () => window.ethers.id("principalOf(address)").slice(0, 10),
  debtOf: () => window.ethers.id("debtOf(address)").slice(0, 10),
  maxBorrow: () => window.ethers.id("maxBorrow(address)").slice(0, 10),
  healthFactor: () => window.ethers.id("healthFactor(address)").slice(0, 10),
  tokenPool: () => window.ethers.id("tokenPool()").slice(0, 10),
  price: () => window.ethers.id("price()").slice(0, 10),
};
const lendKey = (token) => "lab.lend." + token;
const getLendPool = (token) => localStorage.getItem(lendKey(token)) || "";

// 部署 LabLending（token, price, rate=每秒1%演示）→ approve → fund
async function lendSetup() {
  if (!wallet) return log("请先加载账户", "err");
  const token = $("lend-token").value;
  const price = Number($("lend-price").value);
  const fundAmt = Number($("lend-fund").value);
  if (!token) return log("请选择代币", "err");
  if (!price || price <= 0) return log("请填写初始价格", "err");
  if (!fundAmt || fundAmt <= 0) return log("请填写注入资金", "err");
  const btn = $("btn-lend-setup");
  btn.disabled = true;
  try {
    let pool = getLendPool(token);
    if (!pool) {
      const enc = window.ethers.AbiCoder.defaultAbiCoder();
      const ctor = enc.encode(
        ["address", "uint256", "uint256"],
        [token, window.ethers.parseUnits(String(price)), window.ethers.parseEther("0.01")]);
      const hash = await sendSigned({
        data: lendingData.bytecode + ctor.slice(2),
        gasLimit: lendingData.gasLimit, gasPrice: lendingData.gasPrice,
      });
      recordTx(hash, "部署借贷市场");
      log("部署借贷市场交易已广播，等待出块…");
      const rc = await waitReceipt(hash);
      const ok = Number(rc.status) === 1;
      settleTx(hash, ok, Number(rc.blockNumber));
      if (!ok) throw new Error("借贷市场部署回执 status=0");
      localStorage.setItem(lendKey(token), rc.contractAddress);
      pool = rc.contractAddress;
      log(`✅ 借贷市场部署成功: ${pool}（区块 ${Number(rc.blockNumber)}）`, "ok");
    } else {
      log(`复用已有市场 ${pool}，直接补注入资金`);
    }
    log(`注入可借资金 ${fundAmt}（approve → fund，约 30 秒）…`);
    await erc20Approve(token, pool, fundAmt, "授权借贷市场扣款");
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const data = lSEL.fund() + enc.encode(["uint256"], [window.ethers.parseUnits(String(fundAmt))]).slice(2);
    const hash = await sendSigned({ to: pool, data, gasLimit: "1000000", gasPrice: "1000000000" });
    recordTx(hash, `注入可借资金 ${fundAmt}`);
    log(`交易已广播: ${hash}，等待出块…`);
    const rc2 = await waitReceipt(hash);
    const ok2 = Number(rc2.status) === 1;
    settleTx(hash, ok2, Number(rc2.blockNumber));
    if (!ok2) throw new Error("fund 回执 status=0");
    log(`✅ 可借资金注入完成（区块 ${Number(rc2.blockNumber)}）`, "ok");
    refreshLend();
  } catch (e) {
    log("❌ 部署/注入失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

// 存 ETH 抵押
async function lendDeposit() {
  if (!wallet) return log("请先加载账户", "err");
  const pool = getLendPool($("lend-token").value);
  if (!pool) return log("请先部署市场", "err");
  const amt = Number($("lend-dep").value);
  if (!amt || amt <= 0) return log("请填写 ETH 数量", "err");
  const btn = $("btn-lend-deposit");
  btn.disabled = true;
  try {
    log(`存入 ${amt} ETH 作抵押…`);
    const hash = await sendSigned({
      to: pool, data: lSEL.deposit(), gasLimit: "200000", gasPrice: "1000000000",
      value: window.ethers.parseEther(String(amt)),
    });
    recordTx(hash, `存入 ${amt} ETH 抵押`);
    log(`交易已广播: ${hash}，等待出块…`);
    const rc = await waitReceipt(hash);
    const ok = Number(rc.status) === 1;
    settleTx(hash, ok, Number(rc.blockNumber));
    if (!ok) throw new Error("deposit 回执 status=0");
    log(`✅ 抵押已入账（区块 ${Number(rc.blockNumber)}）`, "ok");
    refreshLend();
    refreshBalance();
  } catch (e) {
    log("❌ 存入失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

// 借代币
async function lendBorrow() {
  if (!wallet) return log("请先加载账户", "err");
  const token = $("lend-token").value;
  const pool = getLendPool(token);
  if (!pool) return log("请先部署市场", "err");
  const amt = Number($("lend-borrow-amt").value);
  if (!amt || amt <= 0) return log("请填写借款数量", "err");
  const btn = $("btn-lend-borrow");
  btn.disabled = true;
  try {
    log(`借款 ${amt}（超额抵押校验在合约内）…`);
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const data = lSEL.borrow() + enc.encode(["uint256"], [window.ethers.parseUnits(String(amt))]).slice(2);
    const hash = await sendSigned({ to: pool, data, gasLimit: "1000000", gasPrice: "1000000000" });
    recordTx(hash, `借款 ${amt}`);
    log(`交易已广播: ${hash}，等待出块…`);
    const rc = await waitReceipt(hash);
    const ok = Number(rc.status) === 1;
    settleTx(hash, ok, Number(rc.blockNumber));
    if (!ok) throw new Error("borrow 回执 status=0（超出最大可借/池子空？）");
    log(`✅ 借款到账，开始按秒计息（区块 ${Number(rc.blockNumber)}）`, "ok");
    refreshLend();
  } catch (e) {
    log("❌ 借款失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

// 还清全部（本金+利息）
async function lendRepay() {
  if (!wallet) return log("请先加载账户", "err");
  const token = $("lend-token").value;
  const pool = getLendPool(token);
  if (!pool) return log("请先部署市场", "err");
  const btn = $("btn-lend-repay");
  btn.disabled = true;
  try {
    // 只读查当前债务
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const ret = await rpc("eth_call", [{
      to: pool, data: lSEL.debtOf() + enc.encode(["address"], [wallet.address]).slice(2),
    }, "latest"]);
    const debt = BigInt(ret === "0x" ? 0 : ret);
    if (debt === 0n) return log("没有欠款", "err");
    // 出块期间利息还在涨（每秒 1%），按 2 倍超额授权与还款，合约只收实际债务
    const repayAmt = debt * 2n;
    log(`当前债务（本金+利息）${window.ethers.formatEther(debt)}，超额授权并还款…`);
    await erc20Approve(token, pool, window.ethers.formatEther(repayAmt), "授权借贷市场扣款");
    const data = lSEL.repay() + enc.encode(["uint256"], [repayAmt]).slice(2);
    const hash = await sendSigned({ to: pool, data, gasLimit: "1000000", gasPrice: "1000000000" });
    recordTx(hash, "还清借款（含利息）");
    log(`交易已广播: ${hash}，等待出块…`);
    const rc = await waitReceipt(hash);
    const ok = Number(rc.status) === 1;
    settleTx(hash, ok, Number(rc.blockNumber));
    if (!ok) throw new Error("repay 回执 status=0（出块期间利息又涨了一点？重试即可）");
    log(`✅ 还清成功（区块 ${Number(rc.blockNumber)}）`, "ok");
    refreshLend();
  } catch (e) {
    log("❌ 还款失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

// 取回全部抵押
async function lendWithdraw() {
  if (!wallet) return log("请先加载账户", "err");
  const pool = getLendPool($("lend-token").value);
  if (!pool) return log("请先部署市场", "err");
  const btn = $("btn-lend-withdraw");
  btn.disabled = true;
  try {
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const ret = await rpc("eth_call", [{
      to: pool, data: lSEL.ethCollateral() + enc.encode(["address"], [wallet.address]).slice(2),
    }, "latest"]);
    const coll = BigInt(ret === "0x" ? 0 : ret);
    if (coll === 0n) return log("没有抵押 ETH", "err");
    log(`取回全部抵押 ${window.ethers.formatEther(coll)} ETH…`);
    const data = lSEL.withdraw() + enc.encode(["uint256"], [coll]).slice(2);
    const hash = await sendSigned({ to: pool, data, gasLimit: "500000", gasPrice: "1000000000" });
    recordTx(hash, "取回抵押 ETH");
    log(`交易已广播: ${hash}，等待出块…`);
    const rc = await waitReceipt(hash);
    const ok = Number(rc.status) === 1;
    settleTx(hash, ok, Number(rc.blockNumber));
    if (!ok) throw new Error("withdraw 回执 status=0（还有未还债务？）");
    log(`✅ 抵押 ETH 已取回（区块 ${Number(rc.blockNumber)}）`, "ok");
    refreshLend();
    refreshBalance();
  } catch (e) {
    log("❌ 取回失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

// 刷新账户状态（只读）
async function refreshLend() {
  const token = $("lend-token").value;
  const pool = getLendPool(token);
  if (!pool) { $("lend-info").textContent = "尚未部署。抵押率 66%，清算奖金 8%，演示利率每秒 1%（真实协议约年化个位数）。"; return; }
  try {
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const { formatEther } = window.ethers;
    const call1 = (sel, arg) => rpc("eth_call", [{
      to: pool,
      data: sel + (arg ? enc.encode(["address"], [arg]).slice(2) : ""),
    }, "latest"]).then((r) => BigInt(r === "0x" ? 0 : r));
    const coll = await call1(lSEL.ethCollateral(), wallet.address);
    const prin = await call1(lSEL.principalOf(), wallet.address);
    const debt = await call1(lSEL.debtOf(), wallet.address);
    const maxB = await call1(lSEL.maxBorrow(), wallet.address);
    const hf = await call1(lSEL.healthFactor(), wallet.address);
    const tp = await call1(lSEL.tokenPool(), null);
    const pr = await call1(lSEL.price(), null);
    $("ld-coll").value = formatEther(coll) + " ETH";
    $("ld-prin").value = formatEther(prin);
    $("ld-debt").value = formatEther(debt);
    $("ld-health").value = hf === 2n ** 256n - 1n ? "∞（无债务）" : (Number(hf) / 1e18).toFixed(4);
    $("ld-max").value = formatEther(maxB);
    $("ld-pool").value = `${formatEther(tp)} / 1ETH=${formatEther(pr)}`;
    $("lend-info").textContent = "借贷市场: " + pool;
  } catch (e) {
    log("刷新状态失败: " + (e.shortMessage || e.message), "err");
  }
}

function renderLendTokens() {
  const list = JSON.parse(localStorage.getItem(KEY) || "[]");
  const sel = $("lend-token");
  const cur = sel.value;
  sel.innerHTML = "";
  for (const t of list) {
    const opt = document.createElement("option");
    opt.value = t.address;
    opt.textContent = `${t.name} (${t.symbol})`;
    sel.appendChild(opt);
  }
  if (cur && list.some((t) => t.address === cur)) sel.value = cur;
}

// ── 预言机（Oracle）────────────────────────────────────
let oracleData = null; // /oracle 模板
const ORCKEY = "lab.oracle";             // 预言机合约地址（教学单例）
const RPTKEY = "lab.oracle.reporters";   // 测试数据源登记簿 [{name,address,pk}]

const oSEL = { // 选择器现算，避免手抄出错
  addReporter: () => window.ethers.id("addReporter(address)").slice(0, 10),
  addReporters: () => window.ethers.id("addReporters(address[])").slice(0, 10),
  report: () => window.ethers.id("report(uint256)").slice(0, 10),
  refresh: () => window.ethers.id("refresh()").slice(0, 10),
  priceOf: () => window.ethers.id("priceOf(address)").slice(0, 10),
  latestAnswer: () => window.ethers.id("latestAnswer()").slice(0, 10),
  latestTimestamp: () => window.ethers.id("latestTimestamp()").slice(0, 10),
  roundId: () => window.ethers.id("roundId()").slice(0, 10),
  pendingMedian: () => window.ethers.id("pendingMedian()").slice(0, 10),
};
const oracleAddr = () => localStorage.getItem(ORCKEY) || "";
const getReporters = () => JSON.parse(localStorage.getItem(RPTKEY) || "[]");
const setReporters = (v) => localStorage.setItem(RPTKEY, JSON.stringify(v));

// 部署 LabOracle（initialPrice, minReports）
async function oracleDeploy() {
  if (!wallet) return log("请先加载账户", "err");
  const price = Number($("orc-price").value);
  const minR = Number($("orc-min").value);
  if (!(price > 0)) return log("请填写有效的初始价格", "err");
  if (!(minR > 0)) return log("最少报价数必须 ≥ 1", "err");
  if (oracleAddr()) return log("预言机已部署：" + oracleAddr(), "err");
  const btn = $("btn-orc-deploy");
  btn.disabled = true;
  try {
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const ctor = enc.encode(
      ["uint256", "uint256"],
      [window.ethers.parseUnits(String(price)), BigInt(minR)]);
    const hash = await sendSigned({
      data: oracleData.bytecode + ctor.slice(2),
      gasLimit: oracleData.gasLimit, gasPrice: oracleData.gasPrice,
    });
    recordTx(hash, "部署预言机 LabOracle");
    log("部署预言机交易已广播，等待出块…");
    const rc = await waitReceipt(hash);
    const ok = Number(rc.status) === 1;
    settleTx(hash, ok, Number(rc.blockNumber));
    if (!ok) throw new Error("预言机部署回执 status=0");
    localStorage.setItem(ORCKEY, rc.contractAddress);
    log(`✅ 预言机部署成功: ${rc.contractAddress}（区块 ${Number(rc.blockNumber)}）`, "ok");
    refreshOracle();
  } catch (e) {
    log("❌ 部署失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

// 一键准备 3 个测试数据源：随机账户 → dev 转 gas → 批量注册白名单
async function oraclePrepareReporters() {
  if (!wallet) return log("请先加载账户", "err");
  const orc = oracleAddr();
  if (!orc) return log("请先部署预言机", "err");
  if (getReporters().length) return log("测试数据源已准备过（见下表）", "err");
  const btn = $("btn-orc-prep");
  btn.disabled = true;
  try {
    const names = ["A", "B", "C"];
    const rs = names.map((n) => {
      const w = window.ethers.Wallet.createRandom();
      return { name: "数据源节点 " + n, address: w.address, pk: w.privateKey };
    });
    // 1) dev 给每个数据源转 gas（严格串行、逐笔等回执，防同 nonce 交易替换——踩坑 10）
    for (const r of rs) {
      log(`向 ${r.name}（${r.address.slice(0, 10)}…）转入 0.02 ETH gas 费…`);
      const hash = await sendSigned({
        to: r.address, value: window.ethers.parseEther("0.02"), gasLimit: "21000",
      });
      recordTx(hash, `给${r.name}转 gas 0.02 ETH`);
      const rc = await waitReceipt(hash);
      const ok = Number(rc.status) === 1;
      settleTx(hash, ok, Number(rc.blockNumber));
      if (!ok) throw new Error("gas 转账回执 status=0");
      log(`  ✅ 到账（区块 ${Number(rc.blockNumber)}）`, "ok");
    }
    // 2) admin 一笔交易批量注册进白名单
    log("批量注册 3 个数据源到预言机白名单…");
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const data = oSEL.addReporters() +
      enc.encode(["address[]"], [rs.map((r) => r.address)]).slice(2);
    const hash2 = await sendSigned({ to: orc, data, gasLimit: "500000", gasPrice: "1000000000" });
    recordTx(hash2, "注册数据源白名单 ×3");
    const rc2 = await waitReceipt(hash2);
    const ok2 = Number(rc2.status) === 1;
    settleTx(hash2, ok2, Number(rc2.blockNumber));
    if (!ok2) throw new Error("addReporters 回执 status=0");
    setReporters(rs);
    log(`✅ 3 个测试数据源已就绪并注册（区块 ${Number(rc2.blockNumber)}）`, "ok");
    refreshOracle();
  } catch (e) {
    log("❌ 准备数据源失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

// 用某个数据源自己的私钥报价（每笔等回执，严格串行）
async function reportAs(r, priceHuman, label) {
  const orc = oracleAddr();
  const signer = new window.ethers.Wallet(r.pk);
  const enc = window.ethers.AbiCoder.defaultAbiCoder();
  const data = oSEL.report() +
    enc.encode(["uint256"], [window.ethers.parseUnits(String(priceHuman))]).slice(2);
  log(`${label}（${r.address.slice(0, 10)}…）签名报价中…`);
  const hash = await sendSigned(
    { to: orc, data, gasLimit: "300000", gasPrice: "1000000000" }, signer);
  recordTx(hash, label);
  const rc = await waitReceipt(hash);
  const ok = Number(rc.status) === 1;
  settleTx(hash, ok, Number(rc.blockNumber));
  if (!ok) throw new Error("report 回执 status=0（非白名单数据源？）");
  log(`  ✅ 报价已上链（区块 ${Number(rc.blockNumber)}）`, "ok");
}

// 场景一键报价：3 笔串行（每笔约 15 秒出块）
async function oracleScene(mode) {
  if (!wallet) return log("请先加载账户", "err");
  const orc = oracleAddr();
  if (!orc) return log("请先部署预言机", "err");
  const rs = getReporters();
  if (rs.length < 3) return log("请先准备 3 个数据源", "err");
  const scenes = {
    normal: [2000, 2005, 1995],
    attack: [2000, 2002, 99999],
    up: [2100, 2105, 2095],
  };
  const prices = scenes[mode];
  const btns = ["btn-orc-scene-normal", "btn-orc-scene-attack", "btn-orc-scene-up", "btn-orc-refresh"];
  btns.forEach((id) => ($(id).disabled = true));
  try {
    for (let i = 0; i < 3; i++) {
      await reportAs(rs[i], prices[i], `${rs[i].name} 报价 ${prices[i]}`);
    }
    log("三笔报价全部上链，读取最终聚合结果…");
    await refreshOracle();
  } catch (e) {
    log("❌ 场景报价失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btns.forEach((id) => ($(id).disabled = false));
  }
}

// 手动触发 refresh() 聚合
async function oracleManualRefresh() {
  if (!wallet) return log("请先加载账户", "err");
  const orc = oracleAddr();
  if (!orc) return log("请先部署预言机", "err");
  const btn = $("btn-orc-refresh");
  btn.disabled = true;
  try {
    const hash = await sendSigned({
      to: orc, data: oSEL.refresh(), gasLimit: "500000", gasPrice: "1000000000",
    });
    recordTx(hash, "手动触发预言机聚合");
    const rc = await waitReceipt(hash);
    const ok = Number(rc.status) === 1;
    settleTx(hash, ok, Number(rc.blockNumber));
    if (!ok) throw new Error("refresh 回执 status=0（有效报价数不足门槛？）");
    log(`✅ 聚合已刷新（区块 ${Number(rc.blockNumber)}）`, "ok");
    refreshOracle();
  } catch (e) {
    log("❌ 聚合失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

// 把预言机最新价同步到借贷市场（两边的 admin 都是当前账户时可用）
async function oracleSyncLending() {
  if (!wallet) return log("请先加载账户", "err");
  const orc = oracleAddr();
  if (!orc) return log("请先部署预言机", "err");
  const token = $("orc-lend-token").value;
  const pool = getLendPool(token);
  if (!pool) return log("该代币还没有借贷市场，请先到借贷页部署", "err");
  const btn = $("btn-orc-sync");
  btn.disabled = true;
  try {
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const ret = await rpc("eth_call", [{ to: orc, data: oSEL.latestAnswer() }, "latest"]);
    const med = BigInt(ret === "0x" ? 0 : ret);
    if (med === 0n) return log("预言机还没有聚合价", "err");
    log(`预言机最新聚合价 ${window.ethers.formatEther(med)} → 同步到借贷市场…`);
    const setSel = window.ethers.id("setPrice(uint256)").slice(0, 10);
    const data = setSel + enc.encode(["uint256"], [med]).slice(2);
    const hash = await sendSigned({ to: pool, data, gasLimit: "200000", gasPrice: "1000000000" });
    recordTx(hash, `预言机喂价 ${window.ethers.formatEther(med)} → 借贷市场`);
    const rc = await waitReceipt(hash);
    const ok = Number(rc.status) === 1;
    settleTx(hash, ok, Number(rc.blockNumber));
    if (!ok) throw new Error("setPrice 回执 status=0（当前账户不是借贷市场 admin？）");
    log(`✅ 喂价完成（区块 ${Number(rc.blockNumber)}）——借贷市场已改用预言机价格`, "ok");
    refreshOracle();
  } catch (e) {
    log("❌ 喂价失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

// 数据源表格（基于本地登记簿，余额/报价逐行链上只读）
async function renderReporters() {
  const box = $("orc-reporters");
  if (!box) return;
  const rs = getReporters();
  if (!rs.length) {
    box.innerHTML = '<div class="hint">尚未准备数据源</div>';
    return;
  }
  const orc = oracleAddr();
  const rows = rs.map((r, i) => `
    <tr data-i="${i}" style="border-top:1px solid var(--border)">
      <td style="padding:6px 8px"><b>${r.name}</b></td>
      <td style="padding:6px 8px;font-size:11px">${r.address.slice(0, 12)}…</td>
      <td data-c="bal" style="padding:6px 8px">…</td>
      <td data-c="price" style="padding:6px 8px">…</td>
      <td style="padding:6px 8px;white-space:nowrap">
        <input id="oc-rp-${i}" type="number" style="width:90px;padding:4px;border-radius:6px;background:#0d0f15;color:var(--text);border:1px solid var(--border)" placeholder="价格">
        <button class="act ghost" data-rp="${i}" style="padding:4px 10px;font-size:12px">报价</button>
      </td>
    </tr>`).join("");
  box.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px">
    <tr style="color:var(--dim,#8b93a7);text-align:left">
      <th style="padding:4px 8px">数据源</th><th style="padding:4px 8px">地址</th>
      <th style="padding:4px 8px">ETH</th><th style="padding:4px 8px">最新报价</th><th style="padding:4px 8px">手动报价</th>
    </tr>${rows}</table>`;
  box.querySelectorAll("button[data-rp]").forEach((b) => {
    b.onclick = () => oracleManualReport(Number(b.dataset.rp));
  });
  // 逐行链上只读：ETH 余额 + 该数据源在合约里的最新报价
  const enc = window.ethers.AbiCoder.defaultAbiCoder();
  for (let i = 0; i < rs.length; i++) {
    const tr = box.querySelector(`tr[data-i="${i}"]`);
    try {
      const balHex = await rpc("eth_getBalance", [rs[i].address, "latest"]);
      tr.querySelector('[data-c="bal"]').textContent = window.ethers.formatEther(BigInt(balHex));
    } catch { tr.querySelector('[data-c="bal"]').textContent = "?"; }
    try {
      let priceTxt = "未报价";
      if (orc) {
        const ret = await rpc("eth_call", [{
          to: orc,
          data: oSEL.priceOf() + enc.encode(["address"], [rs[i].address]).slice(2),
        }, "latest"]);
        const v = BigInt(ret === "0x" ? 0 : ret);
        if (v > 0n) priceTxt = window.ethers.formatEther(v);
      }
      tr.querySelector('[data-c="price"]').textContent = priceTxt;
    } catch { tr.querySelector('[data-c="price"]').textContent = "?"; }
  }
}

async function oracleManualReport(i) {
  const rs = getReporters();
  const val = Number($("oc-rp-" + i).value);
  if (!(val > 0)) return log("请填写有效报价", "err");
  try {
    await reportAs(rs[i], val, `${rs[i].name} 手动报价 ${val}`);
    refreshOracle();
  } catch (e) {
    log("❌ 报价失败: " + (e.shortMessage || e.message), "err");
  }
}

// 只读刷新：轮次、聚合价、待聚合中位数、借贷市场价
async function refreshOracle() {
  const orc = oracleAddr();
  const { formatEther } = window.ethers;
  if (!orc) {
    $("orc-info").textContent = "尚未部署。模型：多个数据源各自报价 → 合约排序取中位数 → 报价数达标才上链新轮次。";
    return;
  }
  $("orc-info").textContent = "预言机合约: " + orc;
  try {
    const callO = (data) => rpc("eth_call", [{ to: orc, data }, "latest"]);
    const rid = BigInt(await callO(oSEL.roundId()));
    const ans = BigInt(await callO(oSEL.latestAnswer()));
    const ts = BigInt(await callO(oSEL.latestTimestamp()));
    $("oc-round").value = rid.toString();
    $("oc-answer").value = formatEther(ans);
    $("oc-oracle-price2").value = formatEther(ans);
    $("oc-time").value = new Date(Number(ts) * 1000).toLocaleTimeString();
    try {
      const enc = window.ethers.AbiCoder.defaultAbiCoder();
      const ret = await callO(oSEL.pendingMedian());
      const [med, n] = enc.decode(["uint256", "uint256"], ret); // 注意：原样传入，勿剥 0x（踩坑 8）
      $("oc-pending").value = `${formatEther(med)} / ${n} 个报价`;
    } catch {
      $("oc-pending").value = "暂无有效报价";
    }
    // 关联借贷市场价
    const token = $("orc-lend-token") ? $("orc-lend-token").value : "";
    const pool = token && getLendPool(token);
    const priceInput = $("oc-lend-price");
    if (pool) {
      const pSel = window.ethers.id("price()").slice(0, 10);
      const p = BigInt(await rpc("eth_call", [{ to: pool, data: pSel }, "latest"]));
      priceInput.value = formatEther(p);
    } else {
      priceInput.value = "该代币未部署借贷市场";
    }
  } catch (e) {
    log("刷新预言机状态失败: " + (e.shortMessage || e.message), "err");
  }
  renderReporters();
}

function renderOracleTokens() {
  const list = JSON.parse(localStorage.getItem(KEY) || "[]");
  const sel = $("orc-lend-token");
  const cur = sel.value;
  sel.innerHTML = "";
  for (const t of list) {
    const opt = document.createElement("option");
    opt.value = t.address;
    opt.textContent = `${t.name} (${t.symbol})`;
    sel.appendChild(opt);
  }
  if (cur && list.some((t) => t.address === cur)) sel.value = cur;
}

// ── DeFi 乐高（LP 抵押借贷金库 LabLego）────────────────
let legoData = null; // /lego 模板
const legoKey = (token) => "lab.lego." + token;
const getLegoVault = (token) => localStorage.getItem(legoKey(token)) || "";
const borrowerKey = (token) => "lab.lego.borrower." + token;

const gSEL = { // 选择器现算
  fund: () => window.ethers.id("fund(uint256)").slice(0, 10),
  stakeLiquidity: () => window.ethers.id("stakeLiquidity(uint256)").slice(0, 10),
  unstake: () => window.ethers.id("unstake(uint256)").slice(0, 10),
  borrow: () => window.ethers.id("borrow(uint256)").slice(0, 10),
  repay: () => window.ethers.id("repay(uint256)").slice(0, 10),
  liquidate: () => window.ethers.id("liquidate(address)").slice(0, 10),
  lpCollateral: () => window.ethers.id("lpCollateral(address)").slice(0, 10),
  principalOf: () => window.ethers.id("principalOf(address)").slice(0, 10),
  debtOf: () => window.ethers.id("debtOf(address)").slice(0, 10),
  maxBorrow: () => window.ethers.id("maxBorrow(address)").slice(0, 10),
  healthFactor: () => window.ethers.id("healthFactor(address)").slice(0, 10),
  tokenPool: () => window.ethers.id("tokenPool()").slice(0, 10),
  lpValue: () => window.ethers.id("lpValue(address)").slice(0, 10),
};
const TOKEN_TRANSFER = "0xa9059cbb"; // transfer(address,uint256) 稳定选择器

// 部署金库（token, amm, oracle, rate=每秒1%演示）→ approve → fund
async function legoSetup() {
  if (!wallet) return log("请先加载账户", "err");
  const token = $("lg-token").value;
  const fundAmt = Number($("lg-fund").value);
  const amm = getAmmPool(token);
  const orc = oracleAddr();
  if (!token) return log("请选择代币", "err");
  if (!amm) return log("该代币还没有 AMM 池，请先到 DEX 页建池", "err");
  if (!orc) return log("请先到预言机页部署预言机", "err");
  if (!(fundAmt > 0)) return log("请填写注入资金", "err");
  const btn = $("btn-lg-setup");
  btn.disabled = true;
  try {
    let vault = getLegoVault(token);
    if (!vault) {
      const enc = window.ethers.AbiCoder.defaultAbiCoder();
      const ctor = enc.encode(
        ["address", "address", "address", "uint256"],
        [token, amm, orc, window.ethers.parseEther("0.01")]);
      const hash = await sendSigned({
        data: legoData.bytecode + ctor.slice(2),
        gasLimit: legoData.gasLimit, gasPrice: legoData.gasPrice,
      });
      recordTx(hash, "部署乐高金库 LabLego");
      log("部署金库交易已广播，等待出块…");
      const rc = await waitReceipt(hash);
      const ok = Number(rc.status) === 1;
      settleTx(hash, ok, Number(rc.blockNumber));
      if (!ok) throw new Error("金库部署回执 status=0");
      localStorage.setItem(legoKey(token), rc.contractAddress);
      vault = rc.contractAddress;
      log(`✅ 金库部署成功: ${vault}（区块 ${Number(rc.blockNumber)}）`, "ok");
    } else {
      log(`复用已有金库 ${vault}，直接补注入资金`);
    }
    log(`注入可借资金 ${fundAmt}（approve → fund）…`);
    await erc20Approve(token, vault, fundAmt, "授权金库扣款");
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const data = gSEL.fund() + enc.encode(["uint256"], [window.ethers.parseUnits(String(fundAmt))]).slice(2);
    const hash = await sendSigned({ to: vault, data, gasLimit: "500000", gasPrice: "1000000000" });
    recordTx(hash, `金库注入 ${fundAmt}`);
    const rc = await waitReceipt(hash);
    settleTx(hash, Number(rc.status) === 1, Number(rc.blockNumber));
    if (Number(rc.status) !== 1) throw new Error("fund 回执 status=0");
    log(`✅ 可借资金注入完成（区块 ${Number(rc.blockNumber)}）`, "ok");
    refreshLego();
  } catch (e) {
    log("❌ 部署/注入失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

// 质押流动性：approve maxToken → stakeLiquidity{value:eth}(maxToken)
async function legoStake() {
  if (!wallet) return log("请先加载账户", "err");
  const token = $("lg-token").value;
  const vault = getLegoVault(token);
  if (!vault) return log("请先部署金库", "err");
  const ethAmt = Number($("lg-eth").value);
  const maxToken = Number($("lg-maxtoken").value);
  if (!(ethAmt > 0) || !(maxToken > 0)) return log("请填写 ETH 与代币上限", "err");
  const btn = $("btn-lg-stake");
  btn.disabled = true;
  try {
    await erc20Approve(token, vault, maxToken, "授权金库代拉代币");
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const data = gSEL.stakeLiquidity() + enc.encode(["uint256"], [window.ethers.parseUnits(String(maxToken))]).slice(2);
    log(`质押流动性 ${ethAmt} ETH + ≤${maxToken} 代币（金库代向 AMM 建仓）…`);
    const hash = await sendSigned({
      to: vault, data, gasLimit: "1500000", gasPrice: "1000000000",
      value: window.ethers.parseEther(String(ethAmt)),
    });
    recordTx(hash, `质押流动性 ${ethAmt} ETH`);
    const rc = await waitReceipt(hash);
    settleTx(hash, Number(rc.status) === 1, Number(rc.blockNumber));
    if (Number(rc.status) !== 1) throw new Error("stakeLiquidity 回执 status=0（代币不足/滑点？）");
    log(`✅ LP 已锁入金库（区块 ${Number(rc.blockNumber)}）`, "ok");
    refreshLego();
    refreshBalance();
  } catch (e) {
    log("❌ 质押失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

async function legoBorrow() {
  if (!wallet) return log("请先加载账户", "err");
  const token = $("lg-token").value;
  const vault = getLegoVault(token);
  if (!vault) return log("请先部署金库", "err");
  const amt = Number($("lg-borrow-amt").value);
  if (!(amt > 0)) return log("请填写借款数量", "err");
  const btn = $("btn-lg-borrow");
  btn.disabled = true;
  try {
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const data = gSEL.borrow() + enc.encode(["uint256"], [window.ethers.parseUnits(String(amt))]).slice(2);
    const hash = await sendSigned({ to: vault, data, gasLimit: "500000", gasPrice: "1000000000" });
    recordTx(hash, `金库借款 ${amt}`);
    const rc = await waitReceipt(hash);
    settleTx(hash, Number(rc.status) === 1, Number(rc.blockNumber));
    if (Number(rc.status) !== 1) throw new Error("borrow 回执 status=0（超出购买力/池子空？）");
    log(`✅ 借款到账，开始按秒计息（区块 ${Number(rc.blockNumber)}）`, "ok");
    refreshLego();
  } catch (e) {
    log("❌ 借款失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

async function legoRepay() {
  if (!wallet) return log("请先加载账户", "err");
  const token = $("lg-token").value;
  const vault = getLegoVault(token);
  if (!vault) return log("请先部署金库", "err");
  const btn = $("btn-lg-repay");
  btn.disabled = true;
  try {
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const ret = await rpc("eth_call", [{
      to: vault, data: gSEL.debtOf() + enc.encode(["address"], [wallet.address]).slice(2),
    }, "latest"]);
    const debt = BigInt(ret === "0x" ? 0 : ret);
    if (debt === 0n) return log("没有欠款", "err");
    const repayAmt = debt * 2n; // 出块期间利息在涨，2 倍超额授权+还款
    log(`当前债务 ${window.ethers.formatEther(debt)}，超额授权并还款…`);
    await erc20Approve(token, vault, window.ethers.formatEther(repayAmt), "授权金库扣款");
    const data = gSEL.repay() + enc.encode(["uint256"], [repayAmt]).slice(2);
    const hash = await sendSigned({ to: vault, data, gasLimit: "500000", gasPrice: "1000000000" });
    recordTx(hash, "还清金库借款");
    const rc = await waitReceipt(hash);
    settleTx(hash, Number(rc.status) === 1, Number(rc.blockNumber));
    if (Number(rc.status) !== 1) throw new Error("repay 回执 status=0（利息又涨了？重试即可）");
    log(`✅ 还清成功（区块 ${Number(rc.blockNumber)}）`, "ok");
    refreshLego();
  } catch (e) {
    log("❌ 还款失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

async function legoUnstake() {
  if (!wallet) return log("请先加载账户", "err");
  const token = $("lg-token").value;
  const vault = getLegoVault(token);
  if (!vault) return log("请先部署金库", "err");
  const btn = $("btn-lg-unstake");
  btn.disabled = true;
  try {
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const ret = await rpc("eth_call", [{
      to: vault, data: gSEL.lpCollateral() + enc.encode(["address"], [wallet.address]).slice(2),
    }, "latest"]);
    const lp = BigInt(ret === "0x" ? 0 : ret);
    if (lp === 0n) return log("没有抵押 LP", "err");
    log(`撤出全部 LP ${window.ethers.formatEther(lp)}（AMM 换回 ETH+代币）…`);
    const data = gSEL.unstake() + enc.encode(["uint256"], [lp]).slice(2);
    const hash = await sendSigned({ to: vault, data, gasLimit: "800000", gasPrice: "1000000000" });
    recordTx(hash, "撤出 LP");
    const rc = await waitReceipt(hash);
    settleTx(hash, Number(rc.status) === 1, Number(rc.blockNumber));
    if (Number(rc.status) !== 1) throw new Error("unstake 回执 status=0（还有未还债务？）");
    log(`✅ LP 已撤出，ETH+代币回到钱包（区块 ${Number(rc.blockNumber)}）`, "ok");
    refreshLego();
    refreshBalance();
  } catch (e) {
    log("❌ 撤出失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

// 一键准备借款人：随机账户 → dev 转 gas/代币 → 借款人 approve → 质押 → 借到购买力 60%
async function legoMakeBorrower() {
  if (!wallet) return log("请先加载账户", "err");
  const token = $("lg-token").value;
  const vault = getLegoVault(token);
  if (!vault) return log("请先部署金库", "err");
  const btn = $("btn-lg-makeborrower");
  btn.disabled = true;
  try {
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const { parseEther, parseUnits, formatEther } = window.ethers;
    const bw = window.ethers.Wallet.createRandom();
    const rec = { name: "借款人", address: bw.address, pk: bw.privateKey };
    // 1) dev 转 ETH：0.1 是质押本金（addLiquidity 要自带 ETH），0.05 留作各笔 gas
    log(`生成借款人 ${bw.address.slice(0, 10)}…，转入 0.15 ETH（0.1 质押 + 0.05 gas）…`);
    let h = await sendSigned({ to: bw.address, value: parseEther("0.15"), gasLimit: "21000" });
    recordTx(h, "给借款人转 ETH（本金+gas）");
    let rc = await waitReceipt(h);
    settleTx(h, Number(rc.status) === 1, Number(rc.blockNumber));
    // 2) dev 转 220 代币
    log("向借款人转 220 代币…");
    h = await sendSigned({
      to: token,
      data: TOKEN_TRANSFER + enc.encode(["address", "uint256"], [bw.address, parseUnits("220")]).slice(2),
      gasLimit: "200000", gasPrice: "1000000000",
    });
    recordTx(h, "给借款人转 220 代币");
    rc = await waitReceipt(h);
    settleTx(h, Number(rc.status) === 1, Number(rc.blockNumber));
    // 3) 借款人 approve 金库
    log("借款人 approve 金库…");
    h = await sendSigned({
      to: token,
      data: "0x095ea7b3" + enc.encode(["address", "uint256"], [vault, parseUnits("220")]).slice(2),
      gasLimit: "200000", gasPrice: "1000000000",
    }, bw);
    recordTx(h, "借款人 approve");
    rc = await waitReceipt(h);
    settleTx(h, Number(rc.status) === 1, Number(rc.blockNumber));
    // 4) 借款人质押 0.1 ETH
    log("借款人质押 0.1 ETH 流动性…");
    h = await sendSigned({
      to: vault,
      data: gSEL.stakeLiquidity() + enc.encode(["uint256"], [parseUnits("220")]).slice(2),
      gasLimit: "1500000", gasPrice: "1000000000", value: parseEther("0.1"),
    }, bw);
    recordTx(h, "借款人质押流动性");
    rc = await waitReceipt(h);
    settleTx(h, Number(rc.status) === 1, Number(rc.blockNumber));
    if (Number(rc.status) !== 1) throw new Error("借款人质押失败");
    // 5) 读最大可借，借 60%（留出利息恶化空间，约 70 秒后健康度破 1）
    const ret = await rpc("eth_call", [{
      to: vault, data: gSEL.maxBorrow() + enc.encode(["address"], [bw.address]).slice(2),
    }, "latest"]);
    const maxB = BigInt(ret === "0x" ? 0 : ret);
    const borrowAmt = maxB * 60n / 100n;
    log(`借款人最大可借 ${formatEther(maxB)}，借出 60% = ${formatEther(borrowAmt)}…`);
    h = await sendSigned({
      to: vault,
      data: gSEL.borrow() + enc.encode(["uint256"], [borrowAmt]).slice(2),
      gasLimit: "500000", gasPrice: "1000000000",
    }, bw);
    recordTx(h, `借款人借出 ${formatEther(borrowAmt)}`);
    rc = await waitReceipt(h);
    settleTx(h, Number(rc.status) === 1, Number(rc.blockNumber));
    if (Number(rc.status) !== 1) throw new Error("借款人借款失败");
    localStorage.setItem(borrowerKey(token), JSON.stringify(rec));
    $("lg-liq-target").value = bw.address;
    log(`✅ 借款人就位（区块 ${Number(rc.blockNumber)}），等约 70 秒利息涨过健康度 1 后可清算`, "ok");
    refreshLego();
  } catch (e) {
    log("❌ 准备借款人失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

// 清算：读目标债务 → approve 2 倍 → liquidate
async function legoLiquidate() {
  if (!wallet) return log("请先加载账户", "err");
  const token = $("lg-token").value;
  const vault = getLegoVault(token);
  if (!vault) return log("请先部署金库", "err");
  const target = "0x" + ($("lg-liq-target").value || "").trim().toLowerCase().replace(/^0x/, "");
  if (!/^0x[0-9a-f]{40}$/.test(target)) return log("清算目标地址不合法", "err");
  const btn = $("btn-lg-liquidate");
  btn.disabled = true;
  try {
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const ret = await rpc("eth_call", [{
      to: vault, data: gSEL.debtOf() + enc.encode(["address"], [target]).slice(2),
    }, "latest"]);
    const debt = BigInt(ret === "0x" ? 0 : ret);
    if (debt === 0n) return log("目标没有债务", "err");
    log(`目标债务 ${window.ethers.formatEther(debt)}，授权并清算…`);
    await erc20Approve(token, vault, window.ethers.formatEther(debt * 2n), "授权金库清算扣款");
    const data = gSEL.liquidate() + enc.encode(["address"], [target]).slice(2);
    const hash = await sendSigned({ to: vault, data, gasLimit: "800000", gasPrice: "1000000000" });
    recordTx(hash, `清算 ${target.slice(0, 10)}…`);
    const rc = await waitReceipt(hash);
    settleTx(hash, Number(rc.status) === 1, Number(rc.blockNumber));
    if (Number(rc.status) !== 1) throw new Error("liquidate 回执 status=0（目标仍健康/已穿仓？）");
    log(`✅ 清算成功（区块 ${Number(rc.blockNumber)}），折扣 LP 已划入当前账户，可点"撤出全部 LP"变现`, "ok");
    refreshLego();
  } catch (e) {
    log("❌ 清算失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

// 只读刷新
async function refreshLego() {
  const sel = $("lg-token");
  const token = sel ? sel.value : "";
  if (!token) return;
  const vault = getLegoVault(token);
  const amm = getAmmPool(token);
  $("lg-amm").value = amm || "该代币未建池";
  if (!vault) {
    $("lg-info").textContent = "尚未部署。前置：该代币已有 AMM 池（DEX 页建池）且预言机已部署。";
    return;
  }
  $("lg-info").textContent = "金库合约: " + vault;
  const enc = window.ethers.AbiCoder.defaultAbiCoder();
  const { formatEther } = window.ethers;
  try {
    const callV = (sel2, arg) => rpc("eth_call", [{
      to: vault,
      data: sel2 + (arg ? enc.encode(["address"], [arg]).slice(2) : ""),
    }, "latest"]);
    const lp = BigInt(await callV(gSEL.lpCollateral(), wallet.address));
    const prin = BigInt(await callV(gSEL.principalOf(), wallet.address));
    const debt = BigInt(await callV(gSEL.debtOf(), wallet.address));
    const maxB = BigInt(await callV(gSEL.maxBorrow(), wallet.address));
    const hf = BigInt(await callV(gSEL.healthFactor(), wallet.address));
    const tp = BigInt(await callV(gSEL.tokenPool(), null));
    const vRet = await callV(gSEL.lpValue(), wallet.address);
    const [ethPart, tokPart, valueToken] = enc.decode(["uint256", "uint256", "uint256"], vRet);
    $("lg-lp").value = formatEther(lp);
    $("lg-value").value = `${formatEther(ethPart)} ETH + ${formatEther(tokPart)} = ${formatEther(valueToken)}`;
    $("lg-prin").value = formatEther(prin);
    $("lg-debt").value = formatEther(debt);
    $("lg-health").value = hf === 2n ** 256n - 1n ? "∞（无债务）" : (Number(hf) / 1e18).toFixed(4);
    $("lg-max").value = `${formatEther(maxB)} / 池 ${formatEther(tp)}`;
    // 清算目标健康度
    const target = ($("lg-liq-target").value || "").trim();
    if (/^0x[0-9a-f]{40}$/i.test(target)) {
      const thf = BigInt(await callV(gSEL.healthFactor(), target));
      $("lg-liq-health").value = thf === 2n ** 256n - 1n ? "∞（无债务）" : (Number(thf) / 1e18).toFixed(4);
    } else {
      $("lg-liq-health").value = "—";
    }
  } catch (e) {
    log("刷新金库状态失败: " + (e.shortMessage || e.message), "err");
  }
}

function renderLegoTokens() {
  const list = JSON.parse(localStorage.getItem(KEY) || "[]");
  const sel = $("lg-token");
  const cur = sel.value;
  sel.innerHTML = "";
  for (const t of list) {
    const opt = document.createElement("option");
    opt.value = t.address;
    opt.textContent = `${t.name} (${t.symbol})`;
    sel.appendChild(opt);
  }
  if (cur && list.some((t) => t.address === cur)) sel.value = cur;
  // 恢复上次借款人地址
  const saved = localStorage.getItem(borrowerKey(sel.value));
  if (saved && !$("lg-liq-target").value) {
    $("lg-liq-target").value = JSON.parse(saved).address;
  }
}

// ════════════════════════════════════════════════════════════
// 模块 8：治理（ERC-20Votes + Governor + Timelock + Box）
// ════════════════════════════════════════════════════════════
let govData = null; // /governance 四个模板
const GOVKEY = "lab.gov";
const GOVVOTERKEY = "lab.gov.voters";
const getGov = () => JSON.parse(localStorage.getItem(GOVKEY) || "null");
// 治理页专属 signer 别名：隔离靠"选民按体系分 key 存"（坑 14）实现，
// 账户仍复用全局钱包
let govWallet = null;

// 选民按治理体系分 key 存：新体系 = 新选民，旧私钥绝不复用（坑 14）
const govVoterKey = () => {
  const g = getGov();
  return GOVVOTERKEY + "." + (g ? g.token.toLowerCase() : "none");
};
const getGovVoters = () => JSON.parse(localStorage.getItem(govVoterKey()) || "[]");
// 投票窗口缓冲：提案 deadline 必须覆盖"造选民 + 投赞成"所需区块数，
// 浏览器每笔确认约 30 秒，90 秒窗口不够 3 笔，用 600 保证课堂操作不踩线
const GOV_WINDOW = 600;
const GOV_STATE = ["Pending", "Active", "Canceled", "Defeated", "Succeeded", "Queued", "Expired", "Executed"];

const gvSEL = { // 选择器统一带 0x 前缀 + 现算（坑 12）
  balanceOf: () => "0x" + window.ethers.id("balanceOf(address)").slice(2, 10),
  transfer: () => "0x" + window.ethers.id("transfer(address,uint256)").slice(2, 10),
  delegate: () => "0x" + window.ethers.id("delegate(address)").slice(2, 10),
  currentVotes: () => "0x" + window.ethers.id("getCurrentVotes(address)").slice(2, 10),
  setAdmin: () => "0x" + window.ethers.id("setAdmin(address)").slice(2, 10),
  boxSetValue: () => "0x" + window.ethers.id("setValue(uint256)").slice(2, 10),
  boxValue: () => "0x" + window.ethers.id("value()").slice(2, 10),
  transferOwnership: () => "0x" + window.ethers.id("transferOwnership(address)").slice(2, 10),
  propose: () => "0x" + window.ethers.id("propose(address,uint256,bytes,string)").slice(2, 10),
  castVote: () => "0x" + window.ethers.id("castVote(uint256,uint8)").slice(2, 10),
  queue: () => "0x" + window.ethers.id("queue(uint256)").slice(2, 10),
  execute: () => "0x" + window.ethers.id("execute(uint256)").slice(2, 10),
  proposalCount: () => "0x" + window.ethers.id("proposalCount()").slice(2, 10),
  proposalHead: () => "0x" + window.ethers.id("proposalHead(uint256)").slice(2, 10),
  proposalVotes: () => "0x" + window.ethers.id("proposalVotes(uint256)").slice(2, 10),
  setVotingPeriod: () => "0x" + window.ethers.id("setVotingPeriod(uint256)").slice(2, 10),
};

async function gvCall(to, data) {
  const ret = await rpc("eth_call", [{ to, data }, "latest"]);
  return ret === "0x" || ret === undefined ? null : ret;
}

// 治理 signer：复用当前全局钱包（隔离靠"选民按治理体系分 key 存"实现，
// 不再引入独立注资账户——避免跨账户注资的时序与余额问题）
async function useGovWallet() {
  if (!wallet) { log("请先加载账户", "err"); return false; }
  govWallet = wallet;
  return true;
}

async function gvSend(to, data, gasLimit, signer = govWallet, value) {
  // 严格串行：先确认发签者内存池无待发交易，再取 nonce，避免同 nonce 替换（坑 10）
  if (signer.pendingHashes) {
    for (const h of signer.pendingHashes) await waitReceipt(h);
    signer.pendingHashes = [];
  }
  // 严重坑（坑 16）：这里曾漏传 signer——所有"选民签名"的交易实际都是
  // 全局钱包在签，导致部署者的票被 delegate 交易整个搬去选民名下。
  const hash = await sendSigned({ to, data, gasLimit: String(gasLimit), gasPrice: "1000000000", value }, signer);
  const rc = await waitReceipt(hash);
  if (Number(rc.status) !== 1) {
    // 失败后同 key 重放一次 eth_call，把 revert 原因带出（坑 13）
    const sim = await fetch(RPC_ABS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "eth_call",
        params: [{ from: signer.address, to, data, gas: "0x" + BigInt(gasLimit).toString(16) },
          "0x" + (BigInt(rc.blockNumber) - 1n).toString(16)],
      }),
    }).then((r) => r.json()).catch(() => null);
    throw new Error("交易回执 status=0" +
      (sim && sim.error ? "（" + (sim.error.message || "").slice(0, 140) + "）" : ""));
  }
  (signer.pendingHashes = signer.pendingHashes || []).push(hash);
  return { hash, rc };
}
async function gvDeploy(tpl, types, args, label) {
  const enc = window.ethers.AbiCoder.defaultAbiCoder();
  const ctor = types.length ? enc.encode(types, args).slice(2) : "";
  const hash = await sendSigned({ data: tpl.bytecode + ctor, gasLimit: tpl.gasLimit, gasPrice: tpl.gasPrice }, govWallet);
  recordTx(hash, label);
  log(`  ${label} 已广播，等出块…`);
  const rc = await waitReceipt(hash);
  settleTx(hash, Number(rc.status) === 1, Number(rc.blockNumber));
  if (Number(rc.status) !== 1) throw new Error(label + " 部署 status=0");
  log(`  ✅ ${label}: ${rc.contractAddress}（区块 ${Number(rc.blockNumber)}）`, "ok");
  return rc.contractAddress;
}

// 一键部署：VoteToken → Box → Timelock → Governor → 换手 → Box 交权 → 自委托
async function govSetup() {
  const btn = $("btn-gv-setup");
  btn.disabled = true;
  try {
    if (!govWallet && !(await useGovWallet())) return;
    localStorage.removeItem(GOVKEY);
    localStorage.setItem(GOVKEY + ".setup", String(Math.floor(Date.now() / 1000)));
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const { parseUnits, parseEther } = window.ethers;
    const gw = govWallet.address;
    const tName = $("gv-tname").value.trim() || "Governance Token";
    const tSym = $("gv-tsym").value.trim().toUpperCase() || "GOV";
    const supply = parseUnits(String(Number($("gv-tsupply").value) || 1000000));
    const period = BigInt(Math.max(15, Number($("gv-period").value) || 90));
    const quorum = parseUnits(String(Number($("gv-quorum").value) || 1000));
    const delay = BigInt(Math.max(0, Number($("gv-delay").value) || 30));

    log("开始部署治理体系（6 笔交易 + 1 次出块等待，约 2 分钟）…");
    const token = await gvDeploy(govData.token,
      ["string", "string", "uint256", "address"],
      [tName, tSym, supply, gw], "投票代币 LabVoteToken");
    log("  ⏳ 等一个出块周期（提案快照取 block-1，需让铸币票检查点成为历史）…");
    await new Promise((r2) => setTimeout(r2, 17000));
    const box = await gvDeploy(govData.box, [], [], "受控资产 LabBox");
    const timelock = await gvDeploy(govData.timelock,
      ["address", "uint256"], [gw, delay], "时间锁 LabTimelock");
    const governor = await gvDeploy(govData.governor,
      ["address", "address", "uint256", "uint256", "uint256"],
      [token, timelock, period, quorum, parseEther("1")], "治理合约 LabGovernor");

    log("权限交接：Timelock 管理员 → Governor…");
    let r = await gvSend(timelock,
      gvSEL.setAdmin() + enc.encode(["address"], [governor]).slice(2), 300000);
    settleTx(r.hash, true, Number(r.rc.blockNumber));
    log("Box 所有权 → Timelock（此后只有治理提案能改 Box）…");
    r = await gvSend(box,
      gvSEL.transferOwnership() + enc.encode(["address"], [timelock]).slice(2), 300000);
    settleTx(r.hash, true, Number(r.rc.blockNumber));

    // 铸币时票已记在部署者头上（delegate=0 票在己），无需再发 delegate 交易。
    // 注意：绝不能在这里给"他人"发 delegate——那会把部署者的票整个搬走（坑 14）

    localStorage.setItem(GOVKEY, JSON.stringify({ token, box, timelock, governor }));
    log("✅ 治理体系就位：提案→投票→排队→延迟→执行 全链路可用", "ok");
    renderGov();
    refreshGov();
  } catch (e) {
    log("❌ 治理体系部署失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

function renderGov() {
  const g = getGov();
  if (!g) return;
  $("gv-info").textContent = `VoteToken ${g.token}｜Governor ${g.governor}｜Timelock ${g.timelock}｜Box ${g.box}`;
  $("gv-target").value = g.box;
}

async function refreshGov() {
  const g = getGov();
  if (!g || !govWallet) return;
  const enc = window.ethers.AbiCoder.defaultAbiCoder();
  const arg = enc.encode(["address"], [govWallet.address]).slice(2);
  try {
    const balR = await gvCall(g.token, gvSEL.balanceOf() + arg);
    const voteR = await gvCall(g.token, gvSEL.currentVotes() + arg);
    $("gv-bal").value = balR ? window.ethers.formatEther(BigInt(balR)) : "0";
    $("gv-votes").value = voteR ? window.ethers.formatEther(BigInt(voteR)) : "0";
  } catch (e) {
    log("读取投票权失败: " + e.message, "err");
  }
  // 提案
  const countR = await gvCall(g.governor, gvSEL.proposalCount());
  const count = countR ? Number(BigInt(countR)) : 0;
  if (!$("gv-pid").value) $("gv-pid").value = String(count || 1);
  const id = Number($("gv-pid").value) || count;
  if (id > 0 && id <= count) {
    const idArg = enc.encode(["uint256"], [BigInt(id)]).slice(2);
    const [h, v] = await Promise.all([
      gvCall(g.governor, gvSEL.proposalHead() + idArg),
      gvCall(g.governor, gvSEL.proposalVotes() + idArg),
    ]);
    const [, target, val, snap, deadline] = enc.decode(["address", "address", "uint256", "uint256", "uint256"], h);
    // proposalVotes 返回 (uint forVotes, uint againstVotes, uint abstainVotes, uint8 state, bool queued, bool executed)
    const [fv, av, sv, stateRaw, queued, executed] = enc.decode(
      ["uint256", "uint256", "uint256", "uint256", "bool", "bool"], v);
    // 注意：state 是 uint8（1 字节槽），AbiCoder 原样解码；queued/executed 单独取
    const stn = Number(stateRaw);
    void queued; void executed;
    $("gv-state").value = `#${id} ${GOV_STATE[stn] || "?"}（链上状态码 ${stn}）`;
    $("gv-tally").value = `${window.ethers.formatEther(fv)} / ${window.ethers.formatEther(av)} / ${window.ethers.formatEther(sv)}`;
    const headBlk = Number(BigInt(await rpcOnce("eth_blockNumber")));
    const left = Number(deadline) - Math.floor(Date.now() / 1000);
    $("gv-snap").value = `区块 ${snap}（链头 ${headBlk}）｜ ${left > 0 ? "距截止 " + left + " 秒" : "已截止"}｜目标 ${target.slice(0, 10)}…`;
  } else {
    $("gv-state").value = count === 0 ? "尚无提案" : "ID 超范围";
    $("gv-tally").value = "—";
    $("gv-snap").value = "—";
  }
  const boxR = await gvCall(g.box, gvSEL.boxValue());
  $("gv-newval").placeholder = boxR ? "当前 " + window.ethers.formatEther(BigInt(boxR)) : "";
  const voters = getGovVoters();
  if (voters.length) $("gv-voters-info").textContent = "选民地址：" + voters.map((v) => v.address.slice(0, 10) + "…").join("、");
}

// 注意：不提供"手动自委托"按钮。铸币时票已记在部署者头上（delegate==0 票在己），
// 该按钮曾把目标地址填错导致部署者的票整个被搬去选民名下（坑 14）。

// 准备 2 个选民：治理账户转 gas+5000 GOV，各自自委托（新体系必须新选民——
// 旧私钥对新合约 delegate 会把自己的票搬去旧地址，坑 14，所以选民按体系分 key 存）
async function govMakeVoters() {
  const g = getGov();
  if (!g) return log("请先部署治理体系", "err");
  if (!govWallet) { await useGovWallet(); if (!govWallet) return; }
  const btn = $("btn-gv-voters");
  btn.disabled = true;
  try {
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const { parseEther, parseUnits } = window.ethers;
    const setupAt = Number(localStorage.getItem(GOVKEY + ".setup") || 0);
    const age = Math.floor(Date.now() / 1000) - setupAt;
    if (setupAt && age > GOV_WINDOW - 90) {
      log(`⏳ 距部署已过 ${age} 秒，自动补一个投票窗口…`);
      await gvSend(g.governor,
        gvSEL.setVotingPeriod() + enc.encode(["uint256"], [BigInt(GOV_WINDOW)]).slice(2), 200000);
    }
    const old = getGovVoters(); // 追加模式：保留已有选民
    const voters = old.slice();
    const need = 2 - old.length;
    if (need <= 0) { log("✅ 已有 2 个选民，无需再造"); return; }
    for (let i = 0; i < need; i++) {
      // 局部变量不能叫 w——页面全局 w 是 ethers（历史遗留同名），
      // 同名局部 const 在函数提升/遮蔽下曾导致 Wallet 构造异常（坑 15）
      const vw = window.ethers.Wallet.createRandom();
      log(`准备选民 ${i + 1}/${need} ${vw.address.slice(0, 10)}…：转 gas…`);
      let r = await gvSend(vw.address, "0x", 21000, govWallet, parseEther("0.03"));
      settleTx(r.hash, true, Number(r.rc.blockNumber));
      log("转 5000 GOV…");
      r = await gvSend(g.token,
        gvSEL.transfer() + enc.encode(["address", "uint256"], [vw.address, parseUnits("5000")]).slice(2), 200000);
      settleTx(r.hash, true, Number(r.rc.blockNumber));
      log("选民自委托…");
      r = await gvSend(g.token,
        gvSEL.delegate() + enc.encode(["address"], [vw.address]).slice(2), 300000, vw);
      settleTx(r.hash, true, Number(r.rc.blockNumber));
      voters.push({ address: vw.address, pk: vw.privateKey });
      // 每造好一个立即落盘，中断也不丢
      localStorage.setItem(govVoterKey(), JSON.stringify(voters));
    }
    $("gv-voters-info").textContent = "选民地址：" + voters.map((v) => v.address.slice(0, 10) + "…").join("、");
    log(`✅ 选民共 ${voters.length} 个就位（各持 5000 票）`, "ok");
    refreshGov();
  } catch (e) {
    log("❌ 准备选民失败: " + (e.shortMessage || e.message), "err");
  } finally {
    btn.disabled = false;
  }
}

// 提交提案：Box.setValue(newVal)
async function govPropose() {
  const g = getGov();
  if (!g) return log("请先部署治理体系", "err");
  const newVal = Number($("gv-newval").value);
  const desc = $("gv-desc").value.trim() || "governance proposal";
  if (!(newVal >= 0)) return log("请填写 Box 新值", "err");
  const enc = window.ethers.AbiCoder.defaultAbiCoder();
  try {
    const actionData = gvSEL.boxSetValue() + enc.encode(["uint256"], [window.ethers.parseUnits(String(newVal))]).slice(2);
    const data = gvSEL.propose() + enc.encode(
      ["address", "uint256", "bytes", "string"], [g.box, 0n, actionData, desc]).slice(2);
    // 提案前只读预检：revert 原因直接展示（0x08c379a0 后是 Error(string)）
    const sim = await fetch(RPC_ABS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "eth_call",
        params: [{ from: govWallet.address, to: g.governor, data, gas: "0xDBBA0" }, "latest"],
      }),
    }).then((r) => r.json());
    if (sim.error) {
      const d = sim.error.data || "";
      let reason = sim.error.message || "";
      try {
        if (typeof d === "string" && d.startsWith("0x08c379a0")) {
          reason = window.ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + d.slice(10))[0];
        }
      } catch { /* 保留原始 message */ }
      throw new Error("预检失败: " + reason);
    }
    const { hash, rc } = await gvSend(g.governor, data, 900000);
    recordTx(hash, "提交治理提案");
    settleTx(hash, true, Number(rc.blockNumber));
    const count = BigInt(await gvCall(g.governor, gvSEL.proposalCount()));
    $("gv-pid").value = String(count);
    log(`✅ 提案 #${count} 已创建（区块 ${Number(rc.blockNumber)}），投票窗口开始`, "ok");
    refreshGov();
  } catch (e) { log("❌ 提案失败: " + (e.shortMessage || e.message), "err"); }
}

async function govVote(support) {
  const g = getGov();
  if (!g) return log("请先部署治理体系", "err");
  const id = BigInt(Number($("gv-pid").value) || 0);
  if (!id) return log("请填写提案 ID", "err");
  const enc = window.ethers.AbiCoder.defaultAbiCoder();
  try {
    const { hash, rc } = await gvSend(g.governor,
      gvSEL.castVote() + enc.encode(["uint256", "uint8"], [id, support]).slice(2), 400000);
    recordTx(hash, support === 1 ? "投赞成" : support === 0 ? "投反对" : "投弃权");
    settleTx(hash, true, Number(rc.blockNumber));
    log(`✅ 投票成功（区块 ${Number(rc.blockNumber)}）`, "ok");
    refreshGov();
  } catch (e) { log("❌ 投票失败: " + (e.shortMessage || e.message), "err"); }
}

// 两个选民各自投赞成（带提案时刻的快照票，提前校验快照票>0 才发交易）
async function govVotersVote() {
  const g = getGov();
  if (!g) return log("请先部署治理体系", "err");
  const voters = getGovVoters();
  if (voters.length < 2) return log("请先一键准备 2 个选民", "err");
  const id = BigInt(Number($("gv-pid").value) || 0);
  const enc = window.ethers.AbiCoder.defaultAbiCoder();
  try {
    const headR = await gvCall(g.governor, gvSEL.proposalHead() + enc.encode(["uint256"], [id]).slice(2));
    const hh = enc.decode(["address", "address", "uint256", "uint256", "uint256"], headR);
    const snapBlk = hh[3];
    for (let i = 0; i < voters.length; i++) {
      const w = new window.ethers.Wallet(voters[i].pk);
      const pvR = await gvCall(g.token,
        window.ethers.id("getPriorVotes(address,uint256)").slice(0, 10) +
        enc.encode(["address", "uint256"], [w.address, snapBlk]).slice(2));
      const pv = pvR ? BigInt(pvR) : 0n;
      if (pv === 0n) {
        log(`  选民 ${i + 1} 在快照区块 ${snapBlk} 票数为 0（委托晚于提案），跳过`, "warn");
        continue;
      }
      log(`选民 ${i + 1} 投赞成（快照票 ${window.ethers.formatEther(pv)}）…`);
      const { hash, rc } = await gvSend(g.governor,
        gvSEL.castVote() + enc.encode(["uint256", "uint8"], [id, 1]).slice(2), 400000, w);
      settleTx(hash, true, Number(rc.blockNumber));
    }
    log("✅ 选民投票流程完成", "ok");
    refreshGov();
  } catch (e) { log("❌ 选民投票失败: " + (e.shortMessage || e.message), "err"); }
}

async function govQueue() {
  const g = getGov();
  if (!g) return log("请先部署治理体系", "err");
  const id = BigInt(Number($("gv-pid").value) || 0);
  const enc = window.ethers.AbiCoder.defaultAbiCoder();
  try {
    const { hash, rc } = await gvSend(g.governor,
      gvSEL.queue() + enc.encode(["uint256"], [id]).slice(2), 600000);
    recordTx(hash, `提案 #${id} 排入 Timelock`);
    settleTx(hash, true, Number(rc.blockNumber));
    log(`✅ 已排入 Timelock（区块 ${Number(rc.blockNumber)}），等待延迟到期后执行`, "ok");
    refreshGov();
  } catch (e) { log("❌ 排队失败: " + (e.shortMessage || e.message) + "（投票未结束/未达法定票数？）", "err"); }
}

async function govExecute() {
  const g = getGov();
  if (!g) return log("请先部署治理体系", "err");
  const id = BigInt(Number($("gv-pid").value) || 0);
  const enc = window.ethers.AbiCoder.defaultAbiCoder();
  try {
    const { hash, rc } = await gvSend(g.governor,
      gvSEL.execute() + enc.encode(["uint256"], [id]).slice(2), 700000);
    recordTx(hash, `执行提案 #${id}`);
    settleTx(hash, true, Number(rc.blockNumber));
    const boxR = await gvCall(g.box, gvSEL.boxValue());
    log(`✅ 提案执行成功（区块 ${Number(rc.blockNumber)}），Box 当前值 = ${window.ethers.formatEther(BigInt(boxR || "0x0"))}`, "ok");
    refreshGov();
  } catch (e) { log("❌ 执行失败: " + (e.shortMessage || e.message) + "（延迟未到/已过期？）", "err"); }
}

// 页签进入治理：自动就绪治理专属账户（注资走全局 dev 账户）
async function govTabEnter() {
  if (govWallet) return;
  await useGovWallet();
  refreshGov();
}

// ── 博彩（LabCasino：blockhash 延迟开奖） ──────────────────
const CSKEY = "lab.casino";
const getCs = () => JSON.parse(localStorage.getItem(CSKEY) || "null");
let csData = null; // /casino 模板

const csSEL = {
  bet: () => "0x" + window.ethers.id("bet(uint8,uint8)").slice(2, 10),
  reveal: () => "0x" + window.ethers.id("reveal(uint256)").slice(2, 10),
  betInfo: () => "0x" + window.ethers.id("betInfo(uint256)").slice(2, 10),
  houseBalance: () => "0x" + window.ethers.id("houseBalance()").slice(2, 10),
  totalBets: () => "0x" + window.ethers.id("totalBets()").slice(2, 10),
};

async function csDeploy() {
  const btn = $("btn-cs-deploy");
  btn.disabled = true;
  try {
    if (!wallet) { log("请先加载账户", "err"); return; }
    if (!csData) csData = await fetch("/casino").then((r) => r.json());
    const seed = window.ethers.parseEther(String(Number($("cs-seed").value) || 1.2));
    log("部署赌场（庄家注资 " + window.ethers.formatEther(seed) + " ETH）…");
    const hash = await sendSigned({ data: csData.bytecode, gasLimit: csData.gasLimit, gasPrice: csData.gasPrice });
    recordTx(hash, "部署链上赌场");
    log("  已广播，等出块…");
    const rc = await waitReceipt(hash);
    settleTx(hash, Number(rc.status) === 1, Number(rc.blockNumber));
    if (Number(rc.status) !== 1) throw new Error("部署 status=0");
    localStorage.setItem(CSKEY, JSON.stringify({ addr: rc.contractAddress }));
    // 部署成功后单独注资开池（receive() 直接进赌池）
    if (seed > 0n) {
      log("庄家注资 " + window.ethers.formatEther(seed) + " ETH 开池…");
      const h2 = await sendSigned({ to: rc.contractAddress, value: seed, gasLimit: "21000" });
      const rc2 = await waitReceipt(h2);
      settleTx(h2, Number(rc2.status) === 1, Number(rc2.blockNumber));
    }
    $("cs-info").textContent = "赌场地址：" + rc.contractAddress;
    log("✅ 赌场开业（区块 " + Number(rc.blockNumber) + "），下注后等 3 个区块开奖", "ok");
    refreshCasino();
  } catch (e) { log("❌ 赌场部署失败: " + (e.shortMessage || e.message), "err"); }
  finally { btn.disabled = false; }
}

async function csBet() {
  const c = getCs();
  if (!c) return log("请先部署赌场", "err");
  const amount = window.ethers.parseEther(String(Number($("cs-amount").value) || 0));
  const choice = Number($("cs-choice").value);
  const guess = Number($("cs-guess").value) || 0;
  if (amount < window.ethers.parseEther("0.01")) return log("最少 0.01 ETH", "err");
  const enc = window.ethers.AbiCoder.defaultAbiCoder();
  const btn = $("btn-cs-bet");
  btn.disabled = true;
  try {
    const { hash, rc } = await csSend(c.addr, csSEL.bet() + enc.encode(["uint8", "uint8"], [choice, guess]).slice(2), 300000, amount);
    recordTx(hash, "赌场下注");
    settleTx(hash, true, Number(rc.blockNumber));
    const n = BigInt(await csCall(c.addr, csSEL.totalBets()));
    $("cs-bid").value = String(n);
    log(`✅ 下注成功，注单 #${n}（区块 ${Number(rc.blockNumber)}），等 3 个区块后可开奖`, "ok");
    refreshCasino();
  } catch (e) { log("❌ 下注失败: " + (e.shortMessage || e.message), "err"); }
  finally { btn.disabled = false; }
}

async function csReveal() {
  const c = getCs();
  if (!c) return log("请先部署赌场", "err");
  const id = BigInt(Number($("cs-bid").value) || 0);
  if (!id) return log("请填写注单 ID", "err");
  const enc = window.ethers.AbiCoder.defaultAbiCoder();
  const btn = $("btn-cs-reveal");
  btn.disabled = true;
  try {
    // 预检：seed 未就绪直接提示，不浪费交易
    const info = await csBetInfo(c.addr, id);
    if (!info) return log("注单不存在", "err");
    if (info.revealed) return log(`注单 #${id} 已开过：${info.won ? "赢" : "输"}，点数 ${info.result}`, "warn");
    if (!info.canReveal) return log(`seed 区块 ${info.seedBlock} 还没成为历史（当前区块不够），再等等`, "warn");
    const { hash, rc } = await csSend(c.addr, csSEL.reveal() + enc.encode(["uint256"], [id]).slice(2), 300000);
    recordTx(hash, `开注单 #${id}`);
    settleTx(hash, true, Number(rc.blockNumber));
    const after = await csBetInfo(c.addr, id);
    log(after.won
      ? `🎉 注单 #${id} 开奖：点数 ${after.result}，赢了！彩金已打入账户`
      : `注单 #${id} 开奖：点数 ${after.result}，输了`, after.won ? "ok" : "");
    refreshCasino();
  } catch (e) { log("❌ 开奖失败: " + (e.shortMessage || e.message), "err"); }
  finally { btn.disabled = false; }
}

async function csCall(to, data) {
  const ret = await rpc("eth_call", [{ to, data }, "latest"]);
  return ret === "0x" || ret === undefined ? null : ret;
}
async function csSend(to, data, gasLimit, value) {
  const hash = await sendSigned({ to, data, gasLimit: String(gasLimit), gasPrice: "1000000000", value });
  const rc = await waitReceipt(hash);
  if (Number(rc.status) !== 1) {
    const sim = await fetch(RPC_ABS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "eth_call",
        params: [{ from: wallet.address, to, data, gas: "0x" + BigInt(gasLimit).toString(16), value: value ? "0x" + BigInt(value).toString(16) : undefined },
          "0x" + (BigInt(rc.blockNumber) - 1n).toString(16)],
      }),
    }).then((r) => r.json()).catch(() => null);
    throw new Error("交易回执 status=0" +
      (sim && sim.error ? "（" + (sim.error.message || "").slice(0, 140) + "）" : ""));
  }
  return { hash, rc };
}
async function csBetInfo(addr, id) {
  const enc = window.ethers.AbiCoder.defaultAbiCoder();
  const r = await csCall(addr, csSEL.betInfo() + enc.encode(["uint256"], [id]).slice(2));
  if (!r) return null;
  const d = enc.decode(
    ["address", "uint256", "uint8", "uint8", "uint256", "bool", "bool", "uint256", "bool"], r);
  return { player: d[0], amount: d[1], choice: Number(d[2]), guess: Number(d[3]), seedBlock: d[4], revealed: d[5], won: d[6], result: d[7], canReveal: d[8] };
}

async function refreshCasino() {
  const c = getCs();
  if (!c || !wallet) return;
  if (!csData) csData = await fetch("/casino").then((r) => r.json()).catch(() => null);
  $("cs-info").textContent = "赌场地址：" + c.addr;
  try {
    const [hb, tb] = await Promise.all([
      csCall(c.addr, csSEL.houseBalance()),
      csCall(c.addr, csSEL.totalBets()),
    ]);
    $("cs-house").value = hb ? window.ethers.formatEther(BigInt(hb)) + " / " + Number(BigInt(tb)) + " 注" : "—";
    const id = Number($("cs-bid").value) || 0;
    if (id > 0) {
      const info = await csBetInfo(c.addr, BigInt(id));
      if (info && info.player !== "0x0000000000000000000000000000000000000000") {
        const play = ["开小(<50)", "开大(≥50)", "押中 " + info.guess][info.choice];
        $("cs-bet-info").textContent = `注单 #${id}：${play}，${window.ethers.formatEther(info.amount)} ETH，` +
          `seed 区块 ${info.seedBlock}，` +
          (info.revealed
            ? `已开奖：点数 ${info.result}，${info.won ? "🎉 赢" : "输"}`
            : info.canReveal ? "可开奖！" : "等 seed 区块成为历史…");
      }
    }
  } catch (e) { log("读取赌场状态失败: " + e.message, "err"); }
}

// ── 身份权限（LabVipToken：AccessControl + 白名单 mint）──────────
const ACKEY = "lab.access";
const ACWKEY = "lab.access.worker";
const getAc = () => JSON.parse(localStorage.getItem(ACKEY) || "null");
const getAcWorker = () => JSON.parse(localStorage.getItem(ACWKEY) || "null");
let acData = null; // /access 模板

const acROLE = (s) => window.ethers.id(s); // bytes32 角色标识
const acROLEbytes = (r) => (r === "DEFAULT_ADMIN_ROLE" ? "0x" + "0".repeat(64) : acROLE(r));
const acSEL = {
  mint: () => "0x" + window.ethers.id("mint(address,uint256)").slice(2, 10),
  grantRole: () => "0x" + window.ethers.id("grantRole(bytes32,address)").slice(2, 10),
  revokeRole: () => "0x" + window.ethers.id("revokeRole(bytes32,address)").slice(2, 10),
  renounceRole: () => "0x" + window.ethers.id("renounceRole(bytes32,address)").slice(2, 10),
  hasRole: () => "0x" + window.ethers.id("hasRole(bytes32,address)").slice(2, 10),
  setPaused: () => "0x" + window.ethers.id("setPaused(bool)").slice(2, 10),
  paused: () => "0x" + window.ethers.id("paused()").slice(2, 10),
  // 员工借调 gas：topup(address,uint256)——合约把代管的 gas 转给指定地址
  topup: () => "0x" + window.ethers.id("topup(address,uint256)").slice(2, 10),
  balanceOf: () => "0x" + window.ethers.id("balanceOf(address)").slice(2, 10),
  mintedCount: () => "0x" + window.ethers.id("mintedCount()").slice(2, 10),
};

async function acCall(to, data) {
  const ret = await rpc("eth_call", [{ to, data }, "latest"]);
  return ret === "0x" || ret === undefined ? null : ret;
}

// 只读预检（坑 17 哲学）：返回 revert 原因字符串或 null（可通过）
async function acSim(from, to, data, value) {
  const tx = { from, to, data };
  if (value !== undefined) tx.value = "0x" + BigInt(value).toString(16);
  const sim = await fetch(RPC_ABS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [tx, "latest"] }),
  }).then((r) => r.json());
  if (!sim.error) return null;
  const m = (sim.error.message || "") + (sim.error.data ? JSON.stringify(sim.error.data) : "");
  const hx = m.match(/0x08c379a0([0-9a-fA-F]*)/);
  if (hx && hx[1]) {
    try {
      const d = window.ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + hx[1]);
      return d[0];
    } catch { /* fall through */ }
  }
  return m.slice(0, 100);
}

async function acSend(to, data, signer, gasLimit = 300000) {
  const hash = await sendSigned({ to, data, gasLimit: String(gasLimit), gasPrice: "1000000000" }, signer);
  const rc = await waitReceipt(hash);
  if (Number(rc.status) !== 1) throw new Error("交易 status=0");
  return { hash, rc };
}

async function acDeploy() {
  const btn = $("btn-ac-deploy");
  btn.disabled = true;
  try {
    if (!wallet) { log("请先加载账户", "err"); return; }
    if (!acData) acData = await fetch("/access").then((r) => r.json());
    log("部署 VIP 代币（AccessControl 骨架）…");
    const hash = await sendSigned({ data: acData.bytecode, gasLimit: acData.gasLimit, gasPrice: acData.gasPrice });
    recordTx(hash, "部署 VIP 代币");
    log("  已广播，等出块…");
    const rc = await waitReceipt(hash);
    settleTx(hash, Number(rc.status) === 1, Number(rc.blockNumber));
    if (Number(rc.status) !== 1) throw new Error("部署 status=0");
    localStorage.setItem(ACKEY, JSON.stringify({ addr: rc.contractAddress }));
    $("ac-info").textContent = "合约地址：" + rc.contractAddress + "（部署者 = DEFAULT_ADMIN）";
    log("✅ VIP 代币就位。注意：我只有 ADMIN 角色，直接 mint 会 access denied——先造员工授权试试", "ok");
    refreshAccess();
  } catch (e) { log("❌ 部署失败: " + (e.shortMessage || e.message), "err"); }
  finally { btn.disabled = false; }
}

// 造员工：随机钱包 + 经合约 topUp() 注资 gas。
// 注资必须走合约入口（msg.sender = 员工）——浏览器 localStorage 里存的是
// 上次部署的合约地址，刷新后旧员工的链上余额对新合约不可见。
async function acHire() {
  const c = getAc();
  if (!c) return log("请先部署 VIP 代币", "err");
  const btn = $("btn-ac-hire");
  btn.disabled = true;
  try {
    const vw = window.ethers.Wallet.createRandom();
    log(`造员工 ${vw.address.slice(0, 10)}…：经 topup() 注资 gas…`);
    // 先充值合约金库（走 receive()），再 topup(员工, 0.03) 把 gas 转给员工。
    // 为什么绕一圈？直接 dev→员工 的纯转账在本项目里被 Besu 节点
    // 稳定拒绝（原因未明，已排除 nonce/余额/gas），而走合约内部 call
    // 转账畅通——教学版不深究，真实项目这就是运维要盯的节点差异。
    const enc2 = window.ethers.AbiCoder.defaultAbiCoder();
    const topupData = acSEL.topup() + enc2.encode(["address", "uint256"], [vw.address, window.ethers.parseEther("0.03")]).slice(2);
    log(`造员工 ${vw.address.slice(0, 10)}…：充值合约金库…`);
    const h0 = await sendSigned({ to: c.addr, data: "0x", gasLimit: "60000", gasPrice: "1000000000", value: window.ethers.parseEther("0.031") });
    const rc0 = await waitReceipt(h0);
    settleTx(h0, Number(rc0.status) === 1, Number(rc0.blockNumber));
    if (Number(rc0.status) !== 1) throw new Error("合约充值 status=0");
    log("  topup 转给员工…");
    const hash = await sendSigned({ to: c.addr, data: topupData, gasLimit: "100000", gasPrice: "1000000000" });
    recordTx(hash, "员工注资（topup）");
    const rc = await waitReceipt(hash);
    settleTx(hash, Number(rc.status) === 1, Number(rc.blockNumber));
    if (Number(rc.status) !== 1) throw new Error("topup status=0");
    // 确认员工余额真的到账再造作：走合约的 value 转账在"确认时刻"存在
    // 可见性延迟，紧接着用员工签名发交易可能仍见 0 余额（坑 10 家族）
    for (let i = 0; i < 10; i++) {
      const b = await rpc("eth_getBalance", [vw.address, "latest"]);
      if (BigInt(b) > 0n) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    localStorage.setItem(ACWKEY, JSON.stringify({ address: vw.address, pk: vw.privateKey }));
    $("ac-roles").textContent = "员工地址：" + vw.address;
    log(`✅ 员工 ${vw.address.slice(0, 10)}… 入职（持 0.03 ETH gas，尚无任何角色，现在他 mint 必失败）`, "ok");
    refreshAccess();
  } catch (e) { log("❌ 造员工失败: " + (e.shortMessage || e.message), "err"); }
  finally { btn.disabled = false; }
}

async function acGrant(roleStr, label) {
  const c = getAc();
  const w = getAcWorker();
  if (!c) return log("请先部署 VIP 代币", "err");
  if (!w) return log("请先造员工", "err");
  const enc = window.ethers.AbiCoder.defaultAbiCoder();
  const btn = $("btn-ac-" + (roleStr === "PAUSER_ROLE" ? "grant-pauser" : "grant-minter"));
  btn.disabled = true;
  try {
    const data = acSEL.grantRole() + enc.encode(["bytes32", "address"], [acROLE(roleStr), w.address]).slice(2);
    const { hash, rc } = await acSend(c.addr, data, wallet);
    recordTx(hash, `提拔员工为 ${label}`);
    settleTx(hash, true, Number(rc.blockNumber));
    log(`✅ ${label} 已授予 ${w.address.slice(0, 10)}…（RoleGranted 事件已上链）`, "ok");
    refreshAccess();
  } catch (e) { log("❌ 授权失败: " + (e.shortMessage || e.message), "err"); }
  finally { btn.disabled = false; }
}

async function acRevokeMinter() {
  const c = getAc();
  const w = getAcWorker();
  if (!c || !w) return log("请先部署合约并造员工", "err");
  const btn = $("btn-ac-revoke-minter");
  btn.disabled = true;
  try {
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const data = acSEL.revokeRole() + enc.encode(["bytes32", "address"], [acROLE("MINTER_ROLE"), w.address]).slice(2);
    const { hash, rc } = await acSend(c.addr, data, wallet);
    recordTx(hash, "回收员工 MINTER");
    settleTx(hash, true, Number(rc.blockNumber));
    log(`✅ MINTER 已回收——再点"员工 mint"应该会被拒`, "ok");
    refreshAccess();
  } catch (e) { log("❌ 回收失败: " + (e.shortMessage || e.message), "err"); }
  finally { btn.disabled = false; }
}

async function acRenounce() {
  const c = getAc();
  const w = getAcWorker();
  if (!c || !w) return log("请先部署合约并造员工", "err");
  const btn = $("btn-ac-renounce");
  btn.disabled = true;
  try {
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const data = acSEL.renounceRole() + enc.encode(["bytes32", "address"], [acROLE("MINTER_ROLE"), w.address]).slice(2);
    // 预检演示：若用 ADMIN（我）替员工 renounce，必然 revert
    const denied = await acSim(wallet.address, c.addr, data);
    if (denied) log(`预检：ADMIN 替员工 renounce 被拒（"${denied}"）——renounce 只能对自己执行`);
    const { hash, rc } = await acSend(c.addr, data, new window.ethers.Wallet(w.pk));
    recordTx(hash, "员工自弃 MINTER");
    settleTx(hash, true, Number(rc.blockNumber));
    log("✅ 员工已自弃 MINTER（RoleRevoked，sender=员工自己）", "ok");
    refreshAccess();
  } catch (e) { log("❌ renounce 失败: " + (e.shortMessage || e.message), "err"); }
  finally { btn.disabled = false; }
}

async function acMint(byWorker) {
  const c = getAc();
  if (!c) return log("请先部署 VIP 代币", "err");
  const enc = window.ethers.AbiCoder.defaultAbiCoder();
  const w = getAcWorker();
  const signer = byWorker ? (w ? new window.ethers.Wallet(w.pk) : null) : wallet;
  if (!signer) return log(byWorker ? "请先造员工" : "请先加载账户", "err");
  const amount = window.ethers.parseUnits(String(Number($("ac-amount").value) || 0));
  const to = byWorker ? w.address : wallet.address;
  const data = acSEL.mint() + enc.encode(["address", "uint256"], [to, amount]).slice(2);
  const btn = $(byWorker ? "btn-ac-mint-worker" : "btn-ac-mint-admin");
  btn.disabled = true;
  try {
    // 发送前预检（坑 17）：权限类失败不浪费交易
    const why = await acSim(signer.address, c.addr, data);
    if (why) {
      log(`⛔ ${byWorker ? "员工" : "ADMIN"} mint 预检被拒："${why}"` +
        (byWorker ? "（没有 MINTER_ROLE 或代币已暂停）" : "（ADMIN 只管角色，铸币要找 MINTER——这就是职责分离）"), "warn");
      return;
    }
    const { hash, rc } = await acSend(c.addr, data, signer);
    recordTx(hash, `${byWorker ? "员工" : "ADMIN"} mint ${amount / 10n ** 18n} VIP`);
    settleTx(hash, true, Number(rc.blockNumber));
    log(`✅ ${byWorker ? "员工" : "ADMIN"} mint 成功 ${window.ethers.formatUnits(amount)} VIP → ${to.slice(0, 10)}…`, "ok");
    refreshAccess();
  } catch (e) { log("❌ mint 失败: " + (e.shortMessage || e.message), "err"); }
  finally { btn.disabled = false; }
}

async function acPause(p) {
  const c = getAc();
  const w = getAcWorker();
  if (!c || !w) return log("请先部署合约并造员工", "err");
  const enc = window.ethers.AbiCoder.defaultAbiCoder();
  const btn = $(p ? "btn-ac-pause" : "btn-ac-unpause");
  btn.disabled = true;
  try {
    const data = acSEL.setPaused() + enc.encode(["bool"], [p]).slice(2);
    const why = await acSim(new window.ethers.Wallet(w.pk).address, c.addr, data);
    if (why) return log(`⛔ 员工${p ? "暂停" : "恢复"}预检被拒："${why}"（先提拔为 PAUSER）`, "warn");
    const { hash, rc } = await acSend(c.addr, data, new window.ethers.Wallet(w.pk));
    recordTx(hash, p ? "员工暂停代币" : "员工恢复代币");
    settleTx(hash, true, Number(rc.blockNumber));
    log(`✅ 代币已${p ? "暂停——此刻连 MINTER 也铸不了" : "恢复"}`, "ok");
    refreshAccess();
  } catch (e) { log("❌ 操作失败: " + (e.shortMessage || e.message), "err"); }
  finally { btn.disabled = false; }
}

async function refreshAccess() {
  const c = getAc();
  if (!c || !wallet) return;
  if (!acData) acData = await fetch("/access").then((r) => r.json()).catch(() => null);
  $("ac-info").textContent = "合约地址：" + c.addr + "（部署者 = DEFAULT_ADMIN）";
  const w = getAcWorker();
  try {
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const [p, mc] = await Promise.all([
      acCall(c.addr, acSEL.paused()),
      acCall(c.addr, acSEL.mintedCount()),
    ]);
    // 注意：空返回值是 "0x" 不是 "0"——BigInt("0x") 会炸，统一先转 BigInt 再判
    $("ac-state").value = ((p && BigInt(p) ? 1 : 0) ? "已暂停" : "运行中") + " / 累计铸币 " + Number(mc ? BigInt(mc) : 0) + " 次";
    if (w) {
      const roles = [];
      for (const [r, label] of [["DEFAULT_ADMIN_ROLE", "ADMIN"], ["MINTER_ROLE", "MINTER"], ["PAUSER_ROLE", "PAUSER"]]) {
        const v = await acCall(c.addr, acSEL.hasRole() + enc.encode(["bytes32", "address"], [acROLEbytes(r), w.address]).slice(2));
        if (BigInt(v || 0)) roles.push(label);
      }
      $("ac-roles").textContent = `员工 ${w.address.slice(0, 10)}… 角色：` + (roles.length ? roles.join("、") : "（无）");
      const target = ($("ac-check").value || "").trim() || w.address;
      const bal = await acCall(c.addr, acSEL.balanceOf() + enc.encode(["address"], [target]).slice(2));
      $("ac-bal").value = window.ethers.formatUnits(BigInt(bal || 0)) + " VIP";
    } else {
      $("ac-roles").textContent = "尚未造员工。";
    }
  } catch (e) { log("读取权限状态失败: " + e.message, "err"); }
}

// ── 跨链桥（LabBridgeVault：同链双合约模拟 A/B 两侧）──────────────
const BRKEY = "lab.bridge";
const getBr = () => JSON.parse(localStorage.getItem(BRKEY) || "null");
let brData = null; // /bridge 模板 {vault, peg}

const brSEL = {
  deposit: () => "0x" + window.ethers.id("deposit(address)").slice(2, 10),
  confirmMint: () => "0x" + window.ethers.id("confirmMint(uint256,address,uint256,bytes[])").slice(2, 10),
  unlock: () => "0x" + window.ethers.id("unlock(address)").slice(2, 10),
  confirmUnlock: () => "0x" + window.ethers.id("confirmUnlock(uint256,address,uint256,bytes[])").slice(2, 10),
  fundPeg: () => "0x" + window.ethers.id("fundPeg(uint256)").slice(2, 10),
  attachPegToken: () => "0x" + window.ethers.id("attachPegToken(address)").slice(2, 10),
  depositInfo: () => "0x" + window.ethers.id("depositInfo(uint256)").slice(2, 10),
  messageHash: () => "0x" + window.ethers.id("messageHash(uint256,address,uint256)").slice(2, 10),
  balanceOf: () => "0x" + window.ethers.id("balanceOf(address)").slice(2, 10),
  approve: () => "0x" + window.ethers.id("approve(address,uint256)").slice(2, 10),
  mintTo: () => "0x" + window.ethers.id("mintTo(address,uint256)").slice(2, 10),
};

// 验证者 = 预言机数据源同一套私钥（教学：链下观察者是同一批基础设施）
function brValidators() {
  return getReporters();
}

// 收集 quorum 个验证者对 (nonce, recipient, amount) 的 EIP-191 签名，按地址升序
// （合约要求签名按签名者地址升序，防重放）
async function brCollectSigs(nonce, recipient, amount, quorum) {
  const vs = brValidators();
  if (vs.length < quorum) throw new Error(`验证者不足：需 ${quorum}，现有 ${vs.length}（先去预言机页准备数据源）`);
  // 与合约 messageHash 一致：keccak256(abi.encode(...))（32 字节字对齐编码），非 packed
  const structHash = window.ethers.keccak256(
    window.ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "address", "uint256"], [nonce, recipient, amount]));
  const signed = await Promise.all(vs.map(async (v) => {
    const w = new window.ethers.Wallet(v.pk);
    const sig = await w.signMessage(window.ethers.getBytes(structHash));
    return { addr: w.address.toLowerCase(), sig };
  }));
  signed.sort((a, b) => (a.addr < b.addr ? -1 : 1));
  return signed.slice(0, quorum).map((x) => x.sig);
}

async function brCall(to, data) {
  const ret = await rpc("eth_call", [{ to, data }, "latest"]);
  return ret === "0x" || ret === undefined ? null : ret;
}
async function brSend(to, data, gasLimit, value) {
  const hash = await sendSigned({ to, data, gasLimit: String(gasLimit), gasPrice: "1000000000", value });
  const rc = await waitReceipt(hash);
  if (Number(rc.status) !== 1) {
    const sim = await fetch(RPC_ABS, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call",
        params: [{ from: wallet.address, to, data, gas: "0x" + BigInt(gasLimit).toString(16), value: value ? "0x" + BigInt(value).toString(16) : undefined },
          "0x" + (BigInt(rc.blockNumber) - 1n).toString(16)] }),
    }).then((r) => r.json()).catch(() => null);
    throw new Error("交易回执 status=0" + (sim && sim.error ? "（" + (sim.error.message || "").slice(0, 140) + "）" : ""));
  }
  return { hash, rc };
}

// 一键部署：A 金库 → B 金库 → 映射币 → B 挂接 → 灌流动性
async function brSetup() {
  const btn = $("btn-br-setup");
  btn.disabled = true;
  try {
    if (!wallet) { log("请先加载账户", "err"); return; }
    if (!brValidators().length) { log("请先去 📡 预言机页点「准备测试数据源」——桥的验证者复用同一套私钥", "err"); return; }
    if (!brData) brData = await fetch("/bridge").then((r) => r.json());
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const vs = brValidators().map((v) => v.address);
    const quorum = Number($("br-quorum").value) || 2;
    const deploy = async (bytecode, ctorArgs, label) => {
      const data = bytecode + (ctorArgs ? enc.encode(ctorArgs.types, ctorArgs.values).slice(2) : "");
      const hash = await sendSigned({ data, gasLimit: brData.vault.gasLimit, gasPrice: brData.vault.gasPrice });
      recordTx(hash, label);
      const rc = await waitReceipt(hash);
      settleTx(hash, Number(rc.status) === 1, Number(rc.blockNumber));
      if (Number(rc.status) !== 1) throw new Error(label + " status=0");
      return rc.contractAddress;
    };
    log("部署 A 侧金库（源链）…");
    const aVault = await deploy(brData.vault.bytecode, { types: ["address[]", "uint256"], values: [vs, BigInt(quorum)] }, "部署 A 侧金库");
    log("部署 B 侧金库（目标链）…");
    const bVault = await deploy(brData.vault.bytecode, { types: ["address[]", "uint256"], values: [vs, BigInt(quorum)] }, "部署 B 侧金库");
    log("部署映射代币（桥的 peg 资产）…");
    const peg = await deploy(brData.peg.bytecode, { types: ["string", "string"], values: ["Lab Bridged ETH", "beETH"] }, "部署映射代币");
    log("B 金库挂接映射代币…");
    await brSend(bVault, brSEL.attachPegToken() + enc.encode(["address"], [peg]).slice(2), 200000);
    // 灌流动性：给部署者发 1 ETH 映射币 → approve → B 金库 fundPeg
    log("发行并灌入 1 beETH 流动性…");
    await brSend(peg, brSEL.mintTo() + enc.encode(["address", "uint256"], [wallet.address, window.ethers.parseEther("1")]).slice(2), 200000);
    await brSend(peg, brSEL.approve() + enc.encode(["address", "uint256"], [bVault, window.ethers.parseEther("1")]).slice(2), 200000);
    await brSend(bVault, brSEL.fundPeg() + enc.encode(["uint256"], [window.ethers.parseEther("1")]).slice(2), 200000);
    localStorage.setItem(BRKEY, JSON.stringify({ aVault, bVault, peg }));
    $("br-info").textContent = `A 金库 ${aVault.slice(0, 12)}… / B 金库 ${bVault.slice(0, 12)}… / 映射币 ${peg.slice(0, 12)}…`;
    log(`✅ 桥就绪（验证者 ${vs.length} 个，quorum=${quorum}）。开始跨过去吧`, "ok");
    refreshBridge();
  } catch (e) { log("❌ 桥部署失败: " + (e.shortMessage || e.message), "err"); }
  finally { btn.disabled = false; }
}

async function brDeposit() {
  const b = getBr();
  if (!b) return log("请先部署桥", "err");
  const amount = window.ethers.parseEther(String(Number($("br-amount").value) || 0));
  if (amount <= 0n) return log("请填写锁定金额", "err");
  const btn = $("btn-br-deposit");
  btn.disabled = true;
  try {
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const { hash, rc } = await brSend(b.aVault, brSEL.deposit() + enc.encode(["address"], [wallet.address]).slice(2), 300000, amount);
    recordTx(hash, "A 侧锁定 " + window.ethers.formatEther(amount) + " ETH");
    settleTx(hash, true, Number(rc.blockNumber));
    // 从 DepositInitiated 事件读单号（indexed topic[1]）
    const nonce = await brLastNonce(b.aVault);
    brSaveOrder(nonce, { recipient: wallet.address, amount: amount.toString(), minted: false });
    $("br-nonce").value = String(nonce);
    $("br-out").textContent = `单号 #${nonce}：锁仓 ${window.ethers.formatEther(amount)} ETH（区块 ${Number(rc.blockNumber)}）。去点"验签放行"。`;
    log(`✅ 锁定成功（单号 #${nonce}），等验证者签名后在 B 侧放行`, "ok");
    refreshBridge();
  } catch (e) { log("❌ 锁定失败: " + (e.shortMessage || e.message), "err"); }
  finally { btn.disabled = false; }
}

// 从合约最近日志取最新 nonce（DepositInitiated/WithdrawalInitiated 共用 nextNonce）
async function brLastNonce(vault) {
  const head = BigInt(await rpc("eth_blockNumber", []));
  const logs = await rpc("eth_getLogs", [{ address: vault, fromBlock: "0x" + (head > 200n ? head - 200n : 0n).toString(16), toBlock: "0x" + head.toString(16) }]);
  let n = 0n;
  for (const L of logs) n = L.topics[1] ? BigInt(L.topics[1]) : n;
  return n;
}

// A 侧锁仓单缓存：同链双合约模拟下，B 侧金库没有 A 侧的 deposits，
// confirmMint 需要把 (收款人, 金额) 重新带给 B 侧合约
const brOrders = () => JSON.parse(localStorage.getItem(BRKEY + ".orders") || "{}");
const brSaveOrder = (nonce, o) => { const m = brOrders(); m[nonce] = o; localStorage.setItem(BRKEY + ".orders", JSON.stringify(m)); };

async function brMint() {
  const b = getBr();
  if (!b) return log("请先部署桥", "err");
  const nonce = BigInt(Number($("br-nonce").value) || 0);
  if (!nonce) return log("请填写单号", "err");
  const btn = $("btn-br-mint");
  btn.disabled = true;
  try {
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const ord = brOrders()[String(nonce)];
    if (!ord) return log("找不到单号 #" + nonce + " 的锁仓记录（请重新锁定）", "err");
    if (ord.minted) return log(`单号 #${nonce} 已放行过`, "warn");
    const recipient = ord.recipient;
    const amount = BigInt(ord.amount);
    const sigs = await brCollectSigs(nonce, recipient, amount, brQuorum());
    const data = brSEL.confirmMint() + enc.encode(["uint256", "address", "uint256", "bytes[]"], [nonce, recipient, amount, sigs]).slice(2);
    const { hash, rc } = await brSend(b.bVault, data, 500000);
    recordTx(hash, `B 侧放行单号 #${nonce}`);
    settleTx(hash, true, Number(rc.blockNumber));
    ord.minted = true; brSaveOrder(nonce, ord);
    $("br-out").textContent = `✅ 单号 #${nonce} 已在 B 侧放行 ${window.ethers.formatEther(amount)} beETH → 收款人（区块 ${Number(rc.blockNumber)}）`;
    log(`✅ 验签放行成功：${window.ethers.formatEther(amount)} beETH 已到账`, "ok");
    refreshBridge();
  } catch (e) { log("❌ 放行失败: " + (e.shortMessage || e.message), "err"); }
  finally { btn.disabled = false; }
}

function brQuorum() {
  return Number(localStorage.getItem(BRKEY + ".quorum") || Number($("br-quorum").value) || 2);
}

async function brDepositInfo(vault, nonce) {
  const enc = window.ethers.AbiCoder.defaultAbiCoder();
  const r = await brCall(vault, brSEL.depositInfo() + enc.encode(["uint256"], [nonce]).slice(2));
  if (!r || r.length < 64 * 4 + 2) return null;
  const d = enc.decode(["address", "uint256", "bool", "bool"], r);
  return { recipient: d[0], amount: d[1], minted: d[2], withdrawn: d[3] };
}

async function brUnlock() {
  const b = getBr();
  if (!b) return log("请先部署桥", "err");
  const btn = $("btn-br-unlock");
  btn.disabled = true;
  try {
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    // 先 approve B 金库划转映射币
    await brSend(b.peg, brSEL.approve() + enc.encode(["address", "uint256"], [b.bVault, window.ethers.MaxUint256]).slice(2), 200000);
    const { hash, rc } = await brSend(b.bVault, brSEL.unlock() + enc.encode(["address"], [wallet.address]).slice(2), 400000);
    recordTx(hash, "B 侧烧币（unlock）");
    settleTx(hash, true, Number(rc.blockNumber));
    const nonce = await brLastNonce(b.bVault);
    $("br-rnonce").value = String(nonce);
    log(`✅ 映射币已烧（回程单号 #${nonce}），去 A 侧验签领真币`, "ok");
    refreshBridge();
  } catch (e) { log("❌ 烧币失败: " + (e.shortMessage || e.message), "err"); }
  finally { btn.disabled = false; }
}

async function brUnlockConfirm() {
  const b = getBr();
  if (!b) return log("请先部署桥", "err");
  const nonce = BigInt(Number($("br-rnonce").value) || 0);
  if (!nonce) return log("请填写回程单号", "err");
  const btn = $("btn-br-unlockconfirm");
  btn.disabled = true;
  try {
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    // B 金库的 deposits 就是本轮 unlock 写入的（同链模型下同一合约），
    // 收款人/金额直接从 B 侧合约读，A 侧 confirmUnlock 同样带上作参数
    const info = await brDepositInfo(b.bVault, nonce);
    if (!info) return log("回程单号不存在", "err");
    if (info.withdrawn) return log(`回程单 #${nonce} 已领过`, "warn");
    const sigs = await brCollectSigs(nonce, info.recipient, info.amount, brQuorum());
    const data = brSEL.confirmUnlock() + enc.encode(["uint256", "address", "uint256", "bytes[]"], [nonce, info.recipient, info.amount, sigs]).slice(2);
    const { hash, rc } = await brSend(b.aVault, data, 500000);
    recordTx(hash, `A 侧放还真币 #${nonce}`);
    settleTx(hash, true, Number(rc.blockNumber));
    log(`✅ 真币 ${window.ethers.formatEther(info.amount)} ETH 已放还（区块 ${Number(rc.blockNumber)}）——往返闭环完成`, "ok");
    refreshBridge();
  } catch (e) { log("❌ 放还真币失败: " + (e.shortMessage || e.message), "err"); }
  finally { btn.disabled = false; }
}

async function refreshBridge() {
  const b = getBr();
  if (!b || !wallet) return;
  if (!brData) brData = await fetch("/bridge").then((r) => r.json()).catch(() => null);
  try {
    const enc = window.ethers.AbiCoder.defaultAbiCoder();
    const pb = await brCall(b.peg, brSEL.balanceOf() + enc.encode(["address"], [wallet.address]).slice(2));
    $("br-pegbal").value = pb ? window.ethers.formatEther(BigInt(pb)) + " beETH" : "0 beETH";
    $("br-info").textContent = `A 金库 ${b.aVault.slice(0, 12)}… / B 金库 ${b.bVault.slice(0, 12)}… / 映射币 ${b.peg.slice(0, 12)}…`;
  } catch (e) { log("读取桥状态失败: " + e.message, "err"); }
}

// ── 页签切换 ──────────────────────────────────────────
document.querySelectorAll("nav.tabs button").forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll("nav.tabs button").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    $("page-" + b.dataset.page).classList.add("active");
    if (b.dataset.page === "wallet") refreshBalance();
    if (b.dataset.page === "stake") refreshStake();
    if (b.dataset.page === "dex") refreshAMM();
    if (b.dataset.page === "lend") refreshLend();
    if (b.dataset.page === "oracle") refreshOracle();
    if (b.dataset.page === "lego") refreshLego();
    if (b.dataset.page === "gov") { refreshGov(); govTabEnter(); }
    if (b.dataset.page === "casino") refreshCasino();
    if (b.dataset.page === "access") refreshAccess();
    if (b.dataset.page === "bridge") refreshBridge();
  };
});

// ── 绑定 ─────────────────────────────────────────────
$("priv").addEventListener("change", () => $("priv").value && setWallet($("priv").value.trim()));
$("btn-dev").onclick = useDevWallet;
$("btn-new").onclick = createWallet;
$("btn-refresh").onclick = () => { refreshBalance(); log("余额已刷新"); };
$("btn-eth-send").onclick = sendEth;
$("btn-query-bal").onclick = queryBalance;
$("q-addr").addEventListener("keydown", (e) => { if (e.key === "Enter") queryBalance(); });
$("btn-deploy").onclick = deployToken;
$("btn-transfer").onclick = transfer;
$("btn-rcv-query").onclick = () => queryReceipts();
$("btn-mint").onclick = mintNFT;
$("btn-nft-verify").onclick = verifyNFT;
$("btn-nft-send").onclick = nftTransfer;
$("btn-nrcv-query").onclick = () => queryNFTReceipts();
$("btn-stake-pool").onclick = setupPool;
$("btn-stake").onclick = doStake;
$("btn-claim").onclick = claimReward;
$("btn-unstake").onclick = unstakeAll;
$("btn-stake-refresh").onclick = () => { refreshStake(); log("质押状态已刷新"); };
$("btn-amm-add").onclick = ammAddLiquidity;
$("btn-amm-quote").onclick = ammQuote;
$("btn-amm-swap").onclick = ammSwap;
$("btn-amm-remove").onclick = ammRemove;
$("btn-amm-refresh").onclick = () => { refreshAMM(); log("池状态已刷新"); };
$("btn-lend-setup").onclick = lendSetup;
$("btn-lend-deposit").onclick = lendDeposit;
$("btn-lend-borrow").onclick = lendBorrow;
$("btn-lend-repay").onclick = lendRepay;
$("btn-lend-withdraw").onclick = lendWithdraw;
$("btn-lend-refresh").onclick = () => { refreshLend(); log("借贷状态已刷新"); };
$("btn-orc-deploy").onclick = oracleDeploy;
$("btn-orc-prep").onclick = oraclePrepareReporters;
$("btn-orc-scene-normal").onclick = () => oracleScene("normal");
$("btn-orc-scene-attack").onclick = () => oracleScene("attack");
$("btn-orc-scene-up").onclick = () => oracleScene("up");
$("btn-orc-refresh").onclick = oracleManualRefresh;
$("btn-orc-sync").onclick = oracleSyncLending;
$("orc-lend-token").onchange = refreshOracle;
$("btn-lg-setup").onclick = legoSetup;
$("btn-lg-stake").onclick = legoStake;
$("btn-lg-unstake").onclick = legoUnstake;
$("btn-lg-borrow").onclick = legoBorrow;
$("btn-lg-repay").onclick = legoRepay;
$("btn-lg-makeborrower").onclick = legoMakeBorrower;
$("btn-lg-liquidate").onclick = legoLiquidate;
$("btn-lg-refresh").onclick = () => { refreshLego(); log("金库状态已刷新"); };
$("lg-token").onchange = refreshLego;
$("btn-gv-setup").onclick = govSetup;
$("btn-gv-voters").onclick = govMakeVoters;
$("btn-gv-propose").onclick = govPropose;
$("btn-gv-vote-for").onclick = () => govVote(1);
$("btn-gv-vote-against").onclick = () => govVote(0);
$("btn-gv-voters-vote").onclick = govVotersVote;
$("btn-gv-queue").onclick = govQueue;
$("btn-gv-execute").onclick = govExecute;
$("btn-gv-refresh").onclick = () => { refreshGov(); log("治理状态已刷新"); };
$("btn-cs-deploy").onclick = csDeploy;
$("btn-cs-bet").onclick = csBet;
$("btn-cs-reveal").onclick = csReveal;
$("cs-bid").onchange = () => refreshCasino();
$("btn-ac-deploy").onclick = acDeploy;
$("btn-ac-hire").onclick = acHire;
$("btn-ac-grant-minter").onclick = () => acGrant("MINTER_ROLE", "MINTER");
$("btn-ac-grant-pauser").onclick = () => acGrant("PAUSER_ROLE", "PAUSER");
$("btn-ac-revoke-minter").onclick = acRevokeMinter;
$("btn-ac-renounce").onclick = acRenounce;
$("btn-ac-mint-admin").onclick = () => acMint(false);
$("btn-ac-mint-worker").onclick = () => acMint(true);
$("btn-ac-pause").onclick = () => acPause(true);
$("btn-ac-unpause").onclick = () => acPause(false);
$("ac-check").onchange = () => refreshAccess();
$("btn-br-setup").onclick = brSetup;
$("btn-br-deposit").onclick = brDeposit;
$("btn-br-mint").onclick = brMint;
$("btn-br-unlock").onclick = brUnlock;
$("btn-br-unlockconfirm").onclick = brUnlockConfirm;
$("n-sample").onclick = () => {
  $("n-uri").value = "data:application/json,{\"name\":\"Lab 藏品\",\"description\":\"本链铸造的第一枚 NFT\",\"image\":\"\"}";
};
init();
