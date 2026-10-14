// 一键发币网站后端：静态页面 + RPC 代理
// 运行: node server.js   （默认 http://127.0.0.1:3000）
const http = require("http");
const fs = require("fs");
const path = require("path");
const solc = require("solc");

const PORT = 3000;
const RPC = "http://127.0.0.1:8545";
const DEV_KEY_FILE = "/Users/i/Desktop/DigitalLabs-web3/besu-local/clique-15s/node1.key";

// ── 启动时把合约模板编译好（evmVersion 必须锁 london，见 README 踩坑说明）──
function compileContract(file, name) {
  const src = fs.readFileSync(path.join(__dirname, "contracts", file), "utf8");
  const input = {
    language: "Solidity",
    sources: { [file]: { content: src } },
    settings: {
      evmVersion: "london",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errs = (out.errors || []).filter((e) => e.severity === "error");
  if (errs.length) throw new Error(errs.map((e) => e.formattedMessage).join("\n"));
  return out.contracts[file][name];
}
const TEMPLATE = compileContract("LabFactoryToken.sol", "LabFactoryToken");
const NFT_TEMPLATE = compileContract("LabNFT.sol", "LabNFT");
const STAKING_TEMPLATE = compileContract("LabStaking.sol", "LabStaking");
const AMM_TEMPLATE = compileContract("LabAMM.sol", "LabAMM");
const LENDING_TEMPLATE = compileContract("LabLending.sol", "LabLending");
const ORACLE_TEMPLATE = compileContract("LabOracle.sol", "LabOracle");
const LEGO_TEMPLATE = compileContract("LabLego.sol", "LabLego");
// 治理套件：同一源文件四个合约
const GOV = {
  token: compileContract("LabGovernance.sol", "LabVoteToken"),
  timelock: compileContract("LabGovernance.sol", "LabTimelock"),
  governor: compileContract("LabGovernance.sol", "LabGovernor"),
  box: compileContract("LabGovernance.sol", "LabBox"),
};
const CASINO_TEMPLATE = compileContract("LabCasino.sol", "LabCasino");
const ACCESS_TEMPLATE = compileContract("LabAccess.sol", "LabVipToken");
// 跨链桥：同一源文件两个合约（A/B 侧各部署一套 Vault，B 侧再挂一个映射代币）
const BRIDGE = {
  vault: compileContract("LabBridge.sol", "LabBridgeVault"),
  peg: compileContract("LabBridge.sol", "LabBridgedToken"),
};

// 预编译产物（abi + bytecode + 固定 gas 参数），前端据此在浏览器内本地签名
function templateJson(t) {
  return JSON.stringify({
    abi: t.abi,
    bytecode: "0x" + t.evm.bytecode.object,
    chainId: 1337,
    gasLimit: "20000000",
    // 注意：合约内部 call 转账（topup）实测要 ~40k gas。若沿用全局
    // gasLimit 且余额恰够，小额转账没问题；但 Besu 对 Upfront cost
    // 用整笔 gasLimit 计费——20M gas × 1Gwei = 0.02 ETH 起步，
    // 员工账户 0.03 ETH 时 mint(300k) 只需 0.0003，够用。
    gasPrice: "1000000000", // Besu min-gas-price = 1 Gwei
  });
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split("?")[0]; // 去掉缓存穿透查询串
  // ── 发币模板（预编译字节码 + ABI + gas 参数）──
  if (req.method === "GET" && urlPath === "/factory") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(templateJson(TEMPLATE));
    return;
  }

  // ── NFT 模板（LabNFT，ERC-721）──
  if (req.method === "GET" && urlPath === "/nft") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(templateJson(NFT_TEMPLATE));
    return;
  }

  // ── 质押池模板（LabStaking）──
  if (req.method === "GET" && urlPath === "/staking") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(templateJson(STAKING_TEMPLATE));
    return;
  }

  // ── AMM 模板（LabAMM）──
  if (req.method === "GET" && urlPath === "/amm") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(templateJson(AMM_TEMPLATE));
    return;
  }

  // ── 借贷市场模板（LabLending）──
  if (req.method === "GET" && urlPath === "/lending") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(templateJson(LENDING_TEMPLATE));
    return;
  }

  // ── 预言机模板（LabOracle）──
  if (req.method === "GET" && urlPath === "/oracle") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(templateJson(ORACLE_TEMPLATE));
    return;
  }

  // ── DeFi 乐高（LP 抵押借贷金库 LabLego）──
  if (req.method === "GET" && urlPath === "/lego") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(templateJson(LEGO_TEMPLATE));
    return;
  }

  // ── 治理套件（VoteToken / Timelock / Governor / Box）──
  if (req.method === "GET" && urlPath === "/governance") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      token: JSON.parse(templateJson(GOV.token)),
      timelock: JSON.parse(templateJson(GOV.timelock)),
      governor: JSON.parse(templateJson(GOV.governor)),
      box: JSON.parse(templateJson(GOV.box)),
    }));
    return;
  }

  // ── 赌场模板（LabCasino）──
  if (req.method === "GET" && urlPath === "/casino") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(templateJson(CASINO_TEMPLATE));
    return;
  }

  // ── 权限模板（LabVipToken：AccessControl + 白名单 mint）──
  if (req.method === "GET" && urlPath === "/access") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(templateJson(ACCESS_TEMPLATE));
    return;
  }

  // ── 跨链桥模板（LabBridgeVault + LabBridgedToken）──
  if (req.method === "GET" && urlPath === "/bridge") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ vault: JSON.parse(templateJson(BRIDGE.vault)), peg: JSON.parse(templateJson(BRIDGE.peg)) }));
    return;
  }

  // ── 开发私钥（本机开发便利；浏览器留空私钥时自动加载）──
  if (req.method === "GET" && urlPath === "/dev-key") {
    try {
      const key = fs.readFileSync(DEV_KEY_FILE, "utf8").trim();
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(key);
    } catch {
      res.writeHead(404); res.end("");
    }
    return;
  }

  // ── RPC 代理：转发浏览器已签名的交易/查询到 Besu ──
  // 响应带 no-cache 且用 res.end(Buffer)，避免连接复用/缓存导致
  // 浏览器读到过期结果（eth_getTransactionReceipt 轮询必需）
  if (req.method === "POST" && urlPath === "/rpc") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        const r = await fetch(RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Connection": "close" },
          body,
        });
        const buf = Buffer.from(await r.arrayBuffer());
        const head = {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        };
        // Besu 偶发返回损坏响应（Invalid block, unable to parse RLP）→ 校验后重试一次
        try {
          const j = JSON.parse(buf.toString("utf8"));
          const errMsg = (j.error && j.error.message) || "";
          if (/unable to parse RLP|invalid block/i.test(errMsg)) throw new Error("bad upstream");
        } catch {
          await new Promise((r2) => setTimeout(r2, 400));
          const r2 = await fetch(RPC, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Connection": "close" },
            body,
          });
          const buf2 = Buffer.from(await r2.arrayBuffer());
          res.writeHead(200, head);
          res.end(buf2);
          return;
        }
        res.writeHead(200, head);
        res.end(buf);
      } catch (e) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(e) }));
      }
    });
    return;
  }

  // CORS 预检
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // ── 静态文件 ──
  let file = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const full = path.join(__dirname, "public", file);
  if (!full.startsWith(path.join(__dirname, "public"))) {
    res.writeHead(403); res.end("forbidden"); return;
  }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(full)] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`发币网站已启动: http://127.0.0.1:${PORT}  (RPC 代理 → ${RPC})`);
});
