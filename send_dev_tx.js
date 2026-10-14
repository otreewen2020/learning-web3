// 向本地 Besu dev 链发送一笔已签名交易，验证出块
const { ethers } = require("ethers");

// Besu dev 网络内置的预资金账户（固定已知私钥，仅用于本地开发）
const DEV_PRIVKEY = "0xc87509a1c067bbde78beb793e6fa76530b63fe2a367e91d6cd40d2c7c8c7b7c3";

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545", 1337, { staticNetwork: true });
  const wallet = new ethers.Wallet(DEV_PRIVKEY, provider);
  console.log("sender:", wallet.address);
  console.log("sender balance:", ethers.formatEther(await provider.getBalance(wallet.address)));

  const tx = await wallet.sendTransaction({
    to: "0x0000000000000000000000000000000000000099",
    value: ethers.parseEther("1.0"),
  });
  console.log("tx hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("block number:", receipt.blockNumber, "status:", receipt.status);

  const bal = await provider.getBalance("0x0000000000000000000000000000000000000099");
  console.log("recipient balance:", ethers.formatEther(bal), "ETH");
  console.log("latest block:", await provider.getBlockNumber());
}

main().catch((e) => { console.error(e); process.exit(1); });
