// 最小实验：定位 Besu 24.12.2 上合约创建失败的具体触发特性
const fs = require("fs");
const solc = require("solc");
const { ethers } = require("ethers");

const RPC = "http://127.0.0.1:8545";
const KEY = "/Users/i/Desktop/DigitalLabs-web3/besu-local/clique-15s/node1.key";

function compileCode(code) {
  const input = {
    language: "Solidity",
    sources: { "t.sol": { content: code } },
    settings: { evmVersion: "shanghai", optimizer: { enabled: false }, outputSelection: { "*": { "*": ["evm.bytecode.object"] } } },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  if ((out.errors || []).some((e) => e.severity === "error")) return null;
  return "0x" + out.contracts["t.sol"]["T"].evm.bytecode.object;
}

const HEAD = "// SPDX-License-Identifier:MIT\npragma solidity ^0.8.24;\n";
const tests = {
  "A_纯空合约":              HEAD + "contract T {}",
  "B_构造器写状态":          HEAD + "contract T { uint256 x; constructor(){ x=1; } }",
  "C_构造器带参数":          HEAD + "contract T { uint256 x; constructor(uint256 v){ x=v; } }",
  "D_构造器带参数并乘":      HEAD + "contract T { uint256 x; constructor(uint256 v){ x=v*1000000000000000000; } }",
  "E_string常量":            HEAD + 'contract T { string public constant name = "Lab Token"; }',
  "F_构造器写mapping":       HEAD + "contract T { mapping(address=>uint256) b; constructor(){ b[msg.sender]=100; } }",
  "G_构造器emit事件":        HEAD + "contract T { event E(address indexed a, uint v); constructor(){ emit E(msg.sender,1); } }",
  "H_外部函数读mapping":     HEAD + "contract T { mapping(address=>uint256) b; function bal(address a) public view returns(uint){ return b[a]; } }",
};

(async () => {
  const provider = new ethers.JsonRpcProvider(RPC, 1337, { staticNetwork: true });
  const raw = fs.readFileSync(KEY, "utf8").trim();
  const wallet = new ethers.Wallet("0x" + raw, provider);
  const nonce0 = await provider.getTransactionCount(wallet.address);

  for (const [name, code] of Object.entries(tests)) {
    const bc = compileCode(code);
    if (!bc) { console.log(name, "=> 编译失败"); continue; }
    try {
      const tx = await wallet.sendTransaction({
        data: bc, gasLimit: "3000000", gasPrice: "1000000000",
      });
      const r = await tx.wait();
      console.log(name, "=> status", r.status, "gasUsed", r.gasUsed.toString());
    } catch (e) {
      const rc = e.receipt;
      if (rc) console.log(name, "=> status", rc.status, "gasUsed", rc.gasUsed.toString(), "(回执判定)");
      else console.log(name, "=> FAIL code:", e.code, "|", JSON.stringify(e.info || e.shortMessage || e.message || "").slice(0, 200));
    }
  }
})();
