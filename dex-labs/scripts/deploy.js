// 通用编译 + 部署工具（后续所有阶段的合约都复用这个脚本）
// 用法: node scripts/deploy.js <合约文件::合约名> [构造参数...]
const fs = require("fs");
const path = require("path");
const solc = require("solc");
const { ethers } = require("ethers");

const RPC = process.env.RPC_URL || "http://127.0.0.1:8545";
const CHAIN_ID = 1337;
// Besu 24.12.2 的 estimateGas/eth_call 对合约创建交易有 bug（INVALID_OPERATION），
// 因此固定 gasLimit、不估算；gasPrice 需 ≥ 节点 min-gas-price（默认 1 Gwei）
const GAS_LIMIT = "20000000";
const GAS_PRICE = "1000000000"; // 1 Gwei
const KEY_FILE = process.env.KEY_FILE ||
  "/Users/i/Desktop/DigitalLabs-web3/besu-local/clique-15s/node1.key";

// ─── 编译 ────────────────────────────────────────────────
function compile(solPath, contractName) {
  const sources = {};
  const dir = path.dirname(solPath);
  const addSource = (p) => {
    const key = path.relative(dir, p);
    if (!sources[key]) sources[key] = { content: fs.readFileSync(p, "utf8") };
  };
  addSource(solPath);
  // 递归引入 import "..." 的本地文件
  for (let scanned = 0; scanned < Object.keys(sources).length;) {
    scanned = Object.keys(sources).length;
    for (const [k, v] of Object.entries(sources)) {
      for (const m of v.content.matchAll(/import\s+"([^"]+)"/g)) {
        const p = path.resolve(path.dirname(path.join(dir, k)), m[1]);
        if (fs.existsSync(p)) addSource(p);
      }
    }
  }
  // evmVersion 必须锁 london/paris：genesis 未启用 Shanghai/Cancun 硬分叉，
  // solc 默认按 Cancun 生成的字节码在本链上会执行失败（gas 耗尽）
  const input = {
    language: "Solidity",
    sources,
    settings: {
      evmVersion: "london",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errs = (out.errors || []).filter((e) => e.severity === "error");
  if (errs.length) {
    errs.forEach((e) => console.error(e.formattedMessage));
    throw new Error("编译失败");
  }
  (out.errors || []).forEach((e) => console.warn(e.formattedMessage));
  const fileOut = out.contracts[path.relative(dir, solPath)];
  if (!fileOut || !fileOut[contractName]) throw new Error(`找不到合约 ${contractName}`);
  return fileOut[contractName];
}

// ─── 部署 ────────────────────────────────────────────────
async function main() {
  const [spec, ...args] = process.argv.slice(2);
  if (!spec) {
    console.error("用法: node scripts/deploy.js <文件.sol::合约名> [构造参数...]");
    process.exit(1);
  }
  const [solPath, contractName] = spec.split("::");
  const root = path.resolve(__dirname, "..");
  const absSol = path.isAbsolute(solPath) ? solPath : path.join(root, solPath);

  console.log(`[1/3] 编译 ${contractName} (${solPath}) ...`);
  const artifact = compile(absSol, contractName);

  const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
  // Besu 的 estimateGas/eth_call 要求 gasPrice ≥ min-gas-price(1 Gwei)，
  // ethers 默认 0 会报错，这里覆写 gas 估算器直接用固定值
  provider.estimateGas = async () => 5_000_000n;
  const rawKey = fs.readFileSync(KEY_FILE, "utf8").trim();
  const wallet = new ethers.Wallet("0x" + rawKey.replace(/^0x/, ""), provider);
  console.log(`[2/3] 部署账户: ${wallet.address}`);

  const factory = new ethers.ContractFactory(
    artifact.abi, "0x" + artifact.evm.bytecode.object, wallet);
  const overrides = { gasLimit: GAS_LIMIT, gasPrice: GAS_PRICE };
  const tx = await factory.deploy(...args, overrides);
  const sent = tx.deploymentTransaction();
  const receipt = await sent.wait();
  // Besu + ethers 兼容坑：部署后 ethers 会用 gasPrice=0 的 eth_call 验证代码
  // 存在性而被 Besu 拒绝，误报 "execution reverted"。以回执 status 为准。
  if (BigInt(receipt.gasUsed) >= BigInt(GAS_LIMIT)) {
    throw new Error(`部署交易 status=${receipt.status}，gas 耗尽，构造器执行失败`);
  }
  if (Number(receipt.status) !== 1) {
    throw new Error(`部署交易失败 status=${receipt.status}`);
  }
  console.log(`[3/3] 部署成功!`);
  console.log(`  合约地址:  ${receipt.contractAddress}`);
  console.log(`  区块高度:  ${receipt.blockNumber}`);
  console.log(`  gas 消耗:  ${receipt.gasUsed}`);

  // 记录到部署清单，供后续阶段引用
  const registryPath = path.join(root, "deployments.json");
  const registry = fs.existsSync(registryPath) ? JSON.parse(fs.readFileSync(registryPath)) : {};
  registry[contractName] = {
    address: receipt.contractAddress,
    deployer: wallet.address,
    blockNumber: Number(receipt.blockNumber),
    deployedAt: new Date().toISOString(),
    args,
  };
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  console.log(`  已记录到 deployments.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
