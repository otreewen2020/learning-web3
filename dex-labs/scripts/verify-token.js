// 阶段 1 验证脚本：LabToken 的转账 / 授权 / 事件
// 用法: node scripts/verify-token.js
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const RPC = "http://127.0.0.1:8545";
const CHAIN_ID = 1337;
const KEY_FILE = "/Users/i/Desktop/DigitalLabs-web3/besu-local/clique-15s/node1.key";
const OVER = { gasLimit: "1000000", gasPrice: "1000000000" }; // Besu 要求 ≥1 Gwei

const ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 v) returns (bool)",
  "function approve(address spender, uint256 v) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transferFrom(address from, address to, uint256 v) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
];

async function main() {
  const reg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments.json")));
  const tokenAddr = reg.LabToken.address;

  const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
  provider.estimateGas = async () => 500_000n;

  const alice = new ethers.Wallet(fs.readFileSync(KEY_FILE, "utf8").trim().replace(/^0x/, "0x"), provider);
  const bob = ethers.Wallet.createRandom().connect(provider); // 随机新账户当接收方
  const charlie = ethers.Wallet.createRandom().connect(provider);

  const token = new ethers.Contract(tokenAddr, ABI, alice);

  console.log("=== 链上信息 ===");
  console.log("合约地址  :", tokenAddr);
  console.log("代币名称  :", await token.name(), `(${await token.symbol()}, ${await token.decimals()} 位小数)`);
  console.log("总发行量  :", ethers.formatUnits(await token.totalSupply()), "LAB");
  console.log("Alice 余额:", ethers.formatUnits(await token.balanceOf(alice.address)), "LAB");
  console.log("Bob   余额:", ethers.formatUnits(await token.balanceOf(bob.address)), "LAB");

  console.log("\n=== 测试 1: Alice -> Bob 转账 100 LAB ===");
  // 若上次运行已转过，先归回余额使脚本可重复执行
  {
    const bobPre = await token.balanceOf(bob.address);
    if (bobPre > 0n) {
      const bobRet = new ethers.Contract(tokenAddr, ABI, bob);
      (await bobRet.transfer(alice.address, bobPre, OVER)).wait();
    }
  }
  let tx = await token.transfer(bob.address, ethers.parseUnits("100"), OVER);
  let rc = await tx.wait();
  console.log("交易回执  : status", rc.status, "区块", rc.blockNumber, "gasUsed", rc.gasUsed.toString());
  console.log("Alice 余额:", ethers.formatUnits(await token.balanceOf(alice.address)), "LAB");
  console.log("Bob   余额:", ethers.formatUnits(await token.balanceOf(bob.address)), "LAB");

  console.log("\n=== 测试 2: 事件日志 ===");
  const events = await token.queryFilter(token.filters.Transfer(alice.address, bob.address));
  for (const e of events) {
    console.log(`Transfer 事件: ${e.args.from} -> ${e.args.to} = ${ethers.formatUnits(e.args.value)} LAB (区块 ${e.blockNumber})`);
  }

  console.log("\n=== 测试 3: approve + transferFrom（授权代转）===");
  tx = await token.approve(charlie.address, ethers.parseUnits("50"), OVER);
  await tx.wait();
  console.log("授权额度  :", ethers.formatUnits(await token.allowance(alice.address, charlie.address)), "LAB");

  // 给 Bob 转入链原生 ETH（gas 费），让他能自己发起交易
  // —— 这正是真实世界"新钱包要先有 ETH 才能操作"的复刻
  tx = await alice.sendTransaction({ to: bob.address, value: ethers.parseEther("0.5") });
  await tx.wait();
  console.log("给 Bob 转入 0.5 ETH 作 gas 费:", ethers.formatEther(await provider.getBalance(bob.address)), "ETH");

  tx = await token.approve(bob.address, ethers.parseUnits("30"), OVER);
  await tx.wait();
  const bobToken = new ethers.Contract(tokenAddr, ABI, bob);
  tx = await bobToken.transferFrom(alice.address, bob.address, ethers.parseUnits("30"), OVER);
  rc = await tx.wait();
  console.log("Bob 用授权代转 30 LAB: status", rc.status);
  console.log("Alice 余额:", ethers.formatUnits(await token.balanceOf(alice.address)), "LAB");
  console.log("Bob   余额:", ethers.formatUnits(await token.balanceOf(bob.address)), "LAB");
  console.log("剩余授权  :", ethers.formatUnits(await token.allowance(alice.address, bob.address)), "LAB");

  console.log("\n=== 测试 4: 余额不足应 revert ===");
  try {
    tx = await bobToken.transfer(alice.address, ethers.parseUnits("999999"), OVER);
    await tx.wait();
    console.log("不应该到这里");
  } catch (e) {
    console.log("如期失败 ✓ :", (e.receipt ? "status " + e.receipt.status : e.code));
  }

  console.log("\n全部验证通过 ✅");
}

main().catch((e) => { console.error(e); process.exit(1); });
