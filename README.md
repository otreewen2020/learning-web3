# learning-web3 —— Web3 学习实录：Besu 本地链 + 智能合约开发

从零在 macOS 上搭建 Hyperledger Besu 本地链，并在这条链上**手写十二种智能合约**
（ERC-20 / NFT / 质押 / AMM / 借贷 / 预言机 / DeFi 乐高 / 治理 / 博彩 / 权限 / 跨链桥），
覆盖搭建、共识、部署、前端与踩坑全过程的实录式学习仓库。

> 主文档：[Besu本地链与智能合约开发指南.md](./Besu本地链与智能合约开发指南.md)
> （约 5400 行，由《Besu本地链搭建指南》与《智能合约入门指南》合并整理）

## 仓库结构

```
learning-web3/
├── Besu本地链与智能合约开发指南.md   # 主文档：搭建 + 理论 + 实战 + 十二合约专题
├── dex-labs/                        # 合约工程（与指南第五、六部分一一对应）
│   ├── contracts/                   # 12 个 Lab*.sol 合约源码（solc 0.8.37，无外部依赖）
│   ├── public/                      # 网页钱包前端（ethers.js 浏览器本地签名）
│   ├── scripts/                     # 编译部署 / 验证 / 排障脚本
│   ├── server.js                    # 本地网站后端（静态服务 + 合约模板 + /rpc 代理）
│   └── deployments.json             # 已部署合约地址登记簿
├── clique-15s/genesis.json          # Clique PoA 自定义链创世配置（15 秒出块，双 sealer）
├── send_dev_tx.js                   # 本地链发交易验证脚本（ethers.js）
└── .gitignore                       # 排除 Besu/JDK 发行包、链数据与私钥
```

## 指南导读（六章 + 附录）

| 部分 | 章节 | 内容 |
|---|---|---|
| 一、背景知识 | 1-2 | 什么是以太坊客户端、为什么选 Besu；Clique PoA / IBFT 2.0 / QBFT 三种共识对比 |
| 二、搭建本地链 | 3-8 | 装 Java、下 Besu、启动、解决"链不出块"、验证出块与交易；区块字段逐个精读；Clique 自定义链实战；genesis 配置详解 |
| 三、日常使用与运维 | 9-11 | 启停脚本、接 MetaMask / Hardhat / Foundry、JSON-RPC 命令速查表、FAQ |
| 四、智能合约入门理论 | 12-19 | 合约是什么、ERC 标准体系、Solidity 最小示例、ABI、Hardhat 接本地链、学习路径 |
| 五、实战开发实录 | 20-31 | dex-labs 十二个阶段（钱包 → 跨链桥）的完整实现、决策与踩坑记录 |
| 六、十二种合约专题 | 专题 00-12 | 每种合约按"背景 → 代码详解 → 部署过程 → 逐句精解（完整源码）"系统梳理 |
| 附录 | A / B | 环境踩坑总录（30 条）；本次搭建完整时间线复盘 |

## 十二合约速览

| 阶段 | 合约 | 核心机制 |
|---|---|---|
| 0 | 前端钱包 | 浏览器本地签名 + 代理广播，私钥不出浏览器 |
| 1 | [LabToken.sol](./dex-labs/contracts/LabToken.sol) | ERC-20：余额 = 一个 mapping，转账 = 改两个数字 |
| 2 | [LabNFT.sol](./dex-labs/contracts/LabNFT.sol) | ERC-721：逐枚确权 + tokenURI 元数据 |
| 3 | [LabStaking.sol](./dex-labs/contracts/LabStaking.sol) | Synthetix 式按秒累计质押奖励，updateReward 结算到此刻 |
| 4 | [LabAMM.sol](./dex-labs/contracts/LabAMM.sol) | 恒定乘积 x·y=k + 0.3% 手续费，无人挂单自动做市 |
| 5 | [LabLending.sol](./dex-labs/contracts/LabLending.sol) | 超额抵押 + 持续计息 + 健康度 + 无许可清算 |
| 6 | [LabOracle.sol](./dex-labs/contracts/LabOracle.sol) | 链上不能上网：多数据源白名单报价取中位数 |
| 7 | [LabLego.sol](./dex-labs/contracts/LabLego.sol) | DeFi 乐高：不动旧合约，套一层金库让 LP 可抵押 |
| 8 | [LabGovernance.sol](./dex-labs/contracts/LabGovernance.sol) | 治理四件套：检查点票权快照 + Timelock 延迟执行 |
| 9 | [LabCasino.sol](./dex-labs/contracts/LabCasino.sol) | 链上无真随机：未来区块哈希承诺延迟开奖 |
| 10 | [LabAccess.sol](./dex-labs/contracts/LabAccess.sol) | AccessControl：owner 独裁拆成角色-成员多对多 |
| 11 | [LabBridge.sol](./dex-labs/contracts/LabBridge.sol) | 跨链桥不造币只搬运：锁仓 + 验证者 2/3 阈值签名放行 |

## 快速开始

**1. 搭本地链**（详见指南第 4-8 章）：需要 JDK 21/25 与 Besu **24.12.2**
（26.x 已移除 `--network=dev` 单机模式），dev 链至少两个节点互联才出块：

```sh
export JAVA_HOME=<你的 JDK 路径>
besu-24.12.2/bin/besu --network=dev --sync-min-peers=1 \
  --rpc-http-enabled --rpc-http-api=ETH,NET,WEB3,DEBUG,TXPOOL,MINER,ADMIN \
  --host-allowlist="*" --data-path=./data-dev
# 第二个节点（--p2p-port=30304 --rpc-http-port=8546）+ admin_addPeer 互联，详见指南第 7、9 章
```

**2. 运行合约工程**（Node.js ≥ 18，依赖仅 solc + ethers）：

```sh
cd dex-labs
npm install
node server.js                          # 网页钱包/发币：http://127.0.0.1:3000
node scripts/deploy.js contracts/LabAMM.sol::LabAMM   # 编译 → 部署 → 登记地址
```

**3. 验证**：RPC `http://127.0.0.1:8545`（Chain ID 1337），MetaMask 手动添加即可接入。

## 本环境三条铁律（血泪踩坑，详见指南附录 A）

1. **编译必须锁 `evmVersion: "london"`** —— Besu 24.12 genesis 只到 londonBlock，
   solc 0.8.37 默认 Cancun 产物含 `PUSH0`，上链即 gas 耗尽；
2. **所有交易显式 `gasLimit` + `gasPrice ≥ 1 Gwei`** —— 节点 `min-gas-price` 默认 1 Gwei，
   gasPrice=0 会被拒且误报 "execution reverted"；
3. **别信 `eth_estimateGas`** —— 对合约创建一律报错，deploy.js 固定 gasLimit 绕过。

## 声明

- 本仓库所有内容仅在本地链（Chain ID 1337）上运行，合约未审计，**不可用于生产或真实资产**；
- 文中出现的私钥/账户均为本地测试账户，仓库本身不包含任何私钥（`*.key` 已被 .gitignore 排除）。
