# Besu 本地链与智能合约开发指南（小白版）

> 本指南由《Besu本地链搭建指南.md》与《智能合约入门指南.md》合并整理而成，
> 完整覆盖“搭建 Besu 本地链 → 理解智能合约 → 实战开发十二种合约”的学习路径，
> 原两份文档的内容与踩坑记录全部保留。
>
> **全书结构**：
> 第一部分 背景知识（第 1-2 章）→ 第二部分 搭建本地链（第 3-8 章）→
> 第三部分 日常使用与运维（第 9-11 章）→ 第四部分 智能合约入门理论（第 12-19 章）→
> 第五部分 实战开发实录（第 20-31 章）→ 第六部分 十二种智能合约专题（专题 00-12）→
> 附录 A 踩坑总录 / 附录 B 搭建时间线 → 结语。
>
> 环境：macOS（Intel x86_64）；Besu 24.12.2 本地链，Chain ID 1337，
> RPC `http://127.0.0.1:8545`，可出块、可发交易、可部署合约。
> 撰写时间：2026-10-13；合并整理：2026-10-14。

---

## 目录

- [**第一部分：背景知识——认识 Besu 与共识机制**](#第一部分背景知识认识-besu-与共识机制)
  - [1. 背景知识：Besu 是什么](#1-背景知识besu-是什么)
  - [2. 背景知识：共识机制（Clique PoA / IBFT 2.0 / QBFT）](#2-背景知识共识机制clique-poa--ibft-20--qbft)
- [**第二部分：搭建本地链**](#第二部分搭建本地链)
  - [3. 整体思路：搭建需要哪几步](#3-整体思路搭建需要哪几步)
  - [4. 第一步：安装 Java 运行时](#4-第一步安装-java-运行时)
  - [5. 第二步：下载 Besu](#5-第二步下载-besu)
  - [6. 第三步：启动本地链（以及为什么不能直接用最新版）](#6-第三步启动本地链以及为什么不能直接用最新版)
  - [7. 第四步：踩坑与解决——链不出块](#7-第四步踩坑与解决链不出块)
  - [8. 第五步：验证链真的在工作](#8-第五步验证链真的在工作)
- [**第三部分：日常使用与运维**](#第三部分日常使用与运维)
  - [9. 日常使用：启动 / 停止 / 接 MetaMask / 接开发工具](#9-日常使用启动--停止--接-metamask--接开发工具)
  - [10. 常用命令速查表](#10-常用命令速查表)
  - [11. 常见问题 FAQ](#11-常见问题-faq)
- [**第四部分：智能合约入门理论**](#第四部分智能合约入门理论)
  - [12. 一句话与一个类比](#12-一句话与一个类比)
  - [13. 它解决了什么问题？](#13-它解决了什么问题)
  - [14. 有哪些类型的智能合约？](#14-有哪些类型的智能合约)
  - [15. 如何定义（编写）智能合约？](#15-如何定义编写智能合约)
  - [16. 完整开发流程：在本地 Besu 链上部署](#16-完整开发流程在本地-besu-链上部署)
  - [17. 三个必须建立的认知](#17-三个必须建立的认知)
  - [18. 与本项目环境的连接](#18-与本项目环境的连接)
  - [19. 学习路径建议](#19-学习路径建议)
- [**第五部分：实战开发实录（dex-labs 工程）**](#第五部分实战开发实录dex-labs-工程)
  - [20. 阶段 0：钱包功能](#20-阶段-0钱包功能)
  - [21. 阶段 1：代币（ERC-20）](#21-阶段-1代币erc-20)
  - [22. 阶段 2：NFT（ERC-721）](#22-阶段-2nfterc-721)
  - [23. 阶段 3：质押（Staking）](#23-阶段-3质押staking)
  - [24. 阶段 4：DEX（AMM）](#24-阶段-4dexamm)
  - [25. 阶段 5：借贷协议（Lending）](#25-阶段-5借贷协议lending)
  - [26. 阶段 6（一）：预言机（Oracle）——多数据源中位数聚合](#26-阶段-6一预言机oracle多数据源中位数聚合)
  - [27. 阶段 6（二）：DeFi 乐高——LP 抵押借贷（AMM × 预言机 × 借贷）](#27-阶段-6二defi-乐高lp-抵押借贷amm--预言机--借贷)
  - [28. 阶段 7：链上治理（Governance）——投票权、快照与 Timelock](#28-阶段-7链上治理governance投票权快照与-timelock)
  - [29. 阶段 8：链上博彩——没有随机的赌场（LabCasino）](#29-阶段-8链上博彩没有随机的赌场labcasino)
  - [30. 阶段 9：身份与权限——把 owner 拆成角色（LabAccessControl）](#30-阶段-9身份与权限把-owner-拆成角色labaccesscontrol)
  - [31. 阶段 10：跨链桥——锁仓 + 映射发行（LabBridgeVault）](#31-阶段-10跨链桥锁仓--映射发行labbridgevault)
- [**第六部分：十二种智能合约专题**](#第六部分十二种智能合约专题)
  - [专题 00：合约总览——一张图看懂十二合约如何咬合](#专题-00合约总览一张图看懂十二合约如何咬合)
  - [专题 01：钱包（前端签名器）](#专题-01钱包前端签名器)
  - [专题 02：ERC-20 代币（LabToken）](#专题-02erc-20-代币labtoken)
  - [专题 03：NFT（LabNFT）](#专题-03nftlabnft)
  - [专题 04：质押（LabStaking）](#专题-04质押labstaking)
  - [专题 05：DEX 自动做市商（LabAMM）](#专题-05dex-自动做市商labamm)
  - [专题 06：借贷协议（LabLending）](#专题-06借贷协议lablending)
  - [专题 07：预言机（LabOracle）](#专题-07预言机laboracle)
  - [专题 08：DeFi 乐高地基（LabLego）](#专题-08defi-乐高地基lablego)
  - [专题 09：链上治理四件套（VoteToken / Governor / Timelock / Box）](#专题-09链上治理四件套votetoken--governor--timelock--box)
  - [专题 10：博彩（LabCasino）](#专题-10博彩labcasino)
  - [专题 11：身份与权限（LabAccessControl + LabVipToken）](#专题-11身份与权限labaccesscontrol--labviptoken)
  - [专题 12：跨链桥（LabBridgeVault + LabBridgedToken）](#专题-12跨链桥labbridgevault--labbridgedtoken)
- [**附录**](#附录)
  - [附录 A：本环境踩坑总录](#附录-a本环境踩坑总录)
  - [附录 B：本次搭建完整时间线（复盘）](#附录-b本次搭建完整时间线复盘)
- [结语](#结语)

---

# 第一部分：背景知识——认识 Besu 与共识机制

> 一条链跑起来之前，先弄懂三件事：什么是客户端、为什么选 Besu、节点之间靠什么达成一致。

---

## 1. 背景知识：Besu 是什么

### 1.1 什么是"客户端"

以太坊（Ethereum）是一条**区块链网络**，它没有官方中心服务器。
所谓"客户端"，就是实现这套网络规则的**软件程序**。你运行一个客户端，
就等于"加入"了这条链；多个客户端之间互相同步数据。

主流以太坊客户端有：

| 客户端 | 语言 | 特点 |
|---|---|---|
| Geth | Go | 最流行，以太坊基金会维护 |
| **Besu** | **Java** | Hyperledger 基金会项目，**企业/联盟链首选** |
| Nethermind | C# | 功能丰富 |
| Erigon | Go/Rust | 主打存储优化 |

**Besu 的优势**：完全用 Java 写成、对联盟链（私有网络）支持最好、
内置多种共识机制（Clique PoA、IBFT2、QBFT），并且 100% 兼容以太坊，
Solidity 合约、MetaMask、Hardhat 等以太坊生态工具全部通用。

### 1.2 为什么要"本地链"

在本地（你自己的电脑上）跑一条只属于你自己的区块链，好处是：

- **免费**：不需要花钱买 Gas，随便测试；
- **快**：区块就在你电脑上产生，交易确认是毫秒级的；
- **可控**：想重置就重置，想改规则就改规则；
- **离线**：不联网也能跑。

开发智能合约、测试 DApp 时，几乎都是先在本地链上调通，再部署到测试网或主网。

---

## 2. 背景知识：共识机制（Clique PoA / IBFT 2.0 / QBFT）

第 1 章提到 Besu "内置多种共识机制（Clique PoA、IBFT 2.0、QBFT）"，
本章展开解释这三个名词。

### 2.1 为什么需要共识机制？

区块链是去中心化的，**没有中心服务器说了算**。假设有 4 个节点：

- 有人伪造了一笔交易，其他节点该信谁？
- 区块按什么顺序排列？
- 有节点故意捣乱（发假消息、篡改数据）怎么办？

**共识机制就是一套"游戏规则"**，让所有互不信任的节点最终对同一条链达成一致。

> 以太坊主网用的是 PoW（挖矿，2022 年已转 PoS）。
> 而 Besu 内置的下面三种是**面向私有链/联盟链**的——不需要烧电挖矿，
> 出块快、即时终局，成员通常是"实名"的企业或机构。

### 2.2 Clique PoA —— "轮班盖章制"

**PoA = Proof of Authority（权威证明）**

- **谁能出块？** 只有被列入白名单的账户（叫 **sealer，出块人**）才有权出块。
- **怎么出？** 白名单里的节点**轮流**出块，比如 A → B → C → D → A…
  每人负责一个时间段。
- **怎么防伪？** 每个区块都带出块人的**数字签名**。收到区块的节点验签：
  签名人不在白名单 → 直接丢弃。
- **作恶会怎样？** 机制本身不罚钱，靠"身份可信"约束——
  白名单是你自己加的，跑了谁你心里有数。

> 类比：**公司值班表**。只有员工（白名单）能在文件上盖公章，
> 大家按值班表轮班盖章，伪造签名一查便知。

**特点**：最简单、资源占用最低，适合测试和小规模可信联盟。

### 2.3 IBFT 2.0 —— "董事会投票制"

**IBFT = Istanbul Byzantine Fault Tolerance（伊斯坦布尔拜占庭容错）**

- 出块人轮流担任，但每轮**通过提议 + 投票**决定；
- 流程简化版：本轮出块人提议一个区块 → 其他验证人**投票**
  （Pre-prepare → Prepare → Commit 三阶段）→ **2/3 以上**同意才生效；
- 内置**拜占庭容错**：即使少数节点作恶，链仍能正确运转
  （作恶节点不超过总数的 1/3 时安全）；
- 还有"踢人"机制：验证人可以投票把某个出块人移出白名单；
- 投票通过的区块**即时终局**（finality）——不会被回滚重组。

> 类比：**董事会决议**。董事长（本轮出块人）提方案，董事投票，
> 2/3 通过才算数；即使有董事故意捣乱，只要不超过 1/3，决议照样有效。

**特点**：适合成员互不完全信任、且要求"结果不可撤销"的联盟链
（如银行间结算）。

### 2.4 QBFT —— IBFT 2.0 的"官方升级版"

**QBFT = Quorum byzantine fault tolerant**

- 本质仍是 IBFT 2.0 的投票机制，但有关键改进：
  - **更快的确认速度**（优化了消息轮次和超时处理）；
  - **更规范的实现**——源自企业联盟链 **Quorum**
    （摩根大通基于旧版 Go 以太坊做的商业版，后被 Consensys 收购）。
- 现在 Besu 做**新的生产级联盟链，官方首推 QBFT**，
  IBFT 2.0 逐渐算"上一代"。

> 类比：董事会决议制度**升级了议事流程**——开会更快、
> 反对者更没空子可钻，但"投票通过才生效"的精神没变。

### 2.5 三者对比速查

| | Clique PoA | IBFT 2.0 | QBFT |
|---|---|---|---|
| 出块方式 | 白名单轮流出块，无需投票 | 轮值提议 + 2/3 投票 | 同 IBFT 2.0，流程更快 |
| 防作恶能力 | 弱（只防伪造，不防多数作恶） | 强（拜占庭容错 ≤1/3） | 强（同左） |
| 出块确认 | 快，但理论上可重组 | 即时终局（投过票就不撤） | 即时终局，更快 |
| 复杂度/开销 | 最低 | 中 | 中 |
| 适合场景 | 测试、小规模可信链 | 联盟链（传统选择） | **生产级联盟链首选** |

### 2.6 对本指南使用者的实际意义

- **本地随便玩玩 / 学习** → 本指南的 dev 模式（或 Clique）足够，最省事；
- **和几个合作伙伴搭联盟链、要上生产** → 用 QBFT；
- 切换共识只需修改 genesis（创世）配置文件里的 `engine` 字段并重启，
  **不需要换软件**——这是 Besu "一个客户端、多种共识"的核心卖点。

---

# 第二部分：搭建本地链

> 从零开始：装 Java、下 Besu、启动、踩坑、验证——每一步都记录“做了什么、为什么、怎么解决”。

---

## 3. 整体思路：搭建需要哪几步

搭一套 Besu 本地链，本质上只有三件事：

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│ ① 装 Java   │ ───► │ ② 下载 Besu  │ ───► │ ③ 启动并验证 │
│  运行时      │      │   本体        │      │   出块和交易  │
└─────────────┘      └──────────────┘      └──────────────┘
```

- Besu 是 Java 程序，所以必须先有 **JDK**（Java 运行环境）。
- 然后下载 Besu 官方编译好的**发行包**（一个压缩包，解压就能用）。
- 最后用一条命令启动，并通过 **JSON-RPC 接口**（HTTP 请求）验证它在出块。

本次搭建的实际目录结构（全部在 `~/Desktop/DigitalLabs-web3/besu-local/` 下）：

```
besu-local/
├── besu-24.12.2/                 ← 实际使用的 Besu（支持本地 dev 链）
├── besu-24.12.2.tar.gz           ← 原始压缩包（sha256 已校验）
├── besu-26.9.0/                  ← 最新版（已装好，但不支持 dev 单机链，保留备用）
├── zulu25.36.205-...macosx_x64/  ← JDK 25（免安装版，当前生效）
├── zulu21.52.203-...macosx_x64/  ← JDK 21（备用）
├── data-dev/                     ← 节点 1 的区块链数据目录
├── data-node2/                   ← 节点 2 的区块链数据目录
├── send_dev_tx.js                ← 发交易验证脚本（ethers.js）
└── Besu本地链与智能合约开发指南.md ← 本文档（合并版）
```

---

## 4. 第一步：安装 Java 运行时

### 4.1 为什么需要 Java

Besu 官方发行包里带有启动脚本 `bin/besu`，它本质上是调用系统的
`java` 命令来运行一个 JAR 程序。**没有 Java，Besu 一行代码都跑不起来。**

验证方法：

```sh
java -version
# 如果提示 "Unable to locate a Java Runtime"，说明没装
```

### 4.2 三种安装方式与我们的选择

| 方式 | 命令 | 本次结果 |
|---|---|---|
| Homebrew | `brew install openjdk@21` | ❌ `/usr/local/Cellar is not writable`，需要 sudo 修复权限 |
| Adoptium(官方Temurin) | API 下载 | ❌ 重定向到 github.com 后超时（网络问题） |
| **Azul Zulu tar.gz 免安装版** | 从 Azul CDN 下载解压 | ✅ **成功，国内直连速度快** |

> **免安装版的好处**：不污染系统、不需要管理员权限、可以精确控制版本。
> 缺点是要自己设置 `JAVA_HOME` 环境变量。

### 4.3 具体操作

从 Azul 官方 CDN 下载 JDK 25（x64 macOS 版）：

```sh
cd ~/Desktop/DigitalLabs-web3/besu-local

# JDK 25（Besu 26.x 要求 Java 25+，向下兼容 Besu 24.x）
curl -fL -o jdk25.tar.gz \
  "https://cdn.azul.com/zulu/bin/zulu25.36.205-ca-jdk25.0.4.1-macosx_x64.tar.gz"
tar xzf jdk25.tar.gz
```

**每次使用 Besu 前**（或写进 `~/.zshrc` 长期生效），设置 JAVA_HOME：

```sh
export JAVA_HOME=/Users/i/Desktop/DigitalLabs-web3/besu-local/zulu25.36.205-ca-jdk25.0.4.1-macosx_x64/Contents/Home
```

> macOS 的 tar 包解压后 Java 家目录在 `xxx/Contents/Home`，这是 macOS 应用
> 包结构的特点，别漏掉 `Contents/Home`。

验证：

```sh
$JAVA_HOME/bin/java -version
# openjdk version "25.0.4.1"   ← 成功
```

---

## 5. 第二步：下载 Besu

### 5.1 从哪里下载

- Homebrew 没有 Besu 的 formula（`brew install besu` 会报 "No available formula"）。
- 官方渠道是 **GitHub Releases**：https://github.com/besu-eth/besu/releases
  （注意：仓库从 `hyperledger/besu` 迁移到了 `besu-eth/besu`）
- 也可以 `docker pull hyperledger/besu`，但本次国内 Docker 镜像源全部失效
  （daocloud 403、1ms.run not found、xuanyuan 超时……），所以走 GitHub 直下载。

### 5.2 下载与校验

```sh
cd ~/Desktop/DigitalLabs-web3/besu-local

# 通过本地 VPN 代理下载（203MB，直连 github.com 会超时）
curl -x http://127.0.0.1:10808 -fL -o besu-24.12.2.tar.gz \
  "https://github.com/besu-eth/besu/releases/download/24.12.2/besu-24.12.2.tar.gz"

# 校验文件完整性（sha256 必须和官方发布的一致）
shasum -a 256 besu-24.12.2.tar.gz
# 期望值: 13b48efbe0a14c8f1c957ce45acc1832876412ab9ccbe3cbd0d6631ace34ed11 ✅

tar xzf besu-24.12.2.tar.gz
```

> **为什么要校验 sha256**：确认下载过程没有损坏、没有被中间人篡改。
> 官方每个 Release 页面都附带校验和。

验证 Besu 可运行：

```sh
./besu-24.12.2/bin/besu --version
# besu/v24.12.2/osx-x86_64/zulu-java-25   ← 成功
```

---

## 6. 第三步：启动本地链（以及为什么不能直接用最新版）

### 6.1 一个重要的"坑"：新版 Besu 删掉了 dev 模式

最初我们下载的是最新版 **Besu 26.9.0**，用经典的开发链命令启动：

```sh
besu --network=dev ...
```

直接被拒绝，报错：

```
--network=dev is no longer supported and Besu will not start.
PoW mining has been removed; this network cannot produce blocks.
```

**解释**：`--network=dev` 是 Besu 提供的"单机开发链"模式——一条只有你一个人、
自动出块、内置测试账户的链。从 2025 年起（25.x/26.x 版本），官方**彻底移除**了这个模式，
推荐改用 Ephemery 或 Kurtosis 等更重的方案。

**解决办法**：回退到最后一个支持 `--network=dev` 的稳定版本系列 —— **24.12.2**。
（这也是为什么目录里同时有 26.9.0 和 24.12.2 两个版本。）

### 6.2 启动节点 1

```sh
export JAVA_HOME=/Users/i/Desktop/DigitalLabs-web3/besu-local/zulu25.36.205-ca-jdk25.0.4.1-macosx_x64/Contents/Home

/Users/i/Desktop/DigitalLabs-web3/besu-local/besu-24.12.2/bin/besu \
  --network=dev \
  --sync-min-peers=1 \
  --rpc-http-enabled \
  --rpc-http-api=ETH,NET,WEB3,DEBUG,TXPOOL,MINER,ADMIN \
  --host-allowlist="*" \
  --data-path=/Users/i/Desktop/DigitalLabs-web3/besu-local/data-dev
```

参数逐个解释：

| 参数 | 含义 |
|---|---|
| `--network=dev` | 使用内置的单机开发链配置（chainId=1337，1 秒出块间隔） |
| `--sync-min-peers=1` | 至少 1 个 peer 就开始同步（**默认 5，是本次最大的坑**，见第 7 节） |
| `--rpc-http-enabled` | 开启 HTTP RPC 接口（默认端口 8545），这是所有工具连接链的入口 |
| `--rpc-http-api=...` | 开放哪些 API 命名空间：ETH（读写链）、NET（节点信息）、DEBUG、TXPOOL（交易池）、MINER（挖矿）、ADMIN（节点管理） |
| `--host-allowlist="*"` | 允许任意来源的 HTTP 请求访问 RPC（本地开发用，生产环境必须收紧！） |
| `--data-path=...` | 区块链数据（区块、世界状态、密钥）存放目录 |

看到日志里出现这一行，说明节点进程起来了：

```
INFO | Runner | Ethereum main loop is up.
```

### 6.3 但此时链还不会出块！

日志里会反复刷：

```
FullSyncTargetManager | Unable to find sync target.
Waiting for 5 peers minimum. Currently checking 0 peers for usefulness
```

**这是什么意思？** Besu 的同步器认为"一条正经链至少应该有 5 个节点跟我同步"，
它找不到对等节点，就拒绝开始干活（包括出块）。这就是下一节要解决的核心问题。

---

## 7. 第四步：踩坑与解决——链不出块

### 7.1 问题本质

dev 模式（PoW 性质）的出块逻辑被同步器"卡"住了：
节点必须先进入"已同步"状态才会挖矿出块，而进入同步状态的前提是达到最低 peer 数。

### 7.2 解决方案：两步走

**① 把最低 peer 数降到 1**

`--sync-min-peers=1`（见 6.2 的启动命令）。改完后日志变成
"Waiting for 1 peers minimum"——但 0 个 peer 仍然不满足条件。

**② 再起第二个 Besu 节点，两个节点互联**

单节点无法满足"至少有 1 个 peer"，所以我们干脆起两个节点。
这其实更接近真实区块链的形态：**链 = 多个节点互相广播**。

节点 2 启动（另开一个终端）：

```sh
export JAVA_HOME=/Users/i/Desktop/DigitalLabs-web3/besu-local/zulu25.36.205-ca-jdk25.0.4.1-macosx_x64/Contents/Home

/Users/i/Desktop/DigitalLabs-web3/besu-local/besu-24.12.2/bin/besu \
  --network=dev \
  --sync-min-peers=1 \
  --p2p-port=30304 \
  --rpc-http-port=8546 \
  --rpc-http-enabled \
  --rpc-http-api=ETH,NET,WEB3,ADMIN \
  --host-allowlist="*" \
  --data-path=/Users/i/Desktop/DigitalLabs-web3/besu-local/data-node2
```

注意节点 2 换了端口（P2P 用 30304、RPC 用 8546），避免和节点 1 冲突。
（`--p2p-port` 这个参数名也踩了一次坑：不是 `--port`。）

**③ 手动把两个节点连起来**

区块链节点之间通过 `enode://公钥@ip:端口` 这种"enode 地址"互相识别。
先查各自的 enode：

```sh
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"admin_nodeInfo","params":[],"id":1}' \
  http://127.0.0.1:8545 | python3 -m json.tool | grep enode
```

然后互相添加对方为 peer（两个方向各加一次）：

```sh
# 让节点 2 连节点 1
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"admin_addPeer","params":["enode://<节点1的公钥>@127.0.0.1:30303"],"id":1}' \
  http://127.0.0.1:8546

# 让节点 1 连节点 2
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"admin_addPeer","params":["enode://<节点2的公钥>@127.0.0.1:30304"],"id":1}' \
  http://127.0.0.1:8545
```

返回 `"result": true` 即成功。验证：

```sh
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}' \
  http://127.0.0.1:8545
# {"result":"0x1"}  ← 有 1 个 peer 了 ✅
```

**连接成功后，链立刻开始出块**，每隔约 1 秒产生一个新区块：

```sh
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://127.0.0.1:8545
# {"result":"0x20"}  ← 已经出到第 32 个块，而且一直在涨 ✅
```

---

## 8. 第五步：验证链真的在工作

出块只是"心跳正常"，还要验证**交易能被执行**。这里有个概念要先讲：

> **JSON-RPC 是什么？**
> Besu 对外提供一个 HTTP 接口（默认 `http://127.0.0.1:8545`），
> 所有操作——查余额、发交易、部署合约——都是往这个地址 POST 一段 JSON。
> MetaMask、Hardhat、ethers.js、web3.py 底层全是这么干的。

### 8.1 只读查询（curl 就够）

```sh
# 查最新区块高度
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://127.0.0.1:8545
# → {"jsonrpc":"2.0","id":1,"result":"0x2e"}

# 查链 ID（1337 = 0x539，dev 链固定值）
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":2}' \
  http://127.0.0.1:8545
# → {"result":"0x539"}
```

### 8.2 发送一笔真实交易

**重要知识点：发交易必须"签名"。**
区块链靠私钥证明"这个账户的钱是我的"。发送方用私钥对交易签名，
网络用密码学验证签名后才会执行。所以不能像查询那样随便发。

Besu 出于安全考虑，**不开放** `eth_sendTransaction`（让节点帮你签名的方式），
只接受你自己签好名的 `eth_sendRawTransaction`。

本次用 Python 的 `eth-account` 库完成签名（也可以换成 ethers.js / web3.py）：

```python
from eth_account import Account
import json, urllib.request

RPC = "http://127.0.0.1:8545"
def rpc(method, params=None):
    req = urllib.request.Request(RPC, data=json.dumps({
        "jsonrpc":"2.0","method":method,"params":params or [],"id":1
    }).encode(), headers={"Content-Type":"application/json"})
    return json.loads(urllib.request.urlopen(req).read())["result"]

# 1. 生成一个新账户（真实场景中账户由你保管的私钥决定）
test = Account.create()

# 2. 构造并签名一笔交易
signed = Account.sign_transaction(
    {"to": "0x0000000000000000000000000000000000000099",  # 收款地址
     "value": 0,          # 转账金额（wei）
     "gas": 53000,        # 燃料上限
     "gasPrice": 0,       # dev 链允许 0 手续费
     "nonce": 0,          # 账户交易计数器
     "chainId": 1337},
    test.key)

# 3. 把签名后的原始交易广播到网络
h = rpc("eth_sendRawTransaction", ["0x" + signed.raw_transaction.hex()])
print("交易哈希:", h)

# 4. 查询回执（交易被打包进哪个块、是否成功）
import time; time.sleep(3)
receipt = rpc("eth_getTransactionReceipt", [h])
print("回执:", receipt)
```

实际运行结果：

```
交易哈希: 0xa97ebdbbe86c...
回执: block 0x2d, status 0x1 (成功), gasUsed 21000 ✅
```

**`status: 0x1` 代表交易成功执行，`gasUsed: 21000` 是一笔普通转账的标准燃料消耗。**
到这一步，一条功能完整的本地以太坊虚拟机（EVM）链就搭好了。

### 8.3 查询已经产生的区块

所有查询都通过 RPC（`http://127.0.0.1:8545`）发 JSON 请求完成，
常用 4 个方法：

**① 查最新区块高度 — `eth_blockNumber`**

```sh
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://127.0.0.1:8545
# → {"result":"0xa76"}   ← 十六进制，0xa76 = 第 2678 块
```

**② 按编号查区块详情 — `eth_getBlockByNumber`**

```sh
# 查第 100 块（编号要写成十六进制，100 = 0x64）
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["0x64",false],"id":1}' \
  http://127.0.0.1:8545 | python3 -m json.tool
```

参数说明：

- 第一个参数 `"0x64"`：区块编号（十六进制字符串），也可以用特殊值
  `"latest"`（最新）/ `"earliest"`（创世）/ `"pending"`；
- 第二个参数 `false`：只看区块头摘要；改成 `true` 会把块里
  **每笔交易的完整内容**也带出来。

返回结果里的关键字段：

| 字段 | 含义 |
|---|---|
| `number` | 区块高度 |
| `hash` | 本区块的指纹（唯一 ID） |
| `parentHash` | 上一个区块的指纹 —— **就是它把区块"链"成"区块链"** |
| `miner` | 出块人地址 |
| `timestamp` | 出块时间（Unix 秒） |
| `gasUsed` / `gasLimit` | 本块燃料消耗/上限 |
| `transactions` | 交易列表（数组长度 = 本块交易数） |

实测两个例子正好能看出规律：

```
第 0 块（创世块）: miner = 0x0000...0000（创世块没有出块人）
最新块  0xa76:    miner = 0x0000...0099（之前用 miner_setEtherbase 设置的地址）
```

**实例精读：第 100 号区块的完整返回**

下面是本地链上第 100 块（`eth_getBlockByNumber ["0x64", false]`）的真实返回，
逐字段解释：

```json
{
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
        "number": "0x64",
        "hash": "0xe653b3d5395dcdf5c9e53112dae3fd5dfdf5609bcc9ecbf539c40279df266fae",
        "mixHash": "0x19a31fece9e03366e22dbc029dca5d2b0db98eb7c09f0bfad7e48bb5197e9af6",
        "parentHash": "0xf9cf73022b7526476b6c1be238b0435618c8e51d98c7e8a7dd4302457f8bc5f4",
        "nonce": "0x2443d917c75b51d0",
        "sha3Uncles": "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
        "logsBloom": "0x00000000...（1024 个 0）...0000",
        "transactionsRoot": "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421",
        "stateRoot": "0xa7d18698adfe68e38fb83926bd329c797e93cbab775e07eb20d4c2ae6066668f",
        "receiptsRoot": "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421",
        "miner": "0x0000000000000000000000000000000000000099",
        "difficulty": "0x64",
        "totalDifficulty": "0x12710",
        "extraData": "0x",
        "baseFeePerGas": "0x0",
        "size": "0x201",
        "gasLimit": "0x1fffffffffffff",
        "gasUsed": "0x0",
        "timestamp": "0x6ace1726",
        "uncles": [],
        "transactions": []
    }
}
```

**A. 身份标识类**

| 字段 | 本例值 | 含义 |
|---|---|---|
| `number` | `0x64` | 区块高度 = 第 100 块（创世块是第 0 块） |
| `hash` | `0xe653b3d5...` | **本区块的指纹**：对区块头做 SHA-256/Keccak 哈希得到，唯一 ID。改区块里任何一个字节，hash 就完全变样——这就是"防篡改" |
| `parentHash` | `0xf9cf7302...` | **上一块（第 99 块）的 hash**。每块都记录前一块的指纹，环环相扣，所以叫"区**块链**"。验证一条链是否完整，就是逐块检查这个引用对不对 |

**B. 共识相关类（PoW 时代遗产 + 出块人）**

| 字段 | 本例值 | 含义 |
|---|---|---|
| `miner` | `0x0000...0099` | 出块人/挖矿奖励地址——正是我们之前用 `miner_setEtherbase` 设置的地址，出块奖励都发到这里 |
| `difficulty` | `0x64` | 本块的"挖矿难度"。dev 链不出真力，是固定假值（100） |
| `totalDifficulty` | `0x12710` | 从创世块到本块的累计难度（= 100 × 101 = 0x2710 的链上变体，PoW 链用它比较哪条链"更重"）。PoS 后已废弃 |
| `nonce` | `0x2443d917c75b51d0` | PoW 的"猜数答案"：挖矿就是反复换 nonce 直到区块 hash 满足难度要求。dev 链是摆设 |
| `mixHash` | `0x19a31fec...` | PoW 的另一个辅助哈希（配合 nonce 使用）。同为遗产字段 |
| `uncles` | `[]` | "叔块"列表：PoW 网络里两人同时出块，落选那块作为叔块收录以补偿矿工。dev 链没有竞争，恒为空 |
| `sha3Uncles` | `0x1dcc4de8...` | 叔块列表的哈希。本例正是**空列表的 Keccak-256 标准值**（全以太坊的空列表都长这样，可当"暗号"认出来） |

**C. 三棵默克尔树根（Merkle Root）—— 区块链的"目录指纹"**

区块头不直接存交易明细，只存三棵默克尔树的"树根哈希"，像书的目录：

| 字段 | 含义 |
|---|---|
| `transactionsRoot` | **交易树根**：本块所有交易的摘要。想证明"某笔交易在这个块里"，只需给一条几十字节的"路径"（Merkle Proof），不用下载整个块。本块没交易，所以是空树的标准值（和 sha3Uncles 同值） |
| `stateRoot` | **世界状态树根**：全链所有账户的余额、存储、nonce 的总摘要。这是以太坊最精妙的设计——**一个 32 字节的哈希就能代表全球所有账户的状态**，任何一笔余额变动都会沿树传导到这个根，改不动的 |
| `receiptsRoot` | **回执树根**：本块所有交易执行结果（成功/失败、事件日志）的摘要 |

**D. 执行/资源类**

| 字段 | 本例值 | 含义 |
|---|---|---|
| `gasLimit` | `0x1fffffffffffff` | 本块允许消耗的最大燃料（约 9000 万亿，dev 链故意设得极大，随便造） |
| `gasUsed` | `0x0` | 本块实际消耗的燃料。本块没有交易，所以为 0 |
| `baseFeePerGas` | `0x0` | EIP-1559 的"基础燃料费"（主网每块自动调节）。dev 链设为 0——这就是我们发交易可以用 `gasPrice: 0` 的原因 |
| `size` | `0x201` | 区块编码后的字节大小 = 513 字节（空块自然很小） |
| `timestamp` | `0x6ace1726` | 出块的 Unix 时间戳（秒）。换算：`python3 -c "print(int('0x6ace1726',16))"` |

**E. 其他**

| 字段 | 本例值 | 含义 |
|---|---|---|
| `extraData` | `0x` | 出块人可自填的最多 32 字节自由数据（主网矿工常写矿池名字）。dev 链为空 |
| `logsBloom` | 全 0 | **日志过滤器**：2048 位的"布隆过滤器"，把本块事件日志里的关键词折叠成位图，让"在几百万个块里搜某事件"变快。本块无日志所以全 0 |
| `transactions` | `[]` | 因为请求第二个参数是 `false` 且本块无交易。若块里有交易且参数为 `true`，这里会展开每笔交易的完整内容（from/to/value/input 等） |

**一句话总结**：区块 = **身份**（hash/parentHash 连成链）+ **共识凭证**（miner/difficulty/nonce）
+ **三棵目录树**（交易/状态/回执的树根，让任何人能高效且防篡改地核对任意数据）
+ **资源账本**（gas 与时间戳）。其中 `hash` 链 + `stateRoot` 是"区块链不可篡改"的两大支柱。

**③ 按哈希查 — `eth_getBlockByHash`**

```sh
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBlockByHash","params":["0x区块哈希",false],"id":1}' \
  http://127.0.0.1:8545
```

**④ 顺藤摸瓜遍历整条链**

区块之间靠 `parentHash` 首尾相连，从任意一块可以一路回溯到创世块：

```
块 #3 (hash=C, parentHash=B)  ←  块 #2 (hash=B, parentHash=A)  ←  块 #1 ...
```

**实用小技巧：**

```sh
# 观察区块高度实时增长（出块心跳，每秒刷新）
watch -n 1 'curl -s -X POST -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_blockNumber\",\"params\":[],\"id\":1}" \
  http://127.0.0.1:8545'

# 十六进制转十进制
python3 -c "print(int('0xa76', 16))"   # → 2678
```

> 想看图形化界面的话：本地链默认没有区块浏览器。可以把
> **Blockscout**（一个开源的以太坊区块浏览器，本工作区就有该项目）
> 部署起来连接到本地链，就能像 etherscan 那样可视化浏览每个区块。

### 8.4 出块节奏：这条链每 1 秒出一个块吗？

**是的。** 实测：20 秒内区块高度从 3052 涨到 3072，正好 20 个块，
相邻块平均间隔 **1.00 秒**。

**为什么是 1 秒？**
这是 Besu `--network=dev` 内置写死的默认配置
（dev 网络的 genesis 里 `blockperiodseconds: 1`）。

**两个容易误解的细节：**

**① "空块"也会照样出**

大部分块 `transactions: []`、`gasUsed: 0`——没有任何交易也照出不误。
这是"**固定间隔出块**"（block period）模式：心跳式出块，不管有没有活干。
链 24 小时跑一天，就会多出约 8.6 万个几乎全空的块。

对比两种出块模式：

| 模式 | 代表 | 行为 |
|---|---|---|
| 固定心跳 | Besu dev（1 秒）、以太坊主网（12 秒） | 到点就出块，没交易也出空块 |
| 交易驱动 | Anvil / Ganache 默认 | 有交易才出块，链高"停住不动"是正常的 |

**② 间隔可以改（dev 模式不行，自定义 genesis 可以）**

例如 Clique PoA 的创世配置里：

```json
// genesis.json 片段 —— Clique 共识，15 秒出块
"engines": {
  "clique": {
    "params": {
      "blockperiodseconds": 15,
      "epochlength": 30000
    }
  }
}
```

联盟链生产环境常设 3~5 秒；IBFT/QBFT 通常设 `blockperiodseconds: 0`
（有交易立即出块，空转不产块）。

**对使用的实际影响：**

- **磁盘**：空块很小（约 500 字节/块），一天约 40~50MB，本地开发无所谓；
- **按时间找块**：时间戳均匀分布，用 `timestamp` 字段定位区块很方便；
- **排障**：如果哪天区块高度不涨了，先查两个节点的 peer 是否断开
  （`net_peerCount`），这是 dev 链"停跳"的最常见原因。

### 8.5 延伸阅读：交易驱动 vs 时间驱动出块方式对比

> 澄清一个常见误解：不是"Anvil/Ganache 只有交易驱动"——它们其实
> **两种模式都支持**（如 `anvil --block-time 5` 可切成每 5 秒定时出块），
> 只是默认选了交易驱动；而 Besu dev、以太坊主网默认是固定间隔。

**原理回顾：**

```
交易驱动（on-demand）：
  交易进入 → 立即打包出块 → 没交易就不出块
  区块高度：0 → 0 → 0 → (来交易) → 1 → 1 → (来交易) → 2

时间驱动（interval / blockperiod）：
  心跳倒计时，到点就出块，不管有没有交易
  区块高度：0 → 1 → 2 → 3 → 4 → 5 ...（每秒 +1，块大多为空）
```

**逐项对比：**

| 维度 | 交易驱动 | 时间驱动 |
|---|---|---|
| 等待时间 | 交易几乎立即入块（毫秒级）| 最坏要等一个完整间隔（如 1~12 秒）|
| 开发体验 | 脚本/测试跑得快，CI 时间大幅缩短 | 每个交易都要等心跳，测试套件被拖慢 |
| 磁盘占用 | 极省——没交易就没块 | 浪费——空闲时不停产空块（Besu dev 一天约 8.6 万个空块）|
| 区块高度可预测性 | 不可预测，取决于交易流量 | **完全可预测**：高度 = 时间 ÷ 间隔 |
| 时间相关逻辑测试 | 差——块间隔不固定，`timestamp` 跳跃不规则，需手动 `evm_increaseTime` | 好——时间戳严格均匀，按时间找块、测时间锁很直观 |
| 模拟真实环境 | 不像真实链（真实链从不"停"）| **接近真实**：以太坊主网就是固定 12 秒心跳 |
| 依赖"新块到来"的功能 | 会失效：轮询新块的订阅（`eth_subscribe newHeads`）、依赖 `block.number` 递增的逻辑要特殊处理 | 天然正常 |
| 链"停住"的含义 | 正常现象（只是没交易）| **异常信号**（节点或 peer 断了）|
| 出块时刻的边界条件 | 难测试（"块快满了""恰好跨块"等时序场景）| 容易复现稳定时序 |
| 代表 | Anvil / Ganache 默认 | Besu dev、以太坊主网（12s）、绝大多数联盟链（Clique/QBFT 配 blockperiod）|

**什么时候用哪个？**

选**交易驱动**（Anvil/Ganache 默认）：

- 写单元测试、跑 Hardhat/Foundry 测试套件——速度就是金钱；
- 手动调试合约：发一笔看一笔，不想干等；
- 本地临时链，跑完就扔，不在乎磁盘。

选**时间驱动**（`--block-time N` 或 Besu）：

- 测试依赖时间/块号推进的逻辑：时间锁解锁、拍卖截止、质押计息、预言机心跳上报；
- 测试依赖 `newHeads` 订阅、轮询块的服务端代码（机器人、索引器、后端 watcher）；
- 模拟接近生产的环境（主网 12 秒心跳、联盟链 QBFT 组网）；
- 需要"区块高度 ↔ 时间点"一一对应的可复现实验。

**一句话记忆：**

> 交易驱动优化的是"**开发者等结果的时间**"；
> 时间驱动优化的是"**和生产环境的相似度**"。
> 测业务逻辑用前者，测时间语义和链上服务用后者。

### 8.6 实战：把出块间隔从 1 秒改为 15 秒（Clique 自定义链）

dev 模式的 1 秒间隔是**编译期写死**的，无法用参数修改。
要自定义出块间隔，正确做法是：**编写 Clique PoA 创世配置（genesis 文件），
用 `--genesis-file` 替代 `--network=dev` 启动**。以下是完整实操
（已在本地验证成功，产物在 `besu-local/clique-15s/` 目录）。

**步骤 1：编写创世文件 `clique-15s/genesis.json`**

核心是 `clique` 段——**以后改出块间隔就改 `blockperiodseconds`**：

```json
{
  "config": {
    "chainId": 1337,
    "homesteadBlock": 0, "eip150Block": 0, "eip155Block": 0,
    "eip158Block": 0, "byzantiumBlock": 0, "constantinopleBlock": 0,
    "petersburgBlock": 0, "istanbulBlock": 0, "berlinBlock": 0,
    "londonBlock": 0,
    "clique": {
      "blockperiodseconds": 15,
      "epochlength": 30000
    }
  },
  "difficulty": "0x1",
  "extraData": "0x<32字节0 + 出块人地址 + 65字节0，见步骤2>",
  "gasLimit": "0x1fffffffffffff",
  "coinbase": "0x0000000000000000000000000000000000000000",
  "alloc": { "0x<出块人地址>": { "balance": "0x29a2241af62c0000" } }
}
```

**步骤 2：生成出块账户（sealer）并写入白名单**

Clique 必须有白名单出块人。用 Python 生成账户，并把地址按
**固定格式**填进 `extraData`（32 字节空 + 20 字节地址 + 65 字节空，
总长必须 236 字符含 `0x`）：

```python
import json
from eth_account import Account

# 生成 sealer 私钥（注意：必须是完整 32 字节 / 64 个十六进制字符！）
acct = Account.create()
key = acct.key.hex()
assert len(key) == 64            # 防坑：随机数不足 32 字节时补齐重新生成
open("node1.key", "w").write(key)   # 私钥文件 = 节点的出块身份

extra = "0x" + "00"*32 + acct.address[2:].lower() + "00"*65
g = json.load(open("genesis.json"))
g["extraData"] = extra
g["alloc"] = {acct.address: {"balance": "0x29a2241af62c0000"}}  # 预置 3 ETH
json.dump(g, open("genesis.json", "w"), indent=2)
print("sealer:", acct.address)
```

顺带的福利：`alloc` 预置余额补上了 dev 链"没有预 funded 账户"的短板。

**步骤 3：启动两个节点（用 `--genesis-file` 替代 `--network=dev`）**

```sh
export JAVA_HOME=/Users/i/Desktop/DigitalLabs-web3/besu-local/zulu25.36.205-ca-jdk25.0.4.1-macosx_x64/Contents/Home
BESU=/Users/i/Desktop/DigitalLabs-web3/besu-local/besu-24.12.2/bin/besu
G=/Users/i/Desktop/DigitalLabs-web3/besu-local/clique-15s/genesis.json

# 节点 1（出块节点，必须带上 sealer 私钥）
$BESU --genesis-file=$G \
  --node-private-key-file=/Users/i/Desktop/DigitalLabs-web3/besu-local/clique-15s/node1.key \
  --rpc-http-enabled --rpc-http-api=ETH,NET,WEB3,DEBUG,TXPOOL,MINER,ADMIN \
  --host-allowlist="*" \
  --data-path=/Users/i/Desktop/DigitalLabs-web3/besu-local/clique-15s/data1

# 节点 2（普通节点）
$BESU --genesis-file=$G --p2p-port=30304 --rpc-http-port=8546 \
  --rpc-http-enabled --host-allowlist="*" \
  --data-path=/Users/i/Desktop/DigitalLabs-web3/besu-local/clique-15s/data2
```

互联方法与 9.1 节"终端 3"完全相同（互相 `admin_addPeer`）。

**验证结果（实测）：**

```
区块 0x2 → 0x3 → 0x4 → 0x5，相邻间隔全部精确为 15 秒 ✅
节点 2 高度与节点 1 同步一致 ✅
```

两个说明：

- Clique 链的 `miner` 字段显示全零是**正常的**——Clique 的出块人记录在
  区块 `extraData` 的签名里，不写在 `miner` 字段（与 PoW/dev 链不同）；
- Clique 用 `--genesis-file` 时 `--sync-min-peers` 会被忽略（日志有提示），
  无需再加。

**踩坑记录**：第一次启动后高度一直是 0。原因是生成私钥时随机数恰好只有
31 字节，`node1.key` 的十六进制少了一位（63 字符），节点拿着无效密钥
就没有了出块身份。重新生成并保证 64 字符后正常。
教训：**改 genesis 或密钥后，务必清空 data 目录再启动**，
否则节点会拒绝用错误配置继续旧链。

**新旧链对比：**

| | 旧 dev 链 | Clique-15s 链 |
|---|---|---|
| 启动参数 | `--network=dev` | `--genesis-file=genesis.json` |
| 出块间隔 | 1 秒（写死不可改）| **15 秒（genesis 任意改）** |
| 共识 | PoW 遗产模式 | Clique PoA |
| 预置账户 | 无 | sealer 持有 3 ETH |
| 数据目录 | `data-dev` / `data-node2` | `clique-15s/data1` / `data2` |

 以后想再改间隔：停节点 → 编辑 `blockperiodseconds` →
 **删除 data1/data2** → 重启（创世配置变了就是另一条链，必须清空）。

### 8.7 Clique 的出块权与白名单（谁在出块？）

**Clique 的"轮流出块"由 genesis `extraData` 里的 sealer 白名单决定。**

规则：

1. **白名单 = 出块资格名单**。只有地址在名单里的节点才能出块，
   其他节点只能接收、验证、同步；
2. **轮班算法**：白名单有多人时，Clique 按"**已签名区块数量最少者优先**"
   轮班出块——数学上保证长期看每人出块数几乎均匀；
3. **我们当前的配置只白名单了 1 个 sealer**（节点 1 的 `node1.key`），
   所以"轮班表"上只有一个人值班，**实际只有节点 1 在出块**，
   节点 2 只是同步节点。

由此带来两个实际含义：

- **单点故障**：节点 1 停 → 全链停摆。节点 2 虽然活着但无权出块；
- **这正是联盟链的治理模型**：谁出块 = 谁有权记账，
  白名单就是"联盟成员名单"。生产联盟链会把各合作伙伴的节点都加进
  sealer 名单，实现真正的轮流出块与容灾。

**让多个节点轮流出块的两种方法：**

- **静态**：编写 genesis 时把多个 sealer 地址连续拼进 extraData
  的地址区（`32字节空 + 地址1 + 地址2 + ... + 65字节空`）；
- **动态**：已运行的链上用 `clique_propose` / `clique_discard` RPC
  增删 sealer（需经 2/3 以上现有 sealer 同意才生效，改动在 epoch
  边界生效）。

注意：2 个 sealer 会交替出块，但任意一个挂掉仍会停摆；
生产环境建议 3 个以上，并考虑 IBFT/QBFT（有投票防分叉）。
多 sealer 轮流出块的完整实操见 8.8 节。

### 8.8 实战：改造为节点 1 / 节点 2 轮流出块

目标：两个节点都是 sealer，按 Clique 机制交替出块（15 秒间隔不变）。

**步骤 1：为节点 2 生成 sealer 账户，重写 genesis 的 extraData**

Clique extraData 的多 sealer 格式：`32 字节空 + 地址1 + 地址2 + ... + 65 字节空`，
地址按**十六进制升序**排列：

```python
import json
from eth_account import Account

def make_key():
    while True:
        a = Account.create()
        if len(a.key.hex()) == 64:
            return a

a1 = Account.from_key("0x" + open("node1.key").read().strip())  # 沿用节点1的密钥
a2 = make_key()
open("node2.key", "w").write(a2.key.hex())

addrs = sorted([a1.address[2:].lower(), a2.address[2:].lower()])  # 升序
extra = "0x" + "00"*32 + "".join(addrs) + "00"*65

g = json.load(open("genesis.json"))
g["extraData"] = extra
g["alloc"] = {a1.address: {"balance": "0x29a2241af62c0000"},
              a2.address: {"balance": "0x29a2241af62c0000"}}
json.dump(g, open("genesis.json", "w"), indent=2)
print("sealer 1:", a1.address)
print("sealer 2:", a2.address)
```

**步骤 2：给节点 2 部署密钥，清空旧链数据**

```sh
cp node2.key data2/keys/nodekey   # 或直接启动时用 --node-private-key-file
rm -rf data1 data2                 # 创世配置变了 = 新链，必须清空
mkdir -p data1 data2
```

**步骤 3：重启两个节点（节点 2 也要带自己的 sealer 私钥）**

节点 2 的启动命令比之前多了 `--node-private-key-file=.../node2.key`，
其余与 8.6 节相同。互联后验证。

**步骤 4：验证轮流出块**

最直观的证据来自**两个节点的日志**：轮到谁，谁的日志里就出现
`BlockMiner | Produced #N`，另一方则是 `Imported empty block #N`（接收）。
实测两个节点的日志完美交替：

```
节点1: Produced #13 (20:50:40)   → Imported #14 → Produced #15 → Imported #16 → Produced #17
节点2: Produced #12 (20:50:25)   ← Imported #13 → Produced #14 → Imported #15 → Produced #16
```

即：节点 2 出 #12 → 节点 1 出 #13 → 节点 2 出 #14 → 节点 1 出 #15 ……
严格交替、间隔 15 秒、两个节点高度始终一致 ✅

其他验证手段：

- Besu 原生 Clique RPC（需启动时加 `--rpc-http-api=...,CLIQUE`）：
  `clique_getSigners` 查当前白名单、`clique_getSignersAtHash` 查历史；
- 用区块 extraData 尾部的 65 字节签名做 ECDSA 恢复也能算出签名者，
  但 sighash 的 RLP 编码规则细节多（要去掉签名段且不含 mixHash/nonce
  字段），手写容易出错——推荐直接看日志或用 CLIQUE API。

**实操结果（本次验证）：**

- sealer 1（节点 1）：`0xCbd6949b0328EDF919b2883afAF0d413CfE68438`
- sealer 2（节点 2）：`0x4370ba39aF409D0852EAA50A5dA67b9DA62F9293`
- 两个账户各预置 3 ETH；
- 双 sealer 交替出块验证通过；
- 现在的容灾能力：任一节点挂掉，另一个仍能独立出块（这是 2 sealer
  与单 sealer 的本质区别）；但仍无 BFT 投票，若两个节点产生分歧
  需要人工介入——生产环境请上 QBFT + 3 以上验证人。

### 8.9 Genesis（创世块）配置详解

#### 8.9.1 genesis 是什么？

区块链的**第 0 块**叫创世块（genesis block）。它特殊在：

- 它不是"挖"出来的，而是**写在配置文件里**的——这份配置就叫 genesis 文件；
- 它定义了这条链的**宪法**：用什么共识、链 ID 多少、初始谁有钱、
  支持哪些以太坊升级特性；
- **所有节点必须用一模一样的 genesis 文件**，哪怕差一个字节，
  算出的创世块哈希就不同，节点之间会互相判为"异端"而拒绝对话。
  这就是为什么每次改 genesis 后必须清空数据目录重建链。

Besu 用法：`besu --genesis-file=/path/to/genesis.json ...`（替代 `--network=dev`）。

#### 8.9.2 逐段解析我们的 `clique-15s/genesis.json`

**1. `config` —— 链的宪法**

```json
"config": {
  "chainId": 1337,
  "homesteadBlock": 0, "...": "其余升级同样设 0",
  "londonBlock": 0,
  "clique": { "blockperiodseconds": 15, "epochlength": 30000 }
}
```

`chainId: 1337` —— 链的身份证号（1337 是本地开发惯例；主网 1，
Sepolia 11155111）。作用：① 防止交易跨链重放——交易签名把 chainId
算进去，签名只在本网有效；② 节点互联时身份不同直接拒连。
**自己搭联盟链第一件事就是分配一个不冲突的 chainId。**

那堆 `xxxBlock: 0` —— 以太坊每隔一段时间会升级（硬分叉），每次升级
有代号。这些字段声明"**该升级从第几个区块开始生效**"：

| 字段 | 引入了什么 |
|---|---|
| `homesteadBlock` | 以太坊第一次升级（2016，DAO 事件后）|
| `eip150Block` / `eip155Block` / `eip158Block` | 调整 gas 计价；EIP-155 把 chainId 纳入交易签名 |
| `byzantiumBlock` | zk-SNARKs opcode、revert 不烧完 gas |
| `constantinopleBlock` / `petersburgBlock` | 降低挖矿奖励、新增 opcode |
| `istanbulBlock` | IBFT 相关 opcode（`CHAINID`、`SELFBALANCE`）|
| `berlinBlock` | gas 优化 |
| `londonBlock` | **EIP-1559 基础燃料费**（8.3 节区块字段 `baseFeePerGas` 的来源）|

全写 `0` 意思是"**新链从第 0 块起就具备全部现代特性**"，不必模拟历史。
没写的升级 = 不支持。新链通常就这么全设 0（要更新的可加 `"shanghaiTime": 0` 等）。

`clique` 段 —— 声明共识机制（换成 `"qbft": {...}` 就是 QBFT，
这就是第 2 章"一个客户端多共识"的实现方式）：

- `blockperiodseconds: 15` —— 出块间隔秒数；**0 = 有交易才出块**；
- `epochlength: 30000` —— **纪元长度**：每 30000 块一个"纪元"，
  新区元第一块才能更新 sealer 白名单。为什么？Clique 轻客户端靠
  "检查最近 64 个签名者"验证链——若白名单随时可改立即生效，篡改历史
  将无法被发现；设纪元后，换名单必须在完整纪元边界生效，给全网
  确认时间。本地链几乎用不到改名单，保持 30000 默认即可。

**2. `extraData` —— 共识引擎的数据段（格式最讲究）**

```
0x [32字节 0] [sealer1地址20B] [sealer2地址20B] [65字节 0]
```

Clique 创世格式的固定结构：

| 部分 | 长度 | 含义 |
|---|---|---|
| 开头 32 字节 0 | 32B | 保留段（矿工时代用于自由留言）|
| **sealer 地址列表** | 20B × N | **出块白名单**。我们的文件有 2 个：`4370...9293`（节点2）、`cbd6...8438`（节点1），**必须按十六进制升序** |
| 结尾 65 字节 0 | 65B | 创世块签名占位（创世无人签，填 0；运行期普通块此处是真签名）|

我们的文件验证：`2 + 64 + 40 + 40 + 130 = 276` 字符 ✓

注意这个字段**格式随共识机制变化**：QBFT/IBFT2 各有自己的要求，改错直接拒绝启动。

**3. `difficulty` / `gasLimit` / `coinbase` —— 创世块的区块头种子值**

创世块也是区块，这些字段写的是**第 0 块的初始值**：

- `difficulty: "0x1"` —— 创世难度 1。Clique 不靠难度出块，写 1 只是惯例
  （Geth 私有链惯用 `0x20000`，Besu 文档用 1，全网一致即可）；
- `gasLimit: "0x1fffffffffffff"` —— ≈9000 万亿，故意设巨大，
  本地开发永不因块空间不足拒交易（主网约 3000 万）；
- `coinbase: "0x00...00"` —— 创世块"出块人"占位（无人）。
  运行期每块的 coinbase 由出块节点填自己。

**4. `alloc` —— 创世账户分配表（"初始富豪榜"）**

```json
"alloc": {
  "0xCbd6...8438": { "balance": "0x29a2241af62c0000" },
  "0x4370...9293": { "balance": "0x29a2241af62c0000" }
}
```

**链诞生瞬间就存在的账户与余额**——相当于"开国财政分配"：

- 键是地址；值里 `balance` 单位是 **wei**（1 ETH = 10¹⁸ wei）。
  `0x29a2241af62c0000` = 2×10¹⁸ wei = **正好 3 ETH**；
- 这就是我们链上预置 3 ETH 账户的来源（补上 dev 模式无预置账户的短板）；
- 除 `balance` 外还可写 `"code": "0x..."`（创世即部署的合约字节码）
  和 `"storage"`（预填合约存储），私有链初始化数据会用到；
- 主网创世 alloc 曾把巨量币分给早期贡献者；自己搭链只给测试账户
  打钱，**别把真实资产地址写进去**。

#### 8.9.3 容易踩的坑清单

| 坑 | 现象 | 正确做法 |
|---|---|---|
| 改了 genesis 不清数据 | 节点拒绝启动，报 genesis hash 不匹配 | 改配置 = 新链，`rm -rf data*` 重来 |
| 多节点 genesis 不一致 | 连不上 / 互相断开 | 所有节点用**同一份文件**（可校验 sha256）|
| extraData 里 sealer 没排序 | 出块人计算错乱 | 地址按十六进制升序 |
| sealer 节点没配 `--node-private-key-file` | 白名单节点也不出块（8.6 节踩坑实录）| 出块节点显式指定密钥文件 |
| alloc 余额单位写成 ETH | 差 10¹⁸ 倍 | 一律写 wei |
| chainId 与他人测试链撞车 | 交易广播到别人的链 | 联盟链申请独立 chainId |

#### 8.9.4 最小可用模板（Clique 单 sealer）

```json
{
  "config": {
    "chainId": 20261,
    "londonBlock": 0,
    "clique": { "blockperiodseconds": 5, "epochlength": 30000 }
  },
  "difficulty": "0x1",
  "extraData": "0x<32字节0><sealer地址><65字节0>",
  "gasLimit": "0x1c9c380",
  "alloc": { "<你的地址>": { "balance": "0x200000000000000000000000" } }
}
```

---

# 第三部分：日常使用与运维

> 链跑起来之后：日常启停、接 MetaMask、接 Hardhat 等开发工具，附命令速查表与常见问题 FAQ。

---

## 9. 日常使用：启动 / 停止 / 接 MetaMask / 接开发工具

### 9.1 一键启动（推荐保存为脚本）

日常需要两个终端窗口（节点 1 + 节点 2）。以下是完整命令：

**终端 1 — 节点 1：**

```sh
export JAVA_HOME=/Users/i/Desktop/DigitalLabs-web3/besu-local/zulu25.36.205-ca-jdk25.0.4.1-macosx_x64/Contents/Home
/Users/i/Desktop/DigitalLabs-web3/besu-local/besu-24.12.2/bin/besu \
  --network=dev --sync-min-peers=1 \
  --rpc-http-enabled --rpc-http-api=ETH,NET,WEB3,DEBUG,TXPOOL,MINER,ADMIN \
  --host-allowlist="*" \
  --data-path=/Users/i/Desktop/DigitalLabs-web3/besu-local/data-dev
```

**终端 2 — 节点 2：**

```sh
export JAVA_HOME=/Users/i/Desktop/DigitalLabs-web3/besu-local/zulu25.36.205-ca-jdk25.0.4.1-macosx_x64/Contents/Home
/Users/i/Desktop/DigitalLabs-web3/besu-local/besu-24.12.2/bin/besu \
  --network=dev --sync-min-peers=1 --p2p-port=30304 --rpc-http-port=8546 \
  --rpc-http-enabled --rpc-http-api=ETH,NET,WEB3,ADMIN \
  --host-allowlist="*" \
  --data-path=/Users/i/Desktop/DigitalLabs-web3/besu-local/data-node2
```

**终端 3 — 互联（两个节点都启动后执行一次）：**

```sh
# 互相交换 enode 并 addPeer
EN1=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"admin_nodeInfo","params":[],"id":1}' \
  http://127.0.0.1:8545 | python3 -c "import json,sys; print(json.load(sys.stdin)['result']['enode'])")
EN2=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"admin_nodeInfo","params":[],"id":1}' \
  http://127.0.0.1:8546 | python3 -c "import json,sys; print(json.load(sys.stdin)['result']['enode'])")

curl -s -X POST -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"admin_addPeer\",\"params\":[\"$EN1\"],\"id\":1}" \
  http://127.0.0.1:8546
curl -s -X POST -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"admin_addPeer\",\"params\":[\"$EN2\"],\"id\":2}" \
  http://127.0.0.1:8545
```

### 9.2 停止

在对应终端按 `Ctrl+C`，Besu 会优雅关闭并保存数据。
数据目录不会损坏，下次启动接着上次的区块高度继续。

**重置链**（清空所有区块和状态，从零开始）：直接删除数据目录即可。

```sh
rm -rf /Users/i/Desktop/DigitalLabs-web3/besu-local/data-dev
```

### 9.3 连接 MetaMask

MetaMask → 设置 → 添加网络 → 手动添加，填写：

| 字段 | 值 |
|---|---|
| 网络名称 | Besu Local Dev（随意） |
| 区块链 ID | **1337** |
| 新区块链的 RPC URL | **http://127.0.0.1:8545** |
| 货币符号 | ETH |
| 区块浏览器 URL | 可留空 |

> 注意：Besu dev 链**没有内置预 funded 账户**（这是它和 Anvil/Ganache 的区别），
> 新账户余额为 0。要给自己的测试账户注资，需要重启链时配合
> `--miner-coinbase` 设置挖矿奖励地址，或自定义 genesis 文件预置余额。

### 9.4 连接 Hardhat / Foundry / ethers.js

任何以太坊工具都支持，以 Hardhat 为例（`hardhat.config.js`）：

```js
module.exports = {
  networks: {
    besu: {
      url: "http://127.0.0.1:8545",
      accounts: ["你的测试私钥"],
    },
  },
};
```

部署合约：`npx hardhat run scripts/deploy.js --network besu`

---

## 10. 常用命令速查表

| 目的 | 命令（JSON-RPC method） |
|---|---|
| 最新区块高度 | `eth_blockNumber` |
| 按编号查区块 | `eth_getBlockByNumber ["0x编号或latest",false]` |
| 按哈希查区块 | `eth_getBlockByHash ["0x区块哈希",false]` |
| 查账户余额 | `eth_getBalance ["0x地址","latest"]` |
| 链 ID | `eth_chainId` |
| 当前 gas 价格 | `eth_gasPrice` |
| 发已签名交易 | `eth_sendRawTransaction ["0x签名后的交易"]` |
| 查交易回执 | `eth_getTransactionReceipt ["0x交易哈希"]` |
| 节点 peer 数 | `net_peerCount` |
| 本节点 enode | `admin_nodeInfo` |
| 连接其他节点 | `admin_addPeer ["enode://..."]` |
| 设置挖矿地址 | `miner_setEtherbase ["0x地址"]` |
| 开启挖矿 | `miner_start [1]` |

通用格式（把 method 和 params 替换即可）：

```sh
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"方法名","params":[],"id":1}' \
  http://127.0.0.1:8545
```

---

## 11. 常见问题 FAQ

**Q1：提示 `Unable to locate a Java Runtime`？**
JAVA_HOME 没设置，或者当前 shell 没有 java。每次先执行第 9.1 节第一行的
`export JAVA_HOME=...`。想永久生效就写进 `~/.zshrc`。

**Q2：Besu 26.x 报 `Java version must be at least 25`？**
新版要求 Java 25+。本目录已备好 JDK 25，设置好 JAVA_HOME 即可。

**Q3：Besu 26.x 报 `--network=dev is no longer supported`？**
官方已移除单机 dev 链。两个选择：
(a) 像本次一样回退到 24.12.2；
(b) 留在 26.x，但必须用 Clique/PoA 手工配 genesis，或上 Ephemery/Kurtosis。

**Q4：链一直显示 `Waiting for N peers minimum` 不出块？**
就是本次最大的坑。加 `--sync-min-peers=1` 并且**至少起两个节点互联**（第 7 节）。

**Q5：`eth_sendTransaction` 报 "Use eth_sendRawTransaction"？**
正常的安全设计。交易必须由你自己用私钥签名后通过
`eth_sendRawTransaction` 发送（第 8.2 节有完整代码）。

**Q6：`miner_start` 报 "Coinbase not set"？**
先 `miner_setEtherbase ["0x你的地址"]` 设置挖矿奖励地址再启动挖矿。

**Q7：想彻底重来一条新链？**
停掉节点 → 删除 `data-dev` / `data-node2` 目录 → 重新启动。

**Q8：Docker 方式为什么没用？**
本次国内所有 Docker Hub 镜像源（daocloud / 1ms.run / xuanyuan / ustc）均不可用，
GitHub Container Registry 也返回 denied，所以采用官方二进制包 + VPN 代理直连下载。
如果你有可用的 Docker 环境，`docker run hyperledger/besu:24.12.2` 同样可行。

**Q9：只是想做合约开发，需要这么麻烦吗？**
坦白说：如果只做 Solidity 合约/DApp 开发，**Anvil（Foundry 套件）** 是更省心的
本地链选择（一条命令启动、自带 10 个预 funded 账户、支持快照回滚）。
Besu 的长处在于**模拟多节点组网、联盟链、以及接近生产环境的以太坊客户端行为**。
两者可以并存：日常开发用 Anvil，组网与集成测试用 Besu。

**Q10：为什么只搭建了 2 个节点？**

简短回答：**2 不是设计目标，而是"让链动起来"的最小数量**。展开讲有三层原因：

**① 直接原因：被 dev 模式的同步器"逼"出来的**

回顾第 7 节的坑：Besu 要求至少有 N 个 peer 才开始干活，而 dev 网络没有
公共节点可自动发现。

- 1 个节点 → peer 数永远是 0 → 永远卡在 "Waiting for peers" → 不出块；
- 2 个节点互连 → peer 数 = 1 → 满足条件 → 立刻出块。

所以 2 = "自己不够，再加一个刚好凑数"，是让链跑通的最小配置。
搭第 3 个节点对"验证链能用"这个目标没有额外帮助，还多占内存
（每个 Besu 节点吃几百 MB Java 堆内存）。

**② 概念原因：共识机制不同，对节点数的要求完全不同**

| 场景 | 最少节点数 | 原因 |
|---|---|---|
| 本指南的 dev 链（PoW 性质） | 2 | 只需满足同步器的 peer 门槛，出块实际由一个节点完成 |
| Clique PoA | 1（理论上） | 白名单轮流出块，无投票 |
| IBFT 2.0 / QBFT | **4 个起** | 拜占庭容错要求 `n ≥ 3f + 1`：要容忍 1 个作恶节点，至少 4 个验证人才能凑出 2/3 多数票 |

节点数不是越多越好、也不是越少越好，而是**由共识规则决定的**。
联盟链生产环境常见 4、7、13 个节点（`3f+1` 序列），
分别能容忍 1、2、4 个节点作恶。

**③ 实用原因：本指南的目的是学习和开发**

- 2 个节点已演示区块链的本质：多节点、P2P 互联、交易广播、状态同步；
- 可随时验证同步：同一查询分别打 `http://127.0.0.1:8545` 和
  `http://127.0.0.1:8546`，两边区块高度一致——这就是"去中心化账本同步"的活教材；
- 真要做联盟链实验（如 4 节点 QBFT）时再加节点即可，只是改配置重启的事。

**动手实验：加第 3 个节点**

照 9.1 节节点 2 的写法再起一个节点 3（换端口避免冲突）：

```sh
/Users/i/Desktop/DigitalLabs-web3/besu-local/besu-24.12.2/bin/besu \
  --network=dev --sync-min-peers=1 \
  --p2p-port=30305 --rpc-http-port=8547 \
  --rpc-http-enabled --host-allowlist="*" \
  --data-path=/Users/i/Desktop/DigitalLabs-web3/besu-local/data-node3
```

用 9.1 节"终端 3"的方法让节点 3 与节点 1、2 互相 `admin_addPeer`，
再用 `net_peerCount` 观察三个节点互相发现、区块高度保持一致。

---

# 第四部分：智能合约入门理论

> 回答三个问题：什么是智能合约？有哪些智能合约？如何定义（编写）智能合约？

---

## 12. 一句话与一个类比

**智能合约（Smart Contract）= 部署在区块链上的程序**。
一旦上链，所有人可见、任何人无法篡改，满足条件就**自动执行**。

| 传统合约 | 智能合约 |
|---|---|
| 纸质合同 + 律师/法院执行 | 代码即合同（Code is Law）|
| "如果 12 月 1 日降雨量 < 10mm，保险赔付"——要人工核查、人工打款 | 同样逻辑写成代码，数据到达那一刻自动赔付，无需信任任何一方 |

名字虽是"智能"，其实**没有任何 AI**——就是普通的 if/else 程序，
"智能"指的是**自动履约**。

---

## 13. 它解决了什么问题？

**中介。**

传统世界做事要信中间人（支付宝、银行、房产局）。智能合约让
**互不相识的人**在无须信任对方的情况下完成协作——因为规则写在链上，
执行由全网节点共同保证，谁都改不了。

一个具体例子（去中心化借贷）：

1. A 把 ETH 存入合约，合约规则写明"抵押率 150% 可借出稳定币"；
2. B 存入抵押品，合约**自动**允许他借出对应金额——不需要审核员；
3. 抵押品价值跌破线，任何人可调用 `liquidate()` 函数平仓——
   不需要催贷员，执行由代码保证。

---

## 14. 有哪些类型的智能合约？

### 14.1 按用途分类

| 类别 | 干什么 | 知名例子 |
|---|---|---|
| **代币（Token）** | 发行可流通的资产 | USDT、USDC（稳定币）；遵循 ERC-20 标准 |
| **NFT** | 发行唯一数字资产 | Bored Ape、数字门票；遵循 ERC-721 标准 |
| **去中心化交易所 DEX** | 自动撮合换币、提供流动性 | Uniswap |
| **借贷协议** | 抵押借款、存款赚息 | Aave、Compound |
| **DeFi 乐高** | 组合上面几种做收益策略、衍生品 | MakerDAO（发行 DAI 稳定币）|
| **治理** | 链上投票决定协议参数 | 各协议的 Governor 合约 |
| **桥（跨链）** | 资产在两条链间转移 | 本工作区的 neo-evm-bridge 就是这类 PoC |
| **游戏/博彩** | 链上游戏逻辑、随机数 | various |
| **身份/权限** | 会员凭证、访问控制 | ENS（域名）、白名单合约 |
| **供应链/金融（联盟链）** | 应收账款、结算、存证 | 各银行 QBFT 联盟链上的业务合约 |

### 14.2 关键认知：标准 > 具体合约

上面很多类别背后是一套"接口规范"，最著名：

- **ERC-20**：同质化代币标准。钱包认识 USDT 不是因为它特殊，
  而是它实现了 ERC-20 规定的 `transfer` / `balanceOf` / `approve` 等函数；
- **ERC-721 / ERC-1155**：NFT 标准（唯一 / 半同质化）；
- **ERC-4626**：金库（Vault）标准；
- 写合约 ≈ **实现某个标准 + 加入自己的业务逻辑**。
  遵循标准的合约之间可以互相操作，这就是"DeFi 乐高"的基础。

---

## 15. 如何定义（编写）智能合约？

### 15.1 用什么语言？

| 语言 | 运行链 | 特点 |
|---|---|---|
| **Solidity** | 以太坊及所有 EVM 链（包括本地 Besu！）| **绝对主流**，语法类 JS/C++ |
| Vyper | EVM | 类 Python，刻意简单求安全 |
| Rust | Solana、Polkadot、Aptos | 高性能链生态 |
| Move | Aptos、Sui、蚂蚁链 | 资源导向，资产天然不可复制 |
| Java | Besu 的 EEA 子集 | Besu 特有：支持 Java 智能合约（走 EEA 规范，生态较小）|

> 本地 Besu 链是 EVM 链，学 **Solidity** 就能直接在上面部署。

### 15.2 合约长什么样？（最小示例）

以太坊最简"计数器"合约：

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Counter {
    // 状态变量：永久存在链上
    uint256 public count;

    // 函数：任何人可调用（发一笔交易给合约）
    function increment() public {
        count = count + 1;
    }

    // view = 只读，不花钱
    function get() public view returns (uint256) {
        return count;
    }
}
```

核心概念：

- **contract**：一个合约 = 链上的"账户 + 代码 + 存储"三合一；
- **状态变量**（`count`）：写在链上、永久保存，所以**写入要付 gas**；
- **函数修饰符**：
  - `public`：外部可调；
  - `view`：只读查询，不消耗 gas（也无需签名）；
  - `payable`：可以接收 ETH（没有这个修饰符的函数收到 ETH 会直接拒收）；
- **部署**：把源码编译成字节码，发一笔"创建交易"上链——
  从此**合约地址**就是它的门牌号。

### 15.3 一个 ERC-20 风格代币合约（稍进阶）

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MyToken {
    string public name = "My Token";
    string public symbol = "MTK";
    uint8 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;   // 地址 -> 余额

    // 事件：给外部（钱包/浏览器/合约）监听的日志
    event Transfer(address indexed from, address indexed to, uint256 value);

    constructor(uint256 initialSupply) {
        totalSupply = initialSupply * 10 ** uint256(decimals);
        balanceOf[msg.sender] = totalSupply;        // 发行量全给部署者
    }

    function transfer(address to, uint256 value) public returns (bool) {
        require(balanceOf[msg.sender] >= value, "余额不足");
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }
}
```

新面孔：

- `mapping`：链上的键值数据库（每个节点各存一份，内容必须一致）；
- `msg.sender`：调用者地址——权限控制、扣款对象的来源；
- `require`：条件检查，失败则整个交易回滚（状态完全撤销）；
- `emit` 事件：往日志里记一笔，区块浏览器靠它展示转账记录；
- `constructor`：部署瞬间执行一次的初始化函数。

---

## 16. 完整开发流程：在本地 Besu 链上部署

```
① 写代码      Counter.sol / MyToken.sol
② 编译        solc / Foundry / Hardhat  →  字节码 + ABI
③ 部署        发一笔创建交易到 Besu (http://127.0.0.1:8545)  →  得到合约地址
④ 交互        ethers.js 调用合约函数
              （发交易 = 改状态；call = 只读查询，免费）
⑤ 验证        查交易回执、查合约状态（区块浏览器可选）
```

### 16.1 名词解释：ABI

**ABI（Application Binary Interface）= 合约的"接口说明书"**：
函数名、参数类型、返回值的数据编码规则。
ethers.js / MetaMask / 后端服务全凭 ABI 知道怎么拼调用数据。
编译工具会同时产出字节码（`bytecode`，部署用）和 ABI（交互用）。

### 16.2 工具选型

| 工具 | 特点 | 适合 |
|---|---|---|
| **Foundry**（`forge`）| Rust 写的，极快，测试用 Solidity 写 | 当前主流，推荐新项目 |
| **Hardhat** | JS/TS 生态，插件丰富 | JS 团队、快速集成 |
| Remix（remix.ethereum.org）| 浏览器 IDE，零安装 | 学习阶段随手验证 |

### 16.3 Hardhat 接本地 Besu 链示例

`hardhat.config.js`：

```js
module.exports = {
  solidity: "0.8.24",
  networks: {
    besu: {
      url: "http://127.0.0.1:8545",
      accounts: ["0x<部署账户私钥>"],   // 用 genesis alloc 里有钱的账户
    },
  },
};
```

部署与交互：

```sh
npx hardhat compile
npx hardhat run scripts/deploy.js --network besu
```

部署账户直接用我们 genesis `alloc` 里预置 3 ETH 的 sealer 账户
（私钥在 `clique-15s/node1.key` / `node2.key`），本地链
`baseFeePerGas = 0`，部署完全免费。

---

## 17. 三个必须建立的认知

1. **部署即永固**：合约代码上链后不可修改。
   想"可升级"要用额外的**代理合约模式**（代理指向实现合约，
   升级 = 改指向），这是进阶话题；
2. **Gas = 执行费**：每个写入操作都烧钱，循环里慎做重操作
   （本地链 gasPrice 0 感觉不到，主网一次失败的合约调用也要烧掉真金白银）；
3. **链上皆公开**：合约代码、状态变量、存储、每笔调用全部透明可查。
   **绝不要把密码、私钥、业务机密写进链上**
   ——`private` 修饰符只是"别的合约不能访问"，**不是加密**，
   任何人仍可直接读存储槽。

---

## 18. 与本项目环境的连接

- 本地 Besu 链（Chain ID 1337）完全支持部署本文的
  `Counter` / `MyToken` 合约；
- Hardhat / Foundry / ethers.js 配置见本书 9.4 节；
- 工作区的 **neo-evm-bridge** 项目就是一组跨链智能合约
  （锁定/铸造/释放合约）的概念验证，可作进阶阅读；
- genesis 的 `alloc` 字段支持 `"code"`，可做到"创世即部署"合约
  （见本书 8.9 节）。

---

## 19. 学习路径建议

1. **Remix 上手**（1 天）：浏览器里写、编译、部署上面两个示例，
   建立"合约就是链上程序"的体感；
2. **Solidity 语法系统学**（1~2 周）：官方 Solidity by Example
   （solidity-by-example.org）过一遍；
3. **标准实现**：手写一个完整 ERC-20，再用
   OpenZeppelin Contracts 库重写对比（生产项目永远用审计过的库，
   不要手写加密经济学核心逻辑）；
4. **测试**：Foundry 写单元测试（`forge test`），
   理解 revert、事件断言、边界条件；
5. **安全入门**：重入攻击（reentrancy）、溢出、权限缺失三大经典漏洞
   各复现一次（推荐 Ethernaut 闯关游戏）；
6. **实战**：把合约部署到本地 Besu 链，
   接 blockscout（工作区现成项目）搭私有区块浏览器看效果。

---

# 第五部分：实战开发实录（dex-labs 工程）

> 以下按开发顺序记录每个功能的完整实现过程、关键决策与踩坑细节。
> 工程位置：`dex-labs/`，运行中的网站：http://127.0.0.1:3000

---

## 20. 阶段 0：钱包功能

### 20.1 目标与功能清单

在网页里实现一个最小可用的钱包，不依赖 MetaMask：

| 功能 | 实现要点 |
|---|---|
| 查看账户 | 地址 + ETH 余额实时显示 |
| 创建新钱包 | `ethers.Wallet.createRandom()` 本地生成 |
| 导入私钥 | 粘贴 hex 私钥 → 派生地址 |
| 切换开发账户 | 从服务器 `/dev-key` 读节点 1 sealer 私钥 |
| 转账 ETH | 本地签名 → 代理广播 → 等回执 |
| 交易记录 | localStorage 存最近 20 笔，状态从"⏳ 等待出块"变"✅ 区块 N" |

### 20.2 关键实现细节

**（1）私钥永不出浏览器**。整个网站的安全边界：
私钥只存在于页面内存（`new ethers.Wallet(pk)`），
服务器只做两件事——静态文件服务 + 把**已签名**的原始交易转发给 Besu。
服务器代码里根本接触不到私钥（`/dev-key` 只是本机开发便利，读的是本地文件）。

**（2）钱包状态持久化**。`setWallet()` 把私钥写入
`localStorage["lab.wallet"]`，刷新页面自动恢复上次使用的钱包；
优先级：localStorage > 开发私钥自动加载。

**（3）ETH 转账 = 一笔普通交易**：

```js
const value = window.ethers.parseEther("0.3");     // ETH → wei (BigInt)
const hash = await sendSigned({
  to: toNorm,            // 接收地址（必须先规范化，见下）
  value,                 // 转账金额
  gasLimit: "21000",     // 普通转账的固定消耗
});
```

不需要 `data` 字段——有 `data` 才是调合约/部署合约。

**（4）地址规范化**。Besu 对非规范地址（大小写混合校验和错误、
长度不对）会返回极具误导性的错误，所以入口统一：

```js
const toNorm = "0x" + to.toLowerCase().replace(/^0x/, "");
if (!/^0x[0-9a-f]{40}$/.test(toNorm)) throw new Error("接收地址不合法");
```

**（5）交易记录的"两段式"更新**。广播前先 `recordTx(hash, 描述)`
写入列表（状态 ⏳），拿到回执后 `settleTx(hash, ok, block)`
就地更新状态。页面刷新后记录仍在（localStorage）。

### 20.3 验证结果

- 创建新钱包 → 私钥可见可备份 → 地址 `0x3AD58b44...7B3b9`
- 开发账户转 0.3 ETH → 区块 547，gasUsed 21000 ✅
- 导入该钱包私钥 → 余额正确显示 0.3 ETH ✅
- 交易记录从"⏳"翻转为"✅ 区块 547" ✅

---

## 21. 阶段 1：代币（ERC-20）

### 21.1 手写 ERC-20 的核心结构（LabToken.sol）

不依赖 OpenZeppelin，手写完整 ERC-20 以理解标准本身：

```solidity
contract LabToken {
    string public name; string public symbol;
    uint8  public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint256 supply) {
        name = _name; symbol = _symbol;
        totalSupply = supply * 1000000000000000000;  // 避开 ** 幂运算
        balanceOf[msg.sender] = totalSupply;         // 全部发给部署者
        emit Transfer(address(0), msg.sender, totalSupply);
    }
    // transfer / approve / transferFrom 三件套按 EIP-20 实现……
}
```

教学要点：
- **余额就是一个 mapping**，"转账"只是改两个数字 + 发一个事件；
- **授权模型**：`approve(spender, amt)` 让对方可以花你的钱，
  `transferFrom` 时扣 `allowance`——这是后面 DEX/借贷能"替用户操作代币"的基础；
- 构造器里 `_mint` 而不是预分配（genesis alloc），
  演示了"代币在部署那一刻被创造"。

### 21.2 CLI 部署与验证（scripts/deploy.js + verify-token.js）

部署脚本做的事：读源码 → solc 编译 → 覆写 gas 估算 →
固定 `gasLimit=20M / gasPrice=1Gwei` 签名广播 → 轮询回执 →
把 `{name, address, txHash, blockNumber}` 追加进 `deployments.json`。

验证脚本覆盖四个场景：普通转账 + `Transfer` 事件解析、
`approve`/`transferFrom` 授权代转、余额不足 revert、
Bob 无 gas 时先转 ETH 再操作（新账户必须先有 ETH 付 gas）。

### 21.3 网页发币工厂（阶段 1 的 GUI 化）

架构三层：

```
浏览器（ethers.js 本地签名 + 手工 ABI 编码）
   │  POST 已签名交易
   ▼
server.js（/rpc 代理 + /factory 模板 + /dev-key）
   │  转发
   ▼
Besu 节点 8545（Clique PoA，15 秒出块）
```

- **/factory**：服务器启动时预编译 `LabFactoryToken.sol`
  （名称/符号/总量可配置的模板），返回 `{abi, bytecode, gasLimit, gasPrice}`；
- **前端发行**：`AbiCoder.defaultAbiCoder().encode(["string","string","uint256"],...)`
  把构造参数编码后拼接到 bytecode，`sendSigned` 部署；
- **代币转账**：手拼函数选择器 `0xa9059cbb`（transfer）+
  ABI 编码参数，回执后用 `eth_call` + `0x70a08231`（balanceOf）查接收方余额回显；
- **登记簿**：发行成功的地址存 `localStorage["lab.tokens"]`，
  下拉选择即可转账。

### 21.4 验证结果

- 网页发行 UITK/FINAL2/DFIN 等多个代币，均 15 秒左右出块确认（gasUsed ≈ 94 万）；
- 代币转账 + 接收方余额回显（区块 453/463/499/509/551）全部正确；
- 阶段 1 CLI 验证（verify-token.js）四场景全部通过。

---


## 22. 阶段 2：NFT（ERC-721）

### 22.1 手写 LabNFT.sol 的核心结构

与 LabToken 同思路：不依赖 OpenZeppelin，手写精简 ERC-721 看清本质。

| ERC-20（同质化） | ERC-721（非同质化） |
|---|---|
| `balanceOf` = 一个数字 | 每枚藏品独立存在，`ownerOf(tokenId)` 逐枚确权 |
| 转账 = 两个数字加减 | `transferFrom(from, to, tokenId)` 逐枚转手 |
| 无"编号"概念 | `tokenId` 全局唯一，是藏品身份本身 |

核心存储：

```solidity
uint256 public nextTokenId = 1;              // 全局唯一自增编号
mapping(uint256 => address) private _owners; // tokenId -> 持有人
mapping(uint256 => string)  private _tokenURIs; // tokenId -> 元数据
mapping(uint256 => address) public getApproved;            // 单枚授权
mapping(address => mapping(address => bool)) public isApprovedForAll; // 全量授权
```

教学要点：

- **mint 就是"凭空造出一枚并登记"**：`_owners[id] = to; balanceOf[to] += 1;`
  再发 `Transfer(0x0, to, id)`（from 为零地址 = 铸造的约定）；
- **tokenURI 是元数据入口**：指向一个 JSON（`data:application/json,{...}`
  或 https 链接），市场/钱包靠它显示图片和名称；
- **两级授权**：`approve(spender, tokenId)` 授权单枚、
  `setApprovalForAll(operator, true)` 全量授权（OpenSea 挂单即此机制）；
- **转手后旧授权自动失效**：`delete getApproved[tokenId]`，
  这是安全细节。

### 22.2 服务端与前端实现

- **server.js** 编译函数重构为 `compileContract(file, name)` 通用化，
  新增 `GET /nft` 返回 LabNFT 的 `{abi, bytecode, gasLimit, gasPrice}`；
- **首次铸造自动部署**：`ensureNFTContract()` 检查 localStorage
  有无合约地址，没有则先部署（构造参数 name/symbol），地址存
  `localStorage["lab.nft.contract"]`，之后铸造/转让复用；
- **函数选择器现算**：`ethers.id("mint(address,string)").slice(0,10)`
  避免手抄选择器出错；`ownerOf=0x6352211e`、`tokenURI=0xc87b56dd`、
  `transferFrom=0x23b872dd` 为稳定已知值；
- **tokenId 从回执日志解析**：铸造回执的 `logs` 里找
  `topics[0]=Transfer签名 && topics[1]=0x0（零地址）` 的事件，
  `topics[3]` 即分配到的 tokenId——不依赖任何本地计数器，以链为准；
- **链上确权**：对每枚藏品 `eth_call` ownerOf（取返回值后 40 位）
  和 tokenURI（`AbiCoder.decode(["string"], ret)` 解码），回显到列表。

### 22.3 验证结果（全部浏览器实际点击）

| 操作 | 结果 |
|---|---|
| 首次铸造自动部署 LabNFT | ✅ 合约 0xd68947eddb13e8718a294c592d3cb5179a663ec1，区块 611 |
| 铸造 #1（data:json URI） | ✅ 区块 613，gasUsed 188227，tokenId 从日志解析 |
| 铸造 #2 | ✅ 区块 615，gasUsed 148511 |
| 链上确权（ownerOf + tokenURI） | ✅ 两枚持有人/URI 与链上一致（含中文 UTF-8 元数据） |
| transferFrom 转手 #1 | ✅ 区块 623，gasUsed 60304 |
| 再次确权 | ✅ #1 持有人变为 0x3ad58b44…，#2 不变 |

### 22.4 本阶段新增踩坑

见附录 A 第 8 条：ethers v6 hex 必须带 `0x` 前缀。
排查方法：链上数据对、浏览器报错时，先用 curl 直查 RPC 拿到
原始返回，再和浏览器里的处理逐步对照，即可定位是哪一步变形。

### 22.5 与后续阶段的衔接

- DEX 阶段可把 NFT 挂上市场：`setApprovalForAll(dex, true)` + 卖单结算；
- 质押阶段可做"质押 NFT 获得收益"变体；
- 交易记录、转出账户提示等基础设施全部复用钱包模块。

---

## 23. 阶段 3：质押（Staking）

### 23.1 奖励模型：按秒累计的经典算法

质押的本质是**按时间按份额分钱**。本实现采用 Synthetix
StakingRewards 的简化版，这是绝大多数 DeFi 挖矿的原型：

```
rewardPerToken = 累计每 1 wei 质押已分到的奖励（1e18 缩放）
新增 = rewardRate(每秒奖池) × 经过的秒数 × 1e18 / totalStaked
个人待领取 = 质押量 × (rewardPerToken - 个人上次结算点) / 1e18
```

关键技巧是 **`updateReward` 修饰器**：任何写操作（质押/赎回/领取/
注入金库）入口先"把账结算到当前时刻"（更新全局累计点和个人结算点），
再执行业务——这样无论何时查询/操作，账目都精确连续，与区块粒度无关。

```solidity
modifier updateReward(address account) {
    rewardPerTokenStored = rewardPerToken();
    lastUpdateTime = block.timestamp;
    if (account != address(0)) {
        rewards[account] += stakedOf[account]
            * (rewardPerTokenStored - userRewardPerTokenPaid[account]) / 1e18;
        userRewardPerTokenPaid[account] = rewardPerTokenStored;
    }
    _;
}
```

其他要点：
- **奖励来自金库**：管理员 `depositReward(amount)` 把代币转入合约，
  设定 `rewardRate = amount / 3600`（本期 3600 秒发完）；
  `rewardPerToken` 里用 `min(now, periodFinish)` 保证过期停止累计；
- **先乘后除**：Solidity 整数除法会截断，永远 `a * b / c` 而非
  `a / c * b`，并用 1e18 缩放保精度；
- **本金与收益分离**：`withdraw` 赎本金、`getReward` 领收益、
  `earned(addr)` 只读随时查待领取。

### 23.2 网页流程（多笔交易自动串联）

质押比转账复杂——一笔业务拆成多笔链上交易，前端负责串联：

| 操作 | 实际交易序列 |
|---|---|
| 部署质押池 | ① 部署 LabStaking(代币地址) → ② approve 金库扣款 → ③ depositReward |
| 质押 | ① approve → ② stake |
| 领取收益 | getReward |
| 赎回全部 | 先 eth_call 读 stakedOf → withdraw(数量) |

- 每个代币一个池，地址存 `localStorage["lab.staking.<代币地址>"]`；
- 全部函数选择器用 `ethers.id("函数签名")` 现算，避免手抄；
- 状态面板用只读 `eth_call` 查 stakedOf / earned / totalStaked /
  rewardRate / periodFinish，切到质押页自动刷新一次。

### 23.3 验证结果（DFIN 池，浏览器实际点击）

| 操作 | 结果 |
|---|---|
| 部署质押池（3 笔） | ✅ 池 0x0fe2bea6744b77ae82f3fca973d6d86a0395a80f，区块 665-667 |
| 注入金库 10000 | ✅ rewardRate = 2.7777…/秒（10000/3600，除法截断符合预期） |
| 质押 1000（2 笔） | ✅ stakedOf=1000，totalStaked=1000 |
| 15 秒后查 earned | ✅ **41.6666…** = 1000/1000 × 2.7777/秒 × 15 秒，数学精确吻合 |
| getReward | ✅ 到账，earned 归零重新累计 |
| withdraw 赎回全部 | ✅ 本金回钱包，staked=0，剩余 earned 冻结可再次领取 |

这组数字本身就验证了模型：份额占比 × 速率 × 时长 = 收益，
领取/赎回前后账目连续无跳变。

### 23.4 与后续阶段的衔接

- **DEX（下一阶段）**：把"质押 LP 代币"接上本合约即成流动性挖矿；
- **DeFi 乐高**：质押收益凭证可再抵押进借贷协议；
- 注意教学简化点：真实协议会用单独的奖励代币 + 时间锁 + 治理参数，
  本实现以最小代码展示核心数学。

---

## 24. 阶段 4：DEX（AMM）

### 24.1 恒定乘积：x·y = k

AMM 取代订单簿的核心思想：**池子里两边的乘积保持不变**，
价格由两边储备的比例自动决定。

```
x = ETH 储备，y = 代币储备，k = x·y
买入 dx 的 ETH：新 y' = k/(x+dx)，卖出 dy = y - y'
扣 0.3% 手续费：实际进入公式的是 dx×997/1000（手续费留给池子 = LP 收益）
```

```solidity
function getAmountOut(uint256 amountIn, bool ethIn) public view returns (uint256) {
    uint256 inR = ethIn ? reserveETH : reserveToken;
    uint256 outR = ethIn ? reserveToken : reserveETH;
    require(inR > 0 && outR > 0, "pool empty");
    uint256 inWithFee = amountIn * FEE_NUM;          // 997
    return outR * inWithFee / (inR * FEE_DEN + inWithFee);  // 先乘后除保精度
}
```

交易量越大滑点越大（公式自动体现），这就是"AMM 用流动性深度定价"。

### 24.2 流动性与 LP 份额

- **首注**：按使用者给的 ETH/代币比例建立初始价格，
  LP 份额 = 首注 ETH 量（基准）；
- **续注**：代币量由合约按比例自动计算
  `needToken = reserveToken × msg.value / reserveETH`，
  用户给的代币数只作滑点上限；LP 增量 = `totalLP × msg.value / reserveETH`；
- **撤出**：按 LP 份额占比分走两边储备
  （撤出时池里含别人交易攒下的手续费 = LP 赚钱方式）；
- 教学简化：LP 用 mapping 记账，真实 Uniswap 发 LP ERC-20 代币
  （可转让、可质押进挖矿——与第 23 章衔接）。

### 24.3 网页流程与验证（DFIN 池）

| 操作 | 实际交易 | 验证结果 |
|---|---|---|
| 建池+注入 | 部署→approve→addLiquidity | ✅ 池 0x84357e3b71c57d3a2c2496c8b7daee371e5b74d3，1 ETH + 2000 DFIN，LP=1.0 |
| 报价 0.1 ETH | 只读 eth_call | ✅ **181.322** 代币，与手算 2000×99.7/1099.7 完全一致 |
| ETH→代币 | swapETHForToken（带 value） | ✅ 储备 1.1/1818.678，价格 2000→1653（买推价涨） |
| 代币→ETH | approve→swapTokenForETH | ✅ 100 代币换 0.05717 ETH，与报价一致 |
| 撤出流动性 | removeLiquidity(全部 LP) | ✅ 池清空，钱包 ETH 0.519→1.619（正好 +1.1） |

价格在交易后自动移动（1653 = 1818.678/1.1）——**没有任何人挂单，
价格由数学决定**，这是 AMM 与订单簿交易所的本质区别。

### 24.4 本阶段踩坑

第 9 条：**eth_call 调用了合约里不存在的函数 → "Execution reverted"**。
前端想读"双储备"，写成 `getReserves()`，但合约里储备用的是
`reserveETH` / `reserveToken` 两个 public 变量（各自生成 getter），
并不存在合并的 `getReserves()`。教训：选择器现算解决了"抄错签名"，
但解决不了"函数根本不存在"——对照合约源码核对每个前端调用点。

### 24.5 与后续阶段的衔接

- **借贷（下一阶段）**：AMM 的 LP 代币可作为抵押品（Curve/Uniswap 生态真实玩法）；
- **DeFi 乐高**：本 AMM + 第 23 章质押 = 流动性挖矿（stake LP 拿奖励）；
- NFT 交易市场也可挂到 AMM 侧面（NFT⇄ETH 英式拍卖或 WASD 定价）。

---

## 25. 阶段 5：借贷协议（Lending）

### 25.1 超额抵押：DeFi 借贷的基石

真实世界的借贷靠信用，DeFi 借贷靠**超额抵押**——因为链上
没有身份和追偿手段，唯一的信用是"你锁住的资产比我借你的多"。

```
抵押 1 ETH（价格 2000 DFIN）
  → 购买力 = 1 × 66%(抵押率 CF) × 2000 = 1320 DFIN
  → 最多借 1320，留 34% 缓冲吸收价格波动
健康度 = 购买力 / 债务   （< 1.0 即可被清算）
```

价格来自"模拟预言机"（`setPrice` 管理员调价，真实协议由
Chainlink 喂价）——**预言机是借贷协议的生命线**：价格被操纵，
清算机制就全线崩溃。

### 25.2 持续计息与清算

```solidity
// 债务 = 本金 × (1 + rate × 经过的秒数)，读函数即实时计算，不占存储
function debtOf(address user) public view returns (uint256) {
    uint256 p = principalOf[user];
    if (p == 0) return 0;
    uint256 dt = block.timestamp - borrowTime[user];
    return p + p * ratePerSecond * dt / 1e18;
}
```

清算的经济学：欠款人健康度跌破 1，任何人可以**替他还全部债务，
拿走他的全部抵押 + 最高 8% 奖金**。套利者有动力盯着链上健康度，
让坏账在被价格波动放大之前被消化——这是无许可网络的自我纠错。

### 25.3 网页流程与验证（DFIN 市场，price=2000，演示利率 1%/秒）

| 操作 | 结果 |
|---|---|
| 部署市场 + 注入 10000 可借资金 | ✅ 市场 0xf6e2…（修复版），区块 903 |
| 存 1 ETH 抵押 | ✅ 抵押入账 |
| 无抵押时借款 | ✅ **被合约拒绝**（超额抵押校验边界生效） |
| 借 1000 | ✅ 到账开始计息 |
| 计息观察 | ✅ 债务 1000 → 2500（150 秒，=1000×(1+0.01×150) 精确），健康度 1.32 → 0.528 实时下降 |
| 还清（2× 超额授权）| ✅ 本金+利息全清 |
| 取回全部抵押 | ✅ ETH 回钱包 |
| 健康度 0.528 时清算 | ✅ 区块 923：债务/抵押/本金全清零，清算人拿回全部抵押 |

### 25.4 本阶段踩坑（第 10、11 条）

**第 10 条：同 nonce 交易替换会让"未确认的交易"凭空消失。**
上一笔交易还没打包时又发下一笔，两笔取到同一个 nonce；
后者入池会把前者顶掉（Besu 允许同价替换），前者从此查无此账。
现象极具迷惑性："交易已广播"有 hash，但 `eth_getTransactionByHash`
返回 null。对策：**严格等上一笔回执再发下一笔**（串行 await），
轮询被中断刷新页面后尤其要小心。

**第 11 条：清算奖金要有资金来源。** 最初实现 `seize = 抵押×1.08`
时，市场 ETH 余额只有欠款人自己存的 1 份抵押，8% 奖金无处支付，
清算必然 revert（`insolvent`）。修复：奖金封顶到合约余额
`seize = min(want, balance)`。真实协议用**保险基金/准备金**
承担这部分——协议的经济模型设计不能只看 happy path。

**环境备注**：Clique 链上块 `miner=0x0`、`gasLimit=0x1FFFFFFFFFFFFF`
是正常现象（出块人记录在 extraData 签名里），排查时不要误判为
sealer 失常；验证链是否健康的最快方法是用 sealer 私钥直发一笔
简单转账看能否入块。

### 25.5 与后续阶段的衔接

- **DeFi 乐高**：抵押品换成 AMM 的 LP 代币（第 24 章），即成
  "挖矿凭证再抵押"的组合——真实 DeFi 的可组合性正是这样叠出来的；
- 治理阶段可把 CF/利率/清算奖金做成提案参数；
- 身份/权限阶段可给清算加白名单（联盟链场景）。

---

## 26. 阶段 6（一）：预言机（Oracle）——多数据源中位数聚合

第 25 章借贷协议里的价格还是管理员手工 `setPrice` 的"模拟预言机"。
本章把它替换成一个真正的**链上聚合预言机**（Chainlink 思路简化版）：
多个数据源各自报价，合约取**中位数**，异常报价自然被过滤，
聚合结果再喂给借贷市场消费。

### 26.1 为什么需要预言机

智能合约运行在封闭的链上环境，**不能自己发起 HTTP 请求上网查行情**
（不确定性：每个节点必须执行出完全相同的结果，而网络数据时刻在变）。
所以价格必须由链下"喂"进链上，承担这个角色的就是预言机。

- **单一数据源不可信**：它宕机了协议就瞎了；它作恶（报 99999）就能
  让借贷协议错误地放大购买力、铸造出无抵押资产——这是 DeFi 史上
  最大的一类事故（闪电贷操纵单一价格源）。
- **Chainlink 的解法**：去中心化数据源网络 + 链下聚合 + 链上只存
  聚合结果。我们用 3 个 reporter + 合约内排序取中位数做极简复刻。

### 26.2 合约核心：白名单报价 → 中位数 → 轮次

**① 数据源白名单**（只有注册过的 reporter 能报价）：

```solidity
mapping(address => bool) public isReporter;
address[] public reporters;          // 数组方便枚举（白名单 mapping 不能遍历）

function addReporters(address[] calldata rs) external onlyAdmin {
    for (uint256 i = 0; i < rs.length; i++) {
        require(!isReporter[rs[i]], "already reporter");
        isReporter[rs[i]] = true;
        reporters.push(rs[i]);
    }
}
```

**② 中位数聚合**（教学链数据源少，直接插入排序；偶数取中间两个平均）：

```solidity
function pendingMedian() public view returns (uint256 median, uint256 count) {
    uint256[] memory ps = new uint256[](reporters.length);
    uint256 n;
    for (uint256 i = 0; i < reporters.length; i++)
        if (hasReported[reporters[i]]) { ps[n] = priceOf[reporters[i]]; n++; }
    require(n > 0, "no reports");
    for (uint256 i = 1; i < n; i++) {          // 插入排序
        uint256 key = ps[i];
        uint256 j = i;
        while (j > 0 && ps[j - 1] > key) { ps[j] = ps[j - 1]; j--; }
        ps[j] = key;
    }
    if (n % 2 == 1) return (ps[n / 2], n);
    return ((ps[n / 2 - 1] + ps[n / 2]) / 2, n);
}
```

中位数相对平均值的关键优势：**抗离群值**。报价 `[2000, 2002, 99999]`
平均值是 34667（协议瞬间被毒化），中位数是 2002——1 个恶意节点
掀不起风浪。要操纵中位数，攻击者得控制**超过一半**的数据源。

**③ 报价即触发聚合 + 报价数门槛**：

```solidity
function report(uint256 price) external {
    require(isReporter[msg.sender], "only reporter");
    priceOf[msg.sender] = price;
    hasReported[msg.sender] = true;
    _aggregate();
}

function _aggregate() internal {
    (uint256 med, uint256 n) = pendingMedian();
    if (n < minReports) return;       // 报价数不足 2 个 → 不形成新轮次
    roundId += 1;
    latestAnswer = med;               // 消费方只读这个
    latestTimestamp = block.timestamp;
    rounds[roundId] = Round(med, block.timestamp, n);
    emit RoundUpdated(roundId, med, n);
}
```

轮次（round）是 Chainlink 的核心概念：每次聚合结果上链形成一个
**不可变的历史版本**，消费方既能读最新价，也能查"放款那一刻的价格"
处理争议；`latestTimestamp` 则用于**新鲜度（staleness）检测**——
价格太久没更新就不该再被信任。

### 26.3 前端要点：一个页面用多把私钥签名

以前所有交易都用当前钱包签名；本阶段 3 个数据源必须**各自用自己的
私钥报价**（合约按 `msg.sender` 识别报价来源）。把发送器泛化：

```js
// signer 参数可传任意 ethers.Wallet；默认仍是全局钱包
async function sendSigned(txFields, signer = wallet) {
  const nonce = await rpc("eth_getTransactionCount", [signer.address, "latest"]);
  // ... 余额预检也用 signer 地址 ...
  const signed = await signer.signTransaction(tx);
  return rpc("eth_sendRawTransaction", [signed]);
}

// 数据源用自己的私钥签名报价
async function reportAs(r, priceHuman, label) {
  const signer = new window.ethers.Wallet(r.pk);  // 私钥仅存本浏览器
  const data = oSEL.report() + enc.encode(["uint256"], [parseUnits(priceHuman)]).slice(2);
  const hash = await sendSigned({ to: orc, data, gasLimit: "300000" }, signer);
  await waitReceipt(hash);   // 严格串行（踩坑 10）
}
```

"一键准备数据源"做了 4 笔链上交易：开发账户给 3 个随机生成的
数据源账户各转 0.02 ETH 付 gas（区块 983/985/987），再一笔
`addReporters(address[])` 批量注册白名单（区块 989）。

页面还提供三个场景按钮：**正常**（2000/2005/1995）、
**异常值攻击**（2000/2002/99999）、**行情上涨**（2100/2105/2095），
每个场景 3 笔报价串行上链。最后一张卡片把 `latestAnswer` 通过
借贷市场的 `setPrice` 同步过去——**DeFi 组合闭环**：
多数据源 → 聚合 → 借贷消费。

### 26.4 验证结果（DFIN 市场）

预言机合约 `0x4c7c5f1c5af2465d23d26061bfee0166a7c1d46d`，区块 981
（minReports=2，初始价 2000，创世 roundId=0）。

| 步骤 | 链上结果 |
|---|---|
| 准备数据源 A/B/C | gas 到账 983/985/987，批量注册 989 |
| 正常 2000/2005/1995（区块 991/993/995） | ✅ 最终 **聚合价 2000.0**（roundId=2） |
| 攻击 2000/2002/**99999**（区块 999/1001/1003） | ✅ 最终 **聚合价 2002.0**（roundId=5），恶意报价被中位数过滤 |
| 上涨 2100/2105/2095（区块 1007/1009/1011） | ✅ 最终 **聚合价 2100.0**（roundId=8） |
| 喂价借贷市场（区块 1015） | ✅ DFIN 市场 0x5576…28b7 价格 2000 → 2100 |

轮次跳变的细节：每场景 3 笔报价产生 **2 个新轮次**——第 2 笔时
报价数达到门槛 2，先按 2 个报价聚合一次（如正常场景第 2 笔后
(2000+2005)/2=2002.5 形成 round 1）；第 3 笔后按 3 个报价取中位数
形成 round 2。前端表格逐行显示三个数据源的账户、ETH 余额和各自报价。

链上独立核验（curl 直查，不经网页）：

```text
latestAnswer()  = 2100000000000000000000   （2100 × 1e18）
roundId()       = 8
reporterCount() = 3
minReports()    = 2
借贷市场 price() = 2100
```

### 26.5 本阶段踩坑（第 12 条）

**第 12 条：函数选择器绝不能凭记忆手抄。** 链上核验时凭印象把
`latestAnswer()` 的选择器写成了 0x51d40af0，`eth_call` 直接
`Execution reverted`（合约里没有这个函数 → 跳进默认回退 → revert）；
实际选择器是 0x50d25bcd（用 `ethers.id("latestAnswer()").slice(0,10)`
现算）。这与第 9 条"调用了合约里不存在的函数"同源：**选择器一律
页面内现算**，4 字节没有任何"看着眼熟"的容错。

**教学版与真实 Chainlink 的差距**（知其边界）：
真实网络在链下用千万级 gas 的链下报告（OCR）完成聚合、数据源要
质押 LINK 并因错报被罚没、触发条件是**偏差阈值 + 心跳**（价格变动
超 0.5% 或超时才更新，而非每笔报价都聚合）、还有
`latestRoundData()` 的 completedAnswer/answeredInRound 防"半拉子轮次"。
本合约保留了最核心的三件事：**多数据源、中位数、轮次门槛**。

### 26.6 与后续阶段的衔接

- 借贷市场的健康度/清算阈值从此跟随去中心化价格（本章已闭环）；
- **DeFi 乐高**：同一预言机还可喂给 AMM 的限价、清算机器人；
- **治理**：minReports、数据源名单可改为治理投票决定；
- 桥/稳定币场景可由预言机上报跨链事件或储备金证明。

---

## 27. 阶段 6（二）：DeFi 乐高——LP 抵押借贷（AMM × 预言机 × 借贷）

前六章的模块都是"一个页面玩一个协议"。本章第一次把**三个已完成的
模块咬合在同一笔业务里**：把 DEX（第 24 章 LabAMM）做市换来的 LP
份额抵押进金库，经预言机（第 26 章）估值，按借贷模型（第 25 章）
借出 ERC-20；借款人健康度恶化后，任何人都可以按折扣清算其 LP。
合约 `LabLego.sol`（252 行），部署于区块 1169
（`0x15149b4afebb3fd9123ef6913ec28865dffc70ba`）。

### 27.1 出发点：LP 不能转账，就给它加一层"适配层"

真实 DeFi（Uniswap V2）的 LP 本身就是一种 ERC-20，可以直接
`transfer` 给借贷合约当抵押品。但我们的 LabAMM 为了教学极简，
LP 只是池合约内部的一个 mapping：

```solidity
mapping(address => uint256) public lpOf;   // 账本，不是代币
```

它没有 `transfer/approve`，**无法把 LP "交"给别的合约**。有两条路：

1. 回去改 LabAMM，给 LP 套一层 ERC-20（真实 Uniswap 的做法）；
2. **不动任何旧合约**，新写一个**金库/适配层（Vault / Adapter）**：
   用户把 ETH+代币交给金库，金库替用户去 AMM 注入流动性，
   LP 法律上记在金库名下，金库里再用 `lpCollateral[user]` **分户
   记账**谁拥有多少。

选路线 2——旧合约一行不改，新功能靠"外面再套一层"长出来，这正是
DeFi 可组合性的常态（WETH 包装 ETH、Yearn 金库包装 LP，都是同一
思路）。代价是资金流要跨三个合约，方向必须想清楚（见 17.3）。

### 27.2 LP 怎么估值：拆成两股，一股问预言机

LP 代表"池子里的一份储备"，储备一半是 ETH、一半是代币。按份额
比例拆开，ETH 那半边用预言机价折成代币，两半相加：

```solidity
ethPart    = reserveETH   * lp / totalLP;          // LP 对应的 ETH
tokPart    = reserveToken * lp / totalLP;          // LP 对应的代币
valueToken = ethPart * price / 1e18 + tokPart;     // 预言机:1 ETH=price 代币
```

单位 LP 的价格（清算折算用）同理：

```solidity
lpPrice = (reserveETH * price / 1e18 + reserveToken) * 1e18 / totalLP;
```

购买力、健康度直接沿用第 25 章的模型，只把"抵押品价值"换成
`lpValue`：

```solidity
maxBorrow    = lpValue × 50% − debt
healthFactor = lpValue × 50% / debt        // <1 可清算
```

**抵押率 CF 从纯 ETH 的 66% 降到 50%**：LP 的价值随 AMM 价格
波动天然放大（无常损失），真实 Aave 对 LP 类资产给的 LTV 也比
蓝筹资产低一档。利率仍是教学版单利
`debt = principal × (1 + rate × dt)`，演示利率 1%/秒。

### 27.3 质押与撤出：跨三合约的资金流

质押（`stakeLiquidity(maxToken) payable`）的授权方向最容易绕错，
顺序是**用户 → 金库 → 授权 AMM → AMM 从金库拉走**：

```solidity
IERC20(token).transferFrom(msg.sender, address(this), needToken); // 用户先给金库
IERC20(token).approve(amm, needToken);                            // 金库再授权池
IAMM(amm).addLiquidity{value: msg.value}(needToken);              // 池从金库扣款
lpCollateral[msg.sender] += 新增LP;                                // 分户记账
```

注意 AMM 的 `addLiquidity` 内部是
`token.transferFrom(msg.sender=金库, ...)`，所以 approve 的主体
必须是金库自己——不能让用户直接 approve 给 AMM 了事。首注
（`totalLP==0`）时池里没有比例参照，`needToken = maxToken`，
由首笔存款定价；续注则严格按池内 ETH/代币比例配对，`maxToken`
只当滑点上限。

撤出（`unstake(lp)`）有两个细节：

```solidity
lpCollateral[msg.sender] -= lp;                 // ① 先扣记账
require(lpValue(我) × 50% >= debt, "would under-collateralize"); // ② 再验偿付
uint256 tokBefore = _tokenBalance();
IAMM(amm).removeLiquidity(lp);                  // ③ 销毁 LP 拿回 ETH+代币
uint256 gotToken = _tokenBalance() - tokBefore; // ④ 余额增量法退币
IERC20(token).transfer(msg.sender, gotToken);
payable(msg.sender).transfer(address(this).balance);
```

① 必须在 ② 之前：用"扣完之后的剩余抵押"估值才能挡住超额撤出。
④ 用**交易前后余额差**而不是信任 AMM 的返回值（LabAMM 的
removeLiquidity 本来就没有返回值）；教学单池里质押的 ETH 全部
透传给 AMM、金库自身不留 ETH，所以收到的 ETH 全是本次所得。

### 27.4 折扣购买式清算：协议不用自己掏奖金

第 25 章踩坑 11 是"清算奖金从协议余额出，金库没留这笔钱"。
本章换了个模型——**折扣购买**：清算人替借款人还掉全部债务，
按 LP 单价打 **8% 折扣**"买"走等值 LP：

```solidity
require(healthFactor(user) < 1e18, "healthy");
uint256 wantLP = debt × 1.08 × 1e18 / lpPrice;  // 多拿的 8% 即奖金
require(wantLP <= lpCollateral[user], "insolvent");
IERC20(token).transferFrom(msg.sender, address(this), debt); // 清算人带钱来
tokenPool += debt;                                            // 债务全额回池
lpCollateral[user]     -= wantLP;
lpCollateral[msg.sender] += wantLP;                           // LP 内部划给清算人
```

奖金来自抵押品本身的折扣，**协议一分钱都不用备**；清算人拿到
LP 后再自己调 `unstake` 去 AMM 换回 ETH+代币完成变现。借款人
只损失被买走的那部分，剩余 LP 原样保留，债务一笔勾销。
`wantLP > 抵押LP` 时 revert("insolvent") 是最后防线：折扣价连
全部抵押都盖不住债务，说明已彻底穿仓，教学版选择不成交
（真实协议靠风险准备金/拍卖处理）。

### 27.5 前端要点

- **多返回值用 AbiCoder 整体解**：`lpValue` 一次返回
  `(uint256,uint256,uint256)`，`enc.decode(["uint256","uint256","uint256"], ret)`，
  原样传入返回值、不要剥 `0x`（老坑）。健康度无债务时合约返回
  `type(uint256).max`，页面显示 ∞。
- **多签者直接复用**：上一章把 `sendSigned(tx, signer)` 泛化后，
  "一键准备借款人"里 dev 出资、随机借款人签字的 5 笔串行交易
  （转 ETH 本金+gas → 转 220 代币 → approve → 质押 → 借款）
  不用再写第二套发送器。
- **2 倍超额还款/清算授权**：1%/秒的演示利率下，读债务到交易
  上链之间债务还在涨，授权与调用金额一律按读数值 ×2，合约端
  `repay`/`liquidate` 都只收实际债务（本次清算点击时页面显示
  债务 245.1，上链执行时已涨到 322.5，2 倍授权正好覆盖）。
- **清算窗口要轮询**：借款人借购买力的 60%（129 / 215），
  初始 HF=1.667；每秒 +1% 单利，约 67 秒后 HF 破 1，
  约 208 秒后穿仓（wantLP>0.1）。页面每 8 秒刷新一次
  目标健康度，读到 <1.00 立即点清算。

### 27.6 验证结果（DFIN：AMM 0.1/210 池 + 预言机 2100 + 演示利率 1%/秒）

第一段，开发账户自有仓位：

| 步骤 | 区块 | 链上结果 |
|---|---|---|
| 部署金库 / approve / fund 10000 | 1169 / 1171 / 1173 | tokenPool=10000 |
| 质押 0.1 ETH+210 DFIN | 1181 | LP=0.1，估值 0.1×2100+210=**420**，maxBorrow=210 |
| 借出 50 | 1187 | tokenPool=9950，HF 随利息下降 |
| 还清（点击时债务 177.5） | 1207 | 执行时债务已涨到 **200**，实付 200，debt=0、HF=∞ |
| 撤出全部 0.1 LP | 1211 | ETH+210 代币回钱包，AMM 池归零（无最小 LP 锁定） |

第二段，清算演练（借款人 `0x79308bD7…33fba`，空池首注 0.1/220，
估值 430，maxBorrow=215，借 60%=129）：

| 时间点 | HF | 说明 |
|---|---|---|
| 借款刚上链（区块 1253） | 1.667 | debt=129 |
| 轮询序列 | 1.449 → 1.149 → 1.042 → **0.952** | 8 秒一刷 |
| 清算执行（区块 1263，借款后整 10 块=150 秒） | 0.667 | debt=129×(1+0.01×150)=**322.5** |
| 清算结果（同一笔） | — | seizeLP=322.5×1.08/4300=**0.081**（估值 348.3=322.5×1.08 ✔），借款人剩 0.019 LP、债务清零 |
| 清算人撤出 0.081 LP | 1269 | 0.081 ETH+178.2 代币到 dev 钱包 |

链上独立核验（绕开网页，JSON-RPC 直查；选择器/事件 topic 全部
`ethers.id` 现算）：

```text
tokenPool()      = 10343.5   对账: 10000 − 50 + 200 − 129 + 322.5 = 10343.5 ✔
ratePerSecond()  = 0.01
借款人 lpCollateral = 0.019 LP，debt=0，principal=0
dev    lpCollateral = 0（seized LP 已在 1269 撤出变现）
AMM reserveETH/Token = 0.019 / 41.8，totalLP=0.019，全部由金库持有
事件计数: Funded×1(1173) Staked×2(1181,1251) Borrowed×2(1187,1253)
         Repaid×1(1207) Liquidated×1(1263, status=1) Unstaked×2(1211,1269)
```

### 27.7 本阶段踩坑（第 13、14 条）

**第 13 条：同名按钮藏在隐藏页里，点击"成功"但点错对象。**
自动化测试按按钮文字"💸 借出"找元素，借贷页和乐高页各有一个
同名按钮；正则命中的第一个属于 `display:none` 的旧页，点击不报错、
交易也不产生，排查方向一度被带偏。对策：**自动化点击一律用唯一
id（`document.querySelector('#btn-lg-borrow').click()`），
或给快照加容器范围限定**；读 `<input>` 的值要用 `.value` 而不是
`.textContent`（后者永远是空串）。

**第 14 条：代付资金要分清"gas 钱"和"本金"。** 一键准备借款人
最初只给随机账户转 0.05 ETH 当 gas，但借款人质押时要向 AMM
**自带 0.1 ETH 本金**（`stakeLiquidity` 是 payable 的，本金与
gas 是两笔钱），发送前余额预检在第 4 笔交易拦下：
"现有 0.0499 ETH，本次约需 0.1015 ETH"。修正为转 **0.15 ETH
（0.1 本金 + 0.05 gas）**。代新账户走完整业务流程时，清单里
必须同时列上"业务本金"和"每笔 gas 之和"，不能只想到 gas。

### 27.8 与后续阶段的衔接

- 至此 AMM → 预言机 → 借贷 → 金库四层全部咬合：**八连 ✅**
  （钱包、ERC-20、NFT、质押、DEX、借贷、预言机、乐高）；
- **治理**：CF（50%）、清算奖金（8%）、利率参数下一步可由投票修改；
- 真实产品的差距：LP 估值应防 AMM 现货价被闪电贷操纵（用预言机价
  而非池内现价、加 TWAP）；清算应有分批上限与拍卖；应支持 LP ERC-20
  直接转账入质；金库应引入价格新鲜度检查。

---

## 28. 阶段 7：链上治理（Governance）——投票权、快照与 Timelock

### 28.1 为什么需要治理

前面七个模块里，协议参数（利率、CF、清算奖金）都由部署者一把抓。
一旦协议管的钱变多，"代码即法律"就撞上一个现实问题：**代码要升级、
参数要调整，谁说了算？** 治理（Governance）就是把"谁能改协议、
怎么改、改了什么时候生效"这三件事也写成合约，让链上投票代替
"部署者私钥"。本模块用四个合约复现 Compound/Compound-V2 的经典三件套：

| 合约 | 角色 | 对应真实世界 |
|---|---|---|
| `LabVoteToken` | 投票权代币（Compound 式检查点） | COMP / UNI / 各币的 Votes 扩展 |
| `LabGovernor` | 提案、计票、状态机 | GovernorAlpha / OZ Governor |
| `LabTimelock` | 排队 + 最短延迟 + 宽限期 | Timelock |
| `LabBox` | 被治理的"资产"（一个变量） | 任何被协议控制的资金/参数 |

治理体系就位后：Box 的 owner 是 Timelock，Timelock 的 admin 是
Governor——**任何人（包括部署者）想改 Box 都必须走完整提案流程**。

### 28.2 投票权≠持币：delegate 与检查点快照

`LabVoteToken` 的核心不是转账，而是**历史投票权查询**：

- `delegates[account] == 0`（从未委托）→ 票记在持币人自己头上；
- `delegates[account] != 0` → 票记在委托目标头上；
- 每次余额/委托变动，都给"票主"写一个 `{fromBlock, votes}` 检查点，
  `getPriorVotes(addr, block)` 用二分查找还原任意历史区块的票权。

这就是 Compound 的经典实现（OZ ERC20Votes 是它的位图优化版）。
三条必须刻在脑子里的语义：

1. **`delegate(to)` 不是"请求"，是"搬家"**：执行后"我"名下的全部票
   从此记到 `to` 名下。旧版 UI 上"自委托"按钮把目标填错，
   部署者 100 万票瞬间搬进选民账户（坑 14）。
2. **提案用 `snapshotBlock = block.number - 1` 计票**：`getPriorVotes`
   要求查询区块严格小于当前块（本块检查结果"尚未确定"），所以提案
   前一区块的票才是准的；setup 末尾内置等一个出块周期，就是为了让
   铸币检查点成为历史。
3. **委托晚于提案 = 快照票为 0**：防"临投票前买票/委托"。前端
   `govVotersVote` 先 `getPriorVotes` 预检，快照 0 票直接跳过并提示。

### 28.3 Timelock：治理的"三权分立"

```
提案(Governor 计票) → 投票窗口 → 法定票数达成 → queue 排入 Timelock
    → 等 delay 秒（本教学 30s，Compound 是 2 天）→ execute 真正执行
```

`LabTimelock.executeAction` 的四道闸门：`msg.sender == admin`（只有
Governor 能触发）、`eta != 0`（排队过）、`block.timestamp >= eta`
（延迟到期）、`<= eta + GRACE_PERIOD`（宽限期内，过期作废）。
delay 的意义：**即使投票被恶意通过，用户也有两天时间提款离场**——
这就是 2022 年多个协议被"闪电贷投票攻击"后 Timelock 仍保住资金的原因。

`state(id)` 状态机返回 OZ 风格状态码（0-7）：Active → Succeeded →
Queued → Executed，前端按状态点亮 queue/execute 按钮。

### 28.4 浏览器端到端实录

一键部署 6 笔交易（约 3.5 分钟）→ 一键造 2 个选民（转 gas +
5000 GOV + 各自 `delegate(自己)`，6 笔约 2.5 分钟）→ 提案 #1
（Box.setValue(42)）→ 两选民各投赞成（快照票 5000×2=10000 ≥
quorum 1000）→ 窗口 600 秒结束 → queue → 等 30 秒 → execute。
链上事件核验：

```
b2497 ProposalCreated #1
b2501 VoteCast voter=0xf9bc55cd id=1 support=1 votes=5000.0
b2503 VoteCast voter=0x136bd426 id=1 support=1 votes=5000.0
b2539 ProposalQueued #1
b2545 ProposalExecuted #1
Box.value = 42.0
proposal #1 state = Executed
```

### 28.5 本轮踩坑实录

**第 15 条：`setVotingPeriod` 的权限别拿 Timelock admin。** 课堂上
"部署→造选民→提案"要跨十几分钟，投票窗口会过期。给 Governor 加
`setVotingPeriod` 延长窗口，第一版 `require(msg.sender == Timelock.admin())`
——可 setup 末尾已把 admin 交给了 Governor，部署者调它永远 `!admin`。
教学辅助函数的门槛应该用独立的 `guardian = msg.sender`（构造时的部署者），
而不是已被交接掉的 admin。

**第 16 条：所有"他人签名"的交易 from 都要核对。** 调试脚本解码
token 事件日志发现：选民自委托那笔交易的 `from` 竟是部署者账户——
`gvSend` 内部调 `sendSigned(fields)` 时**漏传了 signer 参数**，
默认值静默回落到全局钱包。`delegate` 语义是搬家，于是部署者的票
被一笔笔搬进选民名下，提案时被 `proposer below threshold` 拦下。
教训：**多签名者系统里，每笔交易落链后核对 from 与预期签名者是否一致**，
默认参数是最安静的 bug 源（`ethers` 的 `signTransaction` 不会报错，
它只是"正常地"用了另一个钱包）。

**第 17 条：status=0 要用 eth_call 重放暴露原因。** Besu 回执里只有
`status=0x0`。gvSend 失败后在 `rc.blockNumber - 1` 高度用相同
`{from, to, data}` 重放一次 `eth_call`，把 `0x08c379a0` 解码成
`Error(string)` 拼进异常——本轮 `!admin`、`not succeeded` 两个
revert 原因全部一击即中。提案按钮另加发送前 `latest` 预检，
门槛类错误不必浪费一笔交易。

**第 18 条：投票窗口要给"人机操作时间"留缓冲。** 15 秒出块 +
浏览器每笔确认约 30 秒，90 秒窗口连"造选民 3 笔"都放不下。最终
窗口固定 600 秒，且 `govVotersVote` 用快照票预检跳过 0 票选民而不是
直接失败。排队第一枪 `not succeeded` 正是因为窗口还剩 40 秒——
链上状态 `Active`，按钮却是按 Succeeded 才点亮的时序差，30 秒后
重试即成。教学环境里"窗口将尽"本身就是值得演示的状态机现场。

### 28.6 与后续阶段的衔接

- 治理可管之物：借贷利率参数、乐高金库 CF、预言机 reporter 白名单、
  下一站的赔率与抽水比例；
- 真实产品的差距：快照应改用 OZ ERC5805（区块+时间双锚）、投票应支持
  签名投票（EIP-712）、Timelock 应分级（快速通道/慢速通道）、
  应防一票多投的闪电贷投票（用提案时快照天然免疫，但"借币投票后
  归还给 LP 分成"仍需 veto 委员会）。

---

## 29. 阶段 8：链上博彩——没有随机的赌场（LabCasino）

> 合约：`dex-labs/contracts/LabCasino.sol`；页签：🎰 博彩。
> 一句话：**链上赌场教的不是博彩，是"承诺-兑现"式随机性与概率定价。**

### 29.1 为什么"链上随机数"是个伪命题

EVM 是确定性状态机：所有节点对同一区块必须算出相同结果。而随机数
恰恰要求"事前没人知道"。于是链上取随机处处是坑：

- `blockhash(block.number)` **恒为 0**。EVM 只保留最近 256 个区块哈希，
  **本区块的哈希要等下一块被算出来才存在**——这是本轮 E2E 里
  `seed not ready` 报错的物理根源；
- `block.timestamp`、`coinbase`、`difficulty` 全部可由出块者小幅操纵，
  对赌局来说就是庄家出老千；
- 前端传"随机数"进合约 = 玩家自带答案，合约照单全收。

真实产品的答案是 Chainlink VRF（可验证随机函数）或链下 commit-reveal
网络。教学版用一个极简替身：**延迟开奖**。

### 29.2 延迟开奖：blockhash 的正确用法

下注时把"未来第 3 块的哈希"承诺为种子：

```solidity
seedBlock = block.number + SEED_DELAY;   // bet 时锁定
// reveal 时：
require(block.number > b.seedBlock, "seed not ready");
uint256 result = uint256(blockhash(b.seedBlock)) % 100;
```

三个安全性质：下注后 45 秒（3 块）内没人能改写结果；出块者在下注当时
也无法预知 3 块后的哈希（要改写只能重组织 3 个区块以上，教学链可接受）；
超过 256 块后哈希变 0，`require(uint256(h) != 0)` 挡住"翻旧账"路径。
这是 commit-reveal 的单人简化版——承诺是区块本身，兑现是哈希。

### 29.3 赔率、概率与庄家优势

| 玩法 | 概率 | 赔率（含本金） | 庄家优势 |
|------|------|----------------|----------|
| 开小 (<50) | 49/100 | 198/100 | 2%（少一个"<50 的整数"） |
| 开大 (≥50) | 51/100 | 196/100 | ≈0%（教学故意留缺口） |
| 押中数字 | 1/100 | 9000/100 | 10% |

期望值算式：押 1 ETH 开小，EV = 0.49 × 1.98 − 1 = **−2.98%**。
大数定律保证庄家稳赚的从来不是运气，是 `赔率 < 1/概率` 这行代码。
`reveal` 里 `require(address(this).balance >= payout, "house broke")`
则演示了准备金模型——赌池透明，赔不起就整笔 revert，绝不"欠条兑彩"。

### 29.4 E2E 实录（浏览器全链路）

部署 → 单独发一笔转账注资开池 0.3 ETH → 连下 5 注（各 0.1 ETH）→
seed 未到期点开奖被前端预检拦截 → 逐注开奖。链上事件流水核验
（eth_getLogs + 手工解码）：

```
houseBalance = 0.302 ETH
b2631 BetPlaced    #1 choice=1 guess=42 amt=0.1 seedBlock=2634
b2639 BetRevealed  #1 result=13  won=false payout=0.0
b2643 BetPlaced    #2 choice=1 guess=42 amt=0.1 seedBlock=2646
b2649 BetRevealed  #2 result=6   won=false payout=0.0
b2653 BetPlaced    #3 choice=1 guess=42 amt=0.1 seedBlock=2656
b2659 BetRevealed  #3 result=6   won=false payout=0.0
b2667 BetPlaced    #4 choice=0 guess=42 amt=0.1 seedBlock=2670
b2673 BetRevealed  #4 result=73  won=false payout=0.0
b2677 BetPlaced    #5 choice=0 guess=42 amt=0.1 seedBlock=2680
b2687 BetRevealed  #5 result=17  won=true  payout=0.198
```

对账：0.3（开池）+ 4 × 0.1（输注归庄）− 0.198（#5 派彩 17<50，
0.1 × 198/100）= **0.302 ETH**，与 `houseBalance()` 分毫不差。
前端界面同步显示"🎉 注单 #5 开奖：点数 17，赢了！彩金已打入账户"。

### 29.5 踩坑实录

**第 19 条：构造函数里的 `require(msg.value >= 1 ether)` 炸掉部署。**
前端把"部署"和"注资"设计成两笔交易（部署合约的交易通常不带 value），
构造函数却照抄了"必须带初始资金"的直觉——第一枪 status=0。
教训：**部署交易的 value 语义与业务注资是两回事**，教学版把开池资金
交给部署后的独立转账，构造函数只做 `owner = msg.sender`。

**第 20 条：indexed 事件参数不在 data 里。**
用 eth_getLogs 手工解码时反复 "Cannot convert 0x to a BigInt"，
根因是 `BetPlaced(uint256 indexed id, address indexed player, ...)`
的 `id`、`player` 被 Solidity 放进 **topics[1]/topics[2]**，data 只剩
4 个字（choice/exactGuess/amount/seedBlock），按 5 个字切自然越界。
规则：**indexed 参数在 topics（每个 32 字节），非 indexed 依次进 data**。
BetRevealed 同理：id 在 topic，data 是 result/won/payout 3 个字。

**第 21 条：`reveal` 前先 `betInfo` 预检。**
`canReveal` 由合约侧计算（未开 + 有注 + `block.number > seedBlock`），
前端点击先 eth_call 预检，"seed 未就绪"直接提示剩余区块数，
不浪费一笔必 revert 的交易——这是第 17 条"发送前预检"哲学在
博彩场景的复用。

### 29.6 与后续阶段的衔接

- 真实博彩产品：VRF 随机源、多签准备金、限红/KYB、抽水进治理金库
  ——治理模块的 Timelock 恰好是参数（赔率/抽水）升级的执行通道；
- `paused` 开关目前只有 owner 一个后门——这正是下一站
  **身份与权限（AccessControl）**要解决的问题：谁能开、谁能停、
  谁能 mint，不该是一个 owner 独裁，而是一套可分解的角色图。

---

## 30. 阶段 9：身份与权限——把 owner 拆成角色（LabAccessControl）

> 合约：`dex-labs/contracts/LabAccess.sol`（LabAccessControl + LabVipToken）；页签：🛡️ 身份。
> 一句话：**权限不是一把手，是一张"角色 → 成员"的多对多关系表。**

### 30.1 从 owner 独裁到 AccessControl

博彩合约里 `paused` 只有 owner 能切——一人兼发行、暂停、授权三职，
私钥即合约。OpenZeppelin 的 AccessControl 把权力拆成 **bytes32 角色**：

```solidity
mapping(bytes32 => mapping(address => bool)) internal _members;
function hasRole(bytes32 role, address account) public view returns (bool);
function grantRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE);
function revokeRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE);
function renounceRole(bytes32 role, address account) external; // 只能对自己
```

角色标识就是 `keccak256("MINTER_ROLE")` 这类字符串哈希，无需注册表。
LabVipToken 内置三角色：DEFAULT_ADMIN（发/收角色）、MINTER（铸币）、
PAUSER（暂停），互相制衡：ADMIN 铸不了币，MINTER 停不了币。

两个设计细节值得记：

- **renounce 只能 renounce 自己**——恶意指令永远无法"替别人丢权限"；
  grant/revoke 才有 ADMIN 门槛。E2E 里演示了 ADMIN 替员工 renounce
  被 `can only renounce self` 拦截。
- 构造函数里 ADMIN 直接写 `_members`（internal 而非 private），
  派生合约才能初始化自己的部署者——private 状态变量在派生合约里
  是"查无此人"，编译直接 Undeclared identifier。

### 30.2 E2E 实录（浏览器全链路）

部署（我拿 ADMIN）→ 造员工 0xf5795aD2（合约金库代管 0.03 ETH gas）→
员工 mint 被拒 → 提拔 MINTER → mint 成功 100 VIP →
员工暂停被拒 → 提拔 PAUSER → 暂停 → mint 被拒（`token paused`）→
恢复 → 员工自弃 MINTER（角色表只剩 PAUSER）。

链上事件流水核验（合约 0x7231c303…，eth_getLogs 直读）：

```
b0x130f RoleGranted   DEFAULT_ADMIN → 部署者
b0x1313 Deposited     0.031 ETH（合约金库充值）
b0x1315 Deposited     0.03  ETH（topup 转给员工）
b0x1317 RoleGranted   MINTER_ROLE → 员工
b0x1319 Transfer      mint 100 VIP
b0x131d Transfer      mint 100 VIP
b0x131d RoleGranted   PAUSER_ROLE → 员工
b0x1321 PausedSet     true → false（暂停/恢复两次）
b0x1325 PausedSet
b0x1327 RoleRevoked   MINTER_ROLE ← 员工自弃（sender=员工自己）
```

`ac-state` 面板同步显示"运行中 / 累计铸币 2 次"，与事件计数吻合。

### 30.3 踩坑实录

**第 22 条：`payable` 不是装饰，msg.value 是权限。**
`topup()` 想读 `msg.value` 却没写 payable，solc 直接拒收：
"`msg.value` can only be used in payable public functions"。
payable 决定"能不能带钱进来"，msg.value 决定"进来了多少钱"，
二者必须同时在场。

**第 23 条：合约函数不写 receive() 就收不了 ETH。**
给合约充值（data=0x + value）踩了空——没有 `receive() external payable`
的合约收到纯转账一律 revert。教学版 topup 的设计是"先充合约金库、
再由 ADMIN topup(to, amount) 分发给员工"，金库入口就是 receive()。

**第 24 条：员工没钱是权限教学最大的敌人。**
随机员工要自己签名发交易，就得有自己的 gas。dev 直接转账给员工
在本机 Besu 上被拒（原因未明，已排除 nonce/余额/gasPrice），
最终方案：合约金库 + `topup(address,uint256)` 内部 call 转账——
**走合约的 ETH 搬运一路畅通**。教学上反而多赢一个知识点：
合约内部 call 与外部 transaction 是两条独立的资金通路。

**第 25 条：ethers.id 的选择器缓存会"污染"调试。**
函数从 `topup()` 改名 `topup(address,uint256)` 期间，前端旧缓存把
两个签名的选择器混用过一次——编码"看起来正确"，revert 原因却查不到。
调试选择器问题时，先用 `cast sig` / python keccak 独立算一遍选择器，
别全信浏览器里的值。

### 30.4 与后续阶段的衔接

- 跨链桥（下一站）是权限教学的集大成：验证者签名集合、
  锁仓金库的 ADMIN、映射代币的 MINTER，一张角色表管两条链；
- 真实项目的进阶：角色分层（RoleAdmin 改角色持有者）、
  时间锁授权（grant 后延迟生效）、多签管理 ADMIN
  ——治理模块的 Timelock 正是这一角色。

---

## 31. 阶段 10：跨链桥——锁仓 + 映射发行（LabBridgeVault）

桥是 Web3 里被盗次数最多的设施（Ronin 6.2 亿、Wormhole 3.2 亿、
Multichain 2.3 亿——全是"签名验证"这一环出的事）。本阶段用
**同链双合约**模拟"两条链"，把锁仓-放行-烧币-放还四步全部走通，
每一笔都在链上留事件脚印。

### 31.1 桥的世界观：不造币，只搬运

```
A 侧（源链）                          B 侧（目标链）
┌──────────────┐                     ┌──────────────┐
│ LabBridgeVault│── ① deposit 锁 0.05 ─▶│ 事件被验证者观察 │
│  真 ETH 金库  │                     │ LabBridgeVault │
│  锁仓 0.05    │                     │  挂 beETH 映射币 │
└──────────────┘                     └──────┬───────┘
       ▲                                    │ ② confirmMint
       │ ④ confirmUnlock 放还真币              │   验 2/3 签名放行
       │                                     ▼
┌──────┴─────    ③ unlock 烧 0.05 beETH   ┌──────────────┐
│ 等回程单被确认  ◀──────────────────────  │ 用户持 0.05 beETH │
└──────────────────────────────────────  └──────────────┘
```

- **去**：A 侧 `deposit()` 锁真币 → 验证者对 `(nonce, 收款人, 金额)`
  做 EIP-191 个人签名 → B 侧 `confirmMint()` 用 `ecrecover` 验够
  quorum 个签名后，从流动性池转 0.05 beETH 给收款人；
- **回**：B 侧 `unlock()` 烧掉映射币 → A 侧 `confirmUnlock()`
  验同样的签名集合后从金库放还真币；
- **安全模型**：桥本身不持私钥，放行与否完全取决于
  "验证者白名单 + 阈值签名"。私钥轮换、阈值升级都是链下治理的事。

### 31.2 合约要点（LabBridge.sol）

**签名消息**——与前端严格对齐是桥的第一课：

```solidity
function messageHash(uint256 nonce, address recipient, uint256 amount)
    public pure returns (bytes32)
{
    bytes32 structHash = keccak256(abi.encode(nonce, recipient, amount));
    return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", structHash));
}
```

前端必须 `signMessage(keccak256(abi.encode(...)))`——注意是
`abi.encode`（32 字节字对齐），**不是** `solidityPacked`。
两种编码对同一组参数产出不同哈希，签名自然对不上（坑 26）。

**calldata 里手抠 bytes[]**——`ecrecover` 需要裸 r/s/v：

```solidity
function _sigAt(bytes[] calldata sigs, uint256 i)
    internal pure returns (bytes32 r, bytes32 s, uint8 v)
{
    assembly {
        // p = 元素区起始：4(选择器) + sigs 头值 + 32(跳过数组长度字)
        let p := add(36, calldataload(100))
        let ptr := add(p, calldataload(add(p, mul(i, 32))))
        r := calldataload(add(ptr, 32))    // 跳过元素首字（长度 65）
        s := calldataload(add(ptr, 64))
        // 65 字节 = 2 整字 + 1 字节：v 落在第 4 字的 byte(0)，不是末字节
        v := byte(0, calldataload(add(ptr, 96)))
    }
}
```

**防重放三件套**：全局递增 nonce（同一单号只能放行一次
`_minted[nonce]`）、签名集合按签名者地址升序且去重
（`signer > last`）、已消费签名哈希黑名单 `_usedSigs`。

### 31.3 E2E 实测流水（合约 0xCbd6…账户，区块号实录）

| 步骤 | 动作 | 事件 | 区块 |
|---|---|---|---|
| 部署 | A/B 金库 + beETH + 灌 1 beETH 流动性 | ValidatorSet×3、RoleGranted×2 | 5329 / 5331 |
| ① | deposit 0.05 ETH（单号 #1） | A: `DepositInitiated nonce=1 amount=0.05` | 5343 |
| ② | 验 2/3 签名放行 | B: `MintConfirmed nonce=1 amount=0.05` | 5345 |
| ③ | unlock 烧 0.05 beETH（回程单 #1） | B: `WithdrawalInitiated nonce=1 amount=0.05` | 5349 |
| ④ | confirmUnlock 放还真币 | A: `UnlockConfirmed nonce=1 amount=0.05` | 5351 |

映射币 Transfer 流水 6 笔与四步一一对应：
mint 1 → fundPeg 1 → 放行 0.05 → 烧回 0.05；
最终余额核验：钱包 0.967 ETH = 1.017 − 0.05(gas 损耗)，
真币分文不少回到用户手里，beETH 余额归零——**锁一 peg 一**成立。

### 31.4 踩坑实录

**坑 26：前端签名哈希与合约 messageHash 不一致。**
前端图省事用了 `solidityPacked`，合约是 `keccak256(abi.encode(...))`。
`abi.encode(uint256,address,uint256)` 每个参数占 32 字节字，
`packed` 则是 address 按 20 字节紧排——96 vs 84 字节，哈希必然不同。
症状：`ecrecover` 恢复出一个"谁都不认识"的地址，报
`sigs must be unique & ascending`（第一条签名就 > last 失败）。
定位方法：加一个同参数布局的 `view` 调试函数，把合约侧
`ecrecover(h, v, r, s)` 的恢复地址原样吐出来，
和前端 `recoverAddress` 一对比就知道差在哪。验证完删除调试函数。

**坑 27：v 不在签名 65 字节的"末尾"，在 padding 字的开头。**
65 字节 ABI 编码后是 4 个字：`[len][r|s 前 31B 混排…][s 尾…][v||31 字节 0]`。
直觉 `byte(31, 第4字)` 取末字节——错，v 是第 4 字的 **byte(0)**。
取错位置 → v=0 → ecrecover 恢复出垃圾地址。
规则：签名长度非 32 整倍时，永远画一张 4 字布局图再写 byte(i)。

**坑 28：solc 禁止在内联汇编里直接拿 `bytes[] calldata` 变量做算术。**
`let p := add(sigs, 32)` 编译报
`Call data elements cannot be accessed directly`——
calldata 动态数组的标识符在汇编里的含义由编译器定义，不同版本会变。
稳妥做法：当函数参数布局固定时，直接按 calldata 绝对偏移写
（`calldataload(100)` 取 sigs 头值），并在注释里画清布局。

**坑 29：同链双合约模拟下，B 侧看不到 A 侧的 deposits。**
真实桥里"目标链合约"当然不知道源链的锁仓记录——放行信息本来就是
**由签名背书、随 calldata 携带**的。第一版 `confirmMint(nonce, sigs)`
想读 `deposits[nonce]`，报 `no deposit`。改成
`confirmMint(nonce, recipient, amount, sigs)`：合约不信存储，只信签名。
这反而更贴近真实桥的设计。

**坑 30：gas 耗尽后注资走错了账户。**
`/dev-key` 给的 dev 账户（创世预 funded）早已在前几轮实验中耗尽，
用它再转账会报 `Upfront cost exceeds account balance`。
本机链上另一个有资金的账户是第二个验证者节点（node2.key，3 ETH）。
教训：**长实验前先查余额**，注资脚本要指定正确的富账户。

### 31.5 与真实桥的差距（诚实清单）

- 真实桥是两条**独立链**，验证者用轻客户端证明或委员会签名跨链传消息；
  本教学同链双合约只演示信任模型，不演示跨链证明；
- 真实验证者是链下轮值委员会 + 链上注册表，本教学复用预言机私钥；
- 映射币真实发行权归桥合约本身，本教学为演示流动性灌入用了 issuer；
- 主流方案谱系：锁定-铸造（本教学）、Burn-Mint（BTC 跨链常用）、
  意图桥（Across/UniswapX）、轻客户端桥（IBC/Optimism）。

---

# 第六部分：十二种智能合约专题

> **编排说明**：每种合约严格按 **① 背景 → ② 代码详解 → ③ 部署过程** 三段展开。
> 合约源码全部位于 `dex-labs/contracts/`，本部分的代码摘录均节选自真实部署版本；
> 每个专题末尾的"→ 实录"指向第五部分对应章节，那里有完整的浏览器端到端验证数据与踩坑记录；
> 每个专题的 **④ 逐句精解** 给出该合约的**完整源码**，每行代码都有编号解释。
> 环境统一约束（血泪换来的三条铁律，详见附录 A）：
> ① 编译锁 `evmVersion: london`（Besu 24.12 不支持 PUSH0）；
> ② 避开 `**` 幂运算，10¹⁸ 直接写字面量；
> ③ 所有交易显式 `gasPrice ≥ 1 Gwei` + `gasLimit`。

---

## 专题 00：合约总览——一张图看懂十二合约如何咬合

```
                        ┌─────────────────────────────────────────┐
                        │            01 钱包（浏览器签名器）          │
                        │   私钥不出浏览器；一切交易的发起方            │
                        └───────────────────┬─────────────────────┘
                                            │ 签名/发交易
        ┌───────────────────────────────────┼──────────────────────────────┐
        ▼                                   ▼                              ▼
  02 ERC-20 代币 ◄───发行/转账────┐    03 NFT              资产凭证类：
  （一切 DeFi 的原子资产）          │   （唯一数字藏品）      02 管同质化资产
        │                        │                       03 管唯一化资产
        ├─质押──► 04 质押挖矿      │                       12 的映射币
        │        （按秒分奖励）     │
        ├─配对──► 05 DEX 做市池 ◄──┘
        │        （x·y=k 自动定价）
        │             │ LP 份额
        │             ▼
  07 预言机 ──喂价──► 06 借贷协议 ◄───同一模型──── 08 DeFi 乐高地基
 （多源中位数）       （ETH 抵押借币）              （LP 抵押借币，三合约咬合）
                          │
                          │ 参数谁来改？
                          ▼
  09 治理四件套：投票代币 ──► Governor ──► Timelock ──► 被治理资产
 （提案/投票/排队/执行，延迟生效防突袭）
        │
        │ 应用层：治理管不到的"人性"场景
        ▼
  10 博彩（延迟开奖 + 概率定价）
  11 身份权限（角色图取代 owner 独裁）
  12 跨链桥（锁仓+映射发行，签名阈值放行）
```

| # | 合约 | 文件 | 一句话本质 | 实录 |
|---|------|------|-----------|------|
| 01 | 钱包 | public/app.js（非合约） | 本地签名 + 代理广播，私钥不出浏览器 | 第 20 章 |
| 02 | ERC-20 | LabToken.sol / LabFactoryToken.sol | 余额 = 一个 mapping，转账 = 改两个数字 | 第 21 章 |
| 03 | NFT | LabNFT.sol | 每枚藏品独立确权，URI 指向元数据 | 第 22 章 |
| 04 | 质押 | LabStaking.sol | 按时间按份额分钱，updateReward 结算到此刻 | 第 23 章 |
| 05 | DEX | LabAMM.sol | x·y=k，价格由储备比例决定，无人挂单 | 第 24 章 |
| 06 | 借贷 | LabLending.sol | 超额抵押 + 持续计息 + 无许可清算 | 第 25 章 |
| 07 | 预言机 | LabOracle.sol | 链上不能上网，多源报价取中位数 | 第 26 章 |
| 08 | 乐高 | LabLego.sol | 不动旧合约，套一层金库让 LP 可抵押 | 第 27 章 |
| 09 | 治理 | LabGovernance.sol（4 合约） | 投票权快照 + Timelock 延迟执行 | 第 28 章 |
| 10 | 博彩 | LabCasino.sol | 链上无真随机，用未来区块哈希承诺开奖 | 第 29 章 |
| 11 | 权限 | LabAccess.sol（2 合约） | 权限 = 角色→成员的多对多关系表 | 第 30 章 |
| 12 | 桥 | LabBridge.sol（2 合约） | 桥不造币只搬运，放行只看签名阈值 | 第 31 章 |

---

## 专题 01：钱包（前端签名器）

### ① 背景

钱包是用户进入链上世界的唯一入口：管理私钥、查余额、发交易。
本项目不依赖 MetaMask，在网页里手写一个最小可用钱包，目的有二：
安全边界透明（私钥只存在于浏览器内存，服务器只转发**已签名**的原始交易）；
理解一笔交易的完整生命周期（构造 → 签名 → 广播 → 出块 → 回执）。

### ② 代码详解

核心通路（app.js）——完全绕开 ethers provider 的交易流水线，手工三步走：

```js
// 1. 构造交易字段（必须显式 gasPrice ≥ 1 Gwei，Besu min-gas-price 默认 1）
const tx = { from: signer.address, to, value, nonce,
             gasLimit: "21000", gasPrice: "1000000000", chainId: 1337, data };
// 2. 本地签名——私钥在这里、也只在这里参与运算
const signed = await signer.signTransaction(tx);
// 3. 交给代理广播，然后轮询回执
const hash = await rpc("eth_sendRawTransaction", [signed]);
const rc   = await waitReceipt(hash);   // 15 秒出块，状态 ⏳ → ✅ 区块 N
```

三个必须做对的细节：

- **地址规范化**：Besu 对非规范地址报极具误导性的错，入口统一
  `"0x" + to.toLowerCase().replace(/^0x/, "")` + 正则校验；
- **余额预检**：发送前核对 `余额 ≥ gas 开销 + 转账金额`，把
  "Upfront cost exceeds account balance" 翻译成中文提示；
- **两段式交易记录**：广播前 `recordTx(hash)`（⏳），回执后
  `settleTx(hash, ok, block)`（✅），刷新页面不丢。

### ③ 部署过程

钱包不是链上合约，无部署步骤；"部署"即打开 http://127.0.0.1:3000：

1. 创建新钱包（`ethers.Wallet.createRandom()`）或导入私钥；
2. 开发账户从 `/dev-key` 读节点 sealer 私钥（仅本机教学便利）；
3. 状态存 `localStorage["lab.wallet"]`，刷新自动恢复；
4. 验证：开发账户转 0.3 ETH → 区块 547 gasUsed 21000，导入新私钥余额正确。

### ④ 逐句精解（关键通路完整源码）

钱包是前端 JS（约 60 行核心），其余十一节均为 Solidity；为保持"每句都有解释"，这里给出完整通路：

```js
// ── ① RPC 通道：所有链上读写的唯一出口 ──────────────────────
async function rpc(method, paramsArr) {                       // 1
  const delays = [0, 500, 2000, 5000, 5000];                  // 2
  let lastErr = null;                                         // 3
  const payload = JSON.stringify(                             // 4
    paramsArr && paramsArr.length
      ? { jsonrpc: "2.0", id: 1, method, params: paramsArr }
      : { jsonrpc: "2.0", id: 1, method });
  for (let attempt = 0; attempt < delays.length; attempt++) { // 5
    if (delays[attempt]) await new Promise((r) => setTimeout(r, delays[attempt]));
    try {                                                     // 6
      const res = await fetch(RPC_ABS, {                      // 7
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      const j = await res.json();
      if (j && j.result !== undefined) return j.result;       // 8
      if (j && j.error) lastErr = new Error(j.error.message); // 9
    } catch (e) { lastErr = e; }                              // 10
  }
  throw lastErr || new Error("RPC 请求失败");                 // 11
}

// ── ② 交易发送器：本地签名 + 直接广播 ───────────────────────
async function sendSigned(txFields, signer = wallet) {        // 12
  const nonce = await rpc("eth_getTransactionCount",          // 13
    [signer.address, "latest"]);
  const gasPrice = BigInt(txFields.gasPrice ?? "1000000000"); // 14
  const value = txFields.value ?? 0n;                         // 15
  const balWei = BigInt(await rpc("eth_getBalance",           // 16
    [signer.address, "latest"]));
  const cost = BigInt(txFields.gasLimit) * gasPrice + value;  // 17
  if (balWei < cost) throw new Error("余额不足…");             // 18
  const tx = {                                                // 19
    type: 2, chainId: CHAIN_ID,
    nonce: Number(BigInt(nonce)),
    maxPriorityFeePerGas: 0n, maxFeePerGas: gasPrice,
    gasLimit: txFields.gasLimit,
    to: txFields.to ?? null,                                  // 20
    data: txFields.data ?? "0x", value,
  };
  const signed = await signer.signTransaction(tx);            // 21
  const hash = await rpc("eth_sendRawTransaction", [signed]); // 22
  return hash;                                                // 23
}
```

| # | 解释 |
|---|------|
| 1 | 所有 JSON-RPC 调用的统一入口，`method` 如 `eth_call`，`paramsArr` 是**显式数组**——Besu 对缺参回吐误导性错误"Invalid block, unable to parse RLP"，宁可包装统一也不能散着调 |
| 2 | 重试间隔表：0/0.5/2/5/5 秒共 5 次——Besu 偶发瞬时错误（同错误重放第二次几乎必成），递增间隔给节点喘息 |
| 3 | 记住最后错误，全失败时抛出真实原因而不是"未知错误" |
| 4 | 手工拼 JSON-RPC 2.0 报文；无参方法（如 `eth_blockNumber`）连 `params` 字段都不发 |
| 5-10 | 循环重试体：先等待再请求；`cache:"no-store"` 防浏览器缓存陈旧区块数据；HTTP 层错误（网络断、非 JSON）与 JSON-RPC 层错误（`j.error`）都归入 lastErr 继续重试 |
| 8 | 判成功用 `result !== undefined` 而不是 `!error`——有些方法成功时 result 是 `null`（如未决交易的回执） |
| 11 | 全部重试耗尽才放弃，把最后一次真实错误抛给上层界面显示 |
| 12 | 交易发送器：绕开 ethers provider 交易流水线（UMD 构建的轮询器在 15 秒出块链上有 bug）；`signer` 参数让预言机数据源、治理选民等"多私钥场景"复用同一通路 |
| 13 | 每次现查 nonce：本地缓存 nonce 在连续多笔时必然撞车（坑 10）；同 nonce 的两笔交易互相顶替，只有 GasPrice 高者上链 |
| 14 | 缺省 1 Gwei——Besu `min-gas-price` 默认 1，低于它直接被拒收（坑 3） |
| 15 | `?? 0n`：不带 value 的调用是纯合约交互（0 ETH） |
| 16-18 | **发送前余额预检**：Besu 原话 "Upfront cost exceeds account balance" 新手看不懂；预检翻译成中文，并给出现有/所需两个数字 |
| 19 | EIP-1559 类型 2 交易：`maxPriorityFeePerGas: 0`（本地链无 gas 市场，矿工就是自己的 sealer）；`maxFeePerGas` 用 1 Gwei——**注意 0 会被 min-gas-price 拒**（坑 7），想"零费"也得付 1 Gwei |
| 20 | `to: null` 是合约创建交易的约定写法（专题 02 部署代币走的就是这条） |
| 21 | **私钥只在这一行参与运算**：EIP-1559 签名 = secp256k1 对交易哈希签名，任何人可验、不可伪造 |
| 22 | 广播**已签名**的原始交易——服务器只转发不碰私钥，这是本钱包的安全模型：断网抓包看到的也只是一笔已签好名的交易 |
| 23 | 返回交易哈希；15 秒后用 `eth_getTransactionReceipt` 换回执（`waitReceipt` 每 2 秒轮询），回执里读 `status`（成败）与 `contractAddress`（新建合约地址） |

→ 实录：第 20 章

---

## 专题 02：ERC-20 代币（LabToken）

### ① 背景

代币是 DeFi 的原子资产。ERC-20 标准规定了 6 个必选函数
（transfer / balanceOf / approve / allowance / transferFrom / totalSupply）
+ 2 个事件（Transfer / Approval），钱包和合约之间因此可以互操作。
手写一份完整实现（不用 OpenZeppelin）是理解"授权模型"的最快路径——
DEX 能"拿走你的币"、借贷能"划走抵押品"，全靠 approve/transferFrom 这一对。

### ② 代码详解

```solidity
contract LabToken {
    uint256 public totalSupply;
    mapping(address => uint256) private _balances;                      // 余额表
    mapping(address => mapping(address => uint256)) private _allowances; // 授权额度表

    constructor(uint256 initialSupply) {
        _mint(msg.sender, initialSupply * 1000000000000000000); // 1e18 写字面量（避 ** 坑）
    }

    function approve(address spender, uint256 value) public returns (bool) {
        _allowances[msg.sender][spender] = value;   // "我允许你最多花我这么多"
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        uint256 allowed = _allowances[from][msg.sender];
        require(allowed >= value, "LAB: insufficient allowance"); // 代扣不得超额度
        if (allowed != type(uint256).max)
            _allowances[from][msg.sender] = allowed - value;       // max 额度免扣（省 gas 惯例）
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        uint256 fromBalance = _balances[from];
        require(fromBalance >= value, "LAB: insufficient balance");  // 失败整笔回滚
        unchecked { _balances[from] = fromBalance - value; }         // 已验证不会下溢
        _balances[to] += value;
        emit Transfer(from, to, value);   // 区块浏览器靠它展示转账记录
    }

    function _mint(address to, uint256 value) internal {
        totalSupply += value;
        _balances[to] += value;
        emit Transfer(address(0), to, value); // from=零地址 = 铸造的约定
    }
}
```

要点：

- **余额就是一个 mapping**——没有任何"转账动作"，只有改两个数字 + 发一个事件；
- **铸造发生在构造器**：演示"代币在部署那一刻被创造"，而非预分配；
- **`LabFactoryToken.sol`** 是它的可配置版（name/symbol/supply 全走构造函数），
  编译一次、发任意币——网页"发币工厂"用的就是这个模板。

### ③ 部署过程

CLI 路径（scripts/deploy.js）与网页路径（发币工厂）共用同一编译链：

```
solc 编译（evmVersion=london）→ 得 { bytecode, abi }
  → AbiCoder.encode(["string","string","uint256"], [name, symbol, supply]) 编码构造参数
  → 交易 = { data: bytecode + 编码参数, gasLimit: 20M, gasPrice: 1 Gwei }   // estimateGas 对创建交易不可信，固定 20M
  → 本地签名 → eth_sendRawTransaction → 等 15 秒出块
  → 回执 contractAddress 即代币地址，存 localStorage["lab.tokens"] 登记簿
```

验证：网页发行 UITK/DFIN 等多个代币（gasUsed ≈ 94 万），转账后
`eth_call` + balanceOf 选择器 `0x70a08231` 查接收方余额回显，区块 453-551 全部正确。

### ④ 逐句精解（LabFactoryToken.sol 完整源码——可配置版，发币工厂用）

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;                       // 1

contract LabFactoryToken {                     // 2
    string public name;                        // 3
    string public symbol;                      // 4
    uint8 public constant decimals = 18;       // 5
    uint256 public totalSupply;                // 6

    mapping(address => uint256) public balanceOf;   // 7
    mapping(address => mapping(address => uint256)) public allowance; // 8

    event Transfer(address indexed from, address indexed to, uint256 value);   // 9
    event Approval(address indexed owner, address indexed spender, uint256 value); // 10

    constructor(string memory _name, string memory _symbol, uint256 supply) {  // 11
        name = _name;                          // 12
        symbol = _symbol;                      // 13
        uint256 scaled = supply * 1000000000000000000;  // 14
        totalSupply = scaled;                  // 15
        balanceOf[msg.sender] = scaled;        // 16
        emit Transfer(address(0), msg.sender, scaled);  // 17
    }

    function transfer(address to, uint256 value) external returns (bool) {  // 18
        require(balanceOf[msg.sender] >= value, "insufficient balance");    // 19
        balanceOf[msg.sender] -= value;        // 20
        balanceOf[to] += value;                // 21
        emit Transfer(msg.sender, to, value);  // 22
        return true;                           // 23
    }

    function approve(address spender, uint256 value) external returns (bool) { // 24
        allowance[msg.sender][spender] = value;         // 25
        emit Approval(msg.sender, spender, value);      // 26
        return true;                           // 27
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) { // 28
        require(balanceOf[from] >= value, "insufficient balance");           // 29
        uint256 allowed = allowance[from][msg.sender]; // 30
        require(allowed >= value, "allowance");        // 31
        if (allowed != type(uint256).max) {            // 32
            allowance[from][msg.sender] = allowed - value;  // 33
        }
        balanceOf[from] -= value;              // 34
        balanceOf[to] += value;                // 35
        emit Transfer(from, to, value);        // 36
        return true;                           // 37
    }
}
```

| # | 解释 |
|---|------|
| 1 | 编译器版本约束：`^0.8.24` 匹配到 0.8.47；0.8+ 自带溢出检查，`a-b` 下溢自动 revert，不需要手写 SafeMath。编译时另须锁 `evmVersion=london`（Besu 24.12 不认 0.8.25+ 默认的 PUSH0，坑 1） |
| 2 | 合约声明：部署后 `LabFactoryToken` 这个名字消失，链上只有字节码；名字只存在于 ABI 里 |
| 3-4 | 状态变量存链上存储槽（各占 1 slot，字符串动态长度存 2 slot）；`public` 自动生成同名只读函数，`eth_call name()` 直接可读 |
| 5 | `constant` 不占存储槽（编译期直接嵌入字节码）；18 是小数位约定——链上只存整数，1 个币 = 10¹⁸ 个最小单位 |
| 6 | 总供应量：铸造时加、销毁时减（本实现不销毁），是"币有没有超发"的账本 |
| 7 | **余额表**：地址 → 余额。这就是"代币"的全部实体——没有金币模型，只有 mapping 里的数字 |
| 8 | **授权额度表**（两层 mapping）：`allowance[持有人][被授权人] = 额度`。ERC-20 最精妙的设计：授权状态放在合约里，任何人代扣都要过这道账（第 31 行） |
| 9-10 | 两个标准事件：`indexed` 参数进日志 topics 可被 `eth_getLogs` 过滤——收款查询、区块浏览器全靠它；Transfer 的 from/to、Approval 的 owner/spender 语义是标准强制的，钱包才能跨币统一展示 |
| 11 | 构造器只在**部署那一刻**执行一次；三个参数 ABI 编码后拼在字节码尾部随创建交易上链（"构造函数带参"的全部含义） |
| 12-13 | 名字符号入链——不可改（本实现没给 setter，连 owner 都改不了） |
| 14 | 放大 10¹⁸ 倍：**字面量直写**——`supply * 10 ** 18` 在 Besu 上会踩 precompile 区间坑（坑 2），教学环境一律写死字面量 |
| 15-16 | 全部初始供应记到部署者头上：链上第一笔"财富"凭空诞生，这就是"发行" |
| 17 | `address(0)` 作 from 是**铸造**的行业约定，区块浏览器据此把这笔显示为"发行"而非"转账" |
| 18 | 转账函数：`external` 只能被交易/外部调用；`returns (bool)` 是 ERC-20 规范要求（USDT 不返回布尔值曾被钱包区别对待） |
| 19 | 余额检查：不足直接 revert，本笔交易**全部改动回滚**（链上原子性——不存在"扣了一半"的状态），gas 照扣 |
| 20-21 | 转账的本质两行：from 减、to 加——没有任何"币的搬运"，只有两个数字的增减 |
| 22 | 发事件：日志存在链上但不进合约状态（合约读不到自己的事件），专供外部索引——收款查询卡片重放的就是它 |
| 23 | 恒为 true（失败在第 19 行就 revert 了），只为符合 ERC-20 接口 |
| 24 | 授权：「我允许 spender 最多替我花 value」——注意 approve **不转币**，此刻币还在持有人账上 |
| 25 | 直接覆盖额度（非增量语义）；ERC-20 著名的 approve 竞态攻击面（先抢用旧额度再被新额度覆盖）就出在这一行的时序，防御用 `increaseAllowance/decreaseAllowance`（本教学版省略） |
| 26-27 | 事件 + 恒真返回，同上 |
| 28 | **代扣转账**：`msg.sender` 是被授权人（如 DEX 池子），`from` 是币的实际主人——"谁能拿走你的币"的唯一合法通道 |
| 29-31 | 双重检查缺一不可：① from 余额够不够；② 授权额度够不够。DEX 能划走你的币，是因为你之前 approve 过它 |
| 32-33 | **无限授权免扣**惯例：额度是 `type(uint256).max` 时不递减（省一次 SSTORE ≈ 5000 gas）；代价是无限授权永久有效，宜定期清理（revoke.approvals 类工具的存在意义） |
| 34-37 | 扣减 + 入账 + 事件：与 transfer 同构，只是记账的"发起者"与"出资者"分离 |

LabToken.sol（质押教学用版）与此逐行同构，仅两处不同：构造器只收 `initialSupply`（name/symbol 写死）、内部逻辑拆成 `_transfer/_mint` internal 函数并带 `unchecked` 块（已验证不下溢，省 2 次溢出检查的 gas）。

→ 实录：第 21 章

---

## 专题 03：NFT（LabNFT）

### ① 背景

ERC-721 解决"唯一资产"的归属问题：每枚藏品有全局唯一 tokenId，
确权从"你余额多少"变成"这一枚在谁名下"。元数据（图片、描述）不在链上，
链上只存一个 `tokenURI` 指针（https 链接或 `data:` URI）。

### ② 代码详解

核心存储与 ERC-20 的对照：

```solidity
uint256 public nextTokenId = 1;                 // 自增编号 = 藏品身份
mapping(uint256 => address) private _owners;    // tokenId → 持有人（确权主表）
mapping(address => uint256) public balanceOf;   // 地址 → 持有数量（计数）
mapping(uint256 => string)  private _tokenURIs; // tokenId → 元数据指针
mapping(uint256 => address) public getApproved; // 单枚授权
mapping(address => mapping(address => bool)) public isApprovedForAll; // 全量授权
```

铸造与转手：

```solidity
function mint(address to, string memory uri) public returns (uint256) {
    uint256 id = nextTokenId;
    nextTokenId = id + 1;
    _tokenURIs[id] = uri;
    _owners[id] = to;
    balanceOf[to] += 1;
    emit Transfer(address(0), to, id);  // from=0x0 约定：这是铸造
    return id;
}

function transferFrom(address from, address to, uint256 tokenId) public {
    require(_owners[tokenId] == from, "wrong from");
    require(from == msg.sender || getApproved[tokenId] == msg.sender
            || isApprovedForAll[from][msg.sender], "not allowed"); // 三种合法调用者
    balanceOf[from] -= 1;  balanceOf[to] += 1;
    _owners[tokenId] = to;
    delete getApproved[tokenId];   // 安全细节：换主人，旧授权作废
    emit Transfer(from, to, tokenId);
}
```

要点：

- **两级授权**：`approve` 授权单枚、`setApprovalForAll` 全量授权
  （挂 OpenSea 卖单即后者）；
- **tokenId 以链为准**：前端从铸造回执日志解析
  `topics[0]=Transfer签名 && topics[1]=0x0`，取 `topics[3]`，不依赖本地计数器。

### ③ 部署过程

"首次铸造自动部署"策略（省一次手动操作）：

1. 前端 `ensureNFTContract()` 查 localStorage 有无合约地址，没有则先部署：
   构造参数 `encode(["string","string"], [name, symbol])`，地址存
   `localStorage["lab.nft.contract"]`；
2. 之后每笔铸造 `mint(address,string)` 复用同一合约；
3. 链上确权：逐枚 `eth_call` ownerOf（返回值取后 40 位）+ tokenURI
   （`AbiCoder.decode(["string"], ret)`，注意不剥 0x）。

验证：合约 0xd68947ed…（区块 611），铸造 #1/#2、确权、transferFrom 转手、
再确权持有人变更，浏览器全链路点击通过。

### ④ 逐句精解（LabNFT.sol 完整源码）

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;                                  // 1

contract LabNFT {                                         // 2
    string public name;                                   // 3
    string public symbol;                                 // 4
    uint256 public nextTokenId = 1;                       // 5

    mapping(uint256 => address) private _owners;          // 6
    mapping(address => uint256) public balanceOf;         // 7
    mapping(uint256 => string) private _tokenURIs;        // 8
    mapping(uint256 => address) public getApproved;       // 9
    mapping(address => mapping(address => bool)) public isApprovedForAll; // 10

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId); // 11
    event Approval(address indexed owner, address indexed spender, uint256 indexed tokenId); // 12
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved); // 13

    constructor(string memory _name, string memory _symbol) {  // 14
        name = _name;                                     // 15
        symbol = _symbol;                                 // 16
    }

    function ownerOf(uint256 tokenId) public view returns (address) {  // 17
        address owner = _owners[tokenId];                 // 18
        require(owner != address(0), "NFT: token does not exist");     // 19
        return owner;                                     // 20
    }

    function tokenURI(uint256 tokenId) public view returns (string memory) { // 21
        require(ownerOf(tokenId) != address(0), "NFT: token does not exist"); // 22
        return _tokenURIs[tokenId];                       // 23
    }

    function mint(address to, string memory uri) public returns (uint256) { // 24
        require(to != address(0), "NFT: mint to zero");   // 25
        uint256 id = nextTokenId;                         // 26
        nextTokenId = id + 1;                             // 27
        _tokenURIs[id] = uri;                             // 28
        _owners[id] = to;                                 // 29
        balanceOf[to] += 1;                               // 30
        emit Transfer(address(0), to, id);                // 31
        return id;                                        // 32
    }

    function approve(address to, uint256 tokenId) public {            // 33
        address owner = ownerOf(tokenId);                 // 34
        require(to != owner, "NFT: approval to owner");   // 35
        require(msg.sender == owner || isApprovedForAll[owner][msg.sender], "NFT: not allowed"); // 36
        getApproved[tokenId] = to;                        // 37
        emit Approval(owner, to, tokenId);                // 38
    }

    function setApprovalForAll(address operator, bool approved) public { // 39
        require(operator != msg.sender, "NFT: approve to caller");    // 40
        isApprovedForAll[msg.sender][operator] = approved;            // 41
        emit ApprovalForAll(msg.sender, operator, approved);          // 42
    }

    function transferFrom(address from, address to, uint256 tokenId) public { // 43
        require(ownerOf(tokenId) == from, "NFT: wrong from");         // 44
        require(to != address(0), "NFT: transfer to zero");           // 45
        require(                                                        // 46
            from == msg.sender
                || getApproved[tokenId] == msg.sender
                || isApprovedForAll[from][msg.sender],
            "NFT: not allowed"
        );
        balanceOf[from] -= 1;                             // 47
        balanceOf[to] += 1;                               // 48
        _owners[tokenId] = to;                            // 49
        delete getApproved[tokenId];                      // 50
        emit Transfer(from, to, tokenId);                 // 51
    }
}
```

| # | 解释 |
|---|------|
| 1 | 版本约束同专题 02；同样必须 `evmVersion=london`（坑 1） |
| 2 | 一个合约 = 一个 NFT 系列（Collection），系列内所有藏品共享这份代码和账本 |
| 3-4 | 系列名（如 "Lab 藏品"）；与 ERC-20 不同，藏品本身的"名字图片"不在这里，在 tokenURI 指向的元数据里 |
| 5 | 自增编号，从 1 起——**tokenId 就是藏品的身份证**，全局唯一、永不复用；初始值 1 而非 0：因为本实现用"owner 是零地址"表示不存在，tokenId 0 会歧义 |
| 6 | **确权主表**：tokenId → 持有人。ERC-721 的灵魂——"这一枚在谁名下"，一个 mapping 搞定 |
| 7 | 持有数量表：可由确权表遍历推导，单独存是为了 O(1) 查询（钱包显示"你持有 N 枚"） |
| 8 | 元数据指针：tokenId → URI 字符串。图片描述都在链下（IPFS/HTTP），链上只存指针——改 URI 就是"换画皮"，所以不可改的 URI 才是信任锚点 |
| 9 | 单枚授权：tokenId → 被授权人。**谁都能替我搬**的白名单，一次一枚 |
| 10 | 全量授权：`isApprovedForAll[我][交易所] = true` → 我名下所有藏品它都能搬。挂 OpenSea 卖单的本质操作 |
| 11-13 | 标准事件：三个 tokenId 全部 `indexed`——按藏品号查它的全部流转史，一条 `eth_getLogs` 的事；收款查询页把 `topics[1]≠0x0` 的记为转手、`from=0x0` 的记为铸造 |
| 14-16 | 构造器收系列名，部署那一刻系列诞生 |
| 17-20 | 确权查询：先取 `_owners`，**零地址 = 不存在**（本实现的存在性判据），不存在就 revert 而不是返回零——让调用方无法把"不存在的 NFT"当"属于零地址的 NFT"处理（防御性编程的教科书细节） |
| 21-23 | 元数据查询：先确权（第 22 行顺带完成存在性检查）再返回 URI；钱包据此渲染图片 |
| 24 | 铸造（本教学版任何地址可调用，真实项目会加 onlyOwner/MINT 角色——对照专题 11） |
| 25 | 禁止铸给零地址：铸出去 = 永久销毁（没人有它的私钥） |
| 26-27 | 领号 + 推进计数器：先读后写，`id` 是本枚的编号，下次铸造用新号 |
| 28-29 | 登记元数据 + **确权**——第 29 行是"铸造"的实质：确权表里第一次出现这个 tokenId |
| 30 | 持有人计数 +1 |
| 31 | `from=address(0)` 事件 = 铸造约定，与 ERC-20 一致；前端从回执日志 `topics[3]` 解析出新 tokenId（不依赖本地计数器，坑：以链为准） |
| 33-38 | 单枚授权：① 取当前主人；② 不许授权给主人自己（无意义）；③ 调用者必须是**主人或主人的全量被授权人**；④ 写入授权表 + 发事件。注意：授权不转移所有权，主人仍可随时改授给别人 |
| 39-42 | 全量授权：一个 bool 开关，开 = "你随便搬我的全部"；`operator != msg.sender` 防自己给自己授权（事件语义无意义） |
| 43 | 转手：ERC-721 唯一的所有权变更通道（没有"直接 transfer"，铸造后转手必经此门） |
| 44 | `from` 必须是当前确权人——不许替别人搬家（申报的 from 与链上事实核对） |
| 45 | 转给零地址 = 销毁，本实现禁止（真实项目常有 burn 函数，走的就是这条路） |
| 46 | 三种合法调用者，缺一则 revert：**本人**、这枚的**单枚被授权人**、本人的**全量被授权人**。市场提币、委托交易全部落在这三条之内 |
| 47-49 | 记账三连：原主人 -1、新主人 +1、确权表改主人 |
| 50 | **安全细节**：`delete getApproved[tokenId]` 清空旧授权。若不清：A 授权 B 搬 #1 → A 把 #1 卖给 C → 下次 #1 回到 A 手里时 B 的旧授权还生效——历史授权幽灵。换主人必须作废旧授权 |
| 51 | 发事件：`from` 是旧主人（铸造才是零地址），全链索引器同步更新持有人展示 |

→ 实录：第 22 章

---

## 专题 04：质押（LabStaking）

### ① 背景

"质押赚收益"是 DeFi 留存资金的标配。本实现取 Synthetix
StakingRewards 的简化版——它是绝大多数挖矿合约的数学原型：
**按时间 × 按份额分钱**。

### ② 代码详解

核心数学（全部 1e18 缩放、先乘后除）：

```
rewardPerToken = 累计每 1 wei 质押已分到的奖励
新增 = rewardRate（每秒奖池）× 经过秒数 × 1e18 / totalStaked
个人待领取 = 质押量 × (rewardPerToken − 个人上次结算点) / 1e18
```

```solidity
function rewardPerToken() public view returns (uint256) {
    if (totalStaked == 0) return rewardPerTokenStored;
    uint256 t = block.timestamp;
    if (t > periodFinish) t = periodFinish;   // ① 过期停止累计
    if (t <= lastUpdateTime) return rewardPerTokenStored;
    return rewardPerTokenStored + rewardRate * (t - lastUpdateTime) * 1e18 / totalStaked;
}

/// 灵魂修饰器：任何写操作入口先"把账结算到当前时刻"再执行
modifier updateReward(address account) {
    rewardPerTokenStored = rewardPerToken();
    lastUpdateTime = block.timestamp;
    if (account != address(0)) {
        rewards[account] += stakedOf[account]
            * (rewardPerTokenStored - userRewardPerTokenPaid[account]) / 1e18;
        userRewardPerTokenPaid[account] = rewardPerTokenStored;
    }
    _;
}

function depositReward(uint256 amount) external updateReward(address(0)) {
    rewardRate = amount / DURATION;            // 3600 秒发完一期
    periodFinish = block.timestamp + DURATION;
    IERC20(stakingToken).transferFrom(msg.sender, address(this), amount);
}
```

要点：

- **结算点模式**让账目与区块粒度无关——无论何时查询/操作都精确连续；
  `earned(addr)` 是纯 view，读取即结算、不改状态；
- **本金与收益分离**：`withdraw` 赎本金、`getReward` 领收益；
- 奖励来自金库（管理员注入），`min(now, periodFinish)` 保证发完为止。

### ③ 部署过程

一笔业务 = 多笔链上交易，前端负责串行串联（防同 nonce 顶替，坑 10）：

| 操作 | 交易序列 |
|---|---|
| 部署质押池 | ① 部署 LabStaking(代币地址) → ② approve 金库扣款 → ③ depositReward |
| 质押 | ① approve → ② stake |
| 赎回 | eth_call 读 stakedOf → withdraw(数量) |

池地址存 `localStorage["lab.staking.<代币地址>"]`，每代币一池。
验证：注入 10000（rate=2.7777/秒）、质押 1000、15 秒后 earned=41.6666…
= 份额 × 速率 × 时长，数学精确吻合。

### ④ 逐句精解（LabStaking.sol 完整源码）

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;                                  // 1

interface IERC20 {                                        // 2
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract LabStaking {                                     // 3
    address public admin;                                 // 4
    address public stakingToken;                          // 5
    uint256 public constant DURATION = 3600;              // 6

    uint256 public rewardRate;                            // 7
    uint256 public periodFinish;                          // 8
    uint256 public lastUpdateTime;                        // 9
    uint256 public rewardPerTokenStored;                  // 10
    uint256 public totalStaked;                           // 11

    mapping(address => uint256) public stakedOf;          // 12
    mapping(address => uint256) public rewards;           // 13
    mapping(address => uint256) public userRewardPerTokenPaid; // 14

    event Staked(address indexed user, uint256 amount);   // 15
    event Withdrawn(address indexed user, uint256 amount);// 16
    event RewardPaid(address indexed user, uint256 reward);// 17
    event RewardDeposited(uint256 amount, uint256 finishAt); // 18

    constructor(address _token) {                         // 19
        admin = msg.sender;                               // 20
        stakingToken = _token;                            // 21
    }

    function rewardPerToken() public view returns (uint256) { // 22
        if (totalStaked == 0) return rewardPerTokenStored;    // 23
        uint256 t = block.timestamp;                      // 24
        if (t > periodFinish) t = periodFinish;           // 25
        if (t <= lastUpdateTime) return rewardPerTokenStored; // 26
        return rewardPerTokenStored
            + rewardRate * (t - lastUpdateTime) * 1e18 / totalStaked; // 27
    }

    function earned(address account) public view returns (uint256) { // 28
        return rewards[account]
            + stakedOf[account] * (rewardPerToken() - userRewardPerTokenPaid[account]) / 1e18;
    }

    modifier updateReward(address account) {              // 29
        rewardPerTokenStored = rewardPerToken();          // 30
        lastUpdateTime = block.timestamp;                 // 31
        if (account != address(0)) {                      // 32
            rewards[account] += stakedOf[account]
                * (rewardPerTokenStored - userRewardPerTokenPaid[account]) / 1e18; // 33
            userRewardPerTokenPaid[account] = rewardPerTokenStored; // 34
        }
        _;                                                // 35
    }

    function depositReward(uint256 amount) external updateReward(address(0)) { // 36
        require(msg.sender == admin, "only admin");       // 37
        require(amount >= DURATION, "too small");         // 38
        IERC20(stakingToken).transferFrom(msg.sender, address(this), amount); // 39
        rewardRate = amount / DURATION;                   // 40
        periodFinish = block.timestamp + DURATION;        // 41
        emit RewardDeposited(amount, periodFinish);       // 42
    }

    function stake(uint256 amount) external updateReward(msg.sender) { // 43
        require(amount > 0, "zero amount");               // 44
        totalStaked += amount;                            // 45
        stakedOf[msg.sender] += amount;                   // 46
        IERC20(stakingToken).transferFrom(msg.sender, address(this), amount); // 47
        emit Staked(msg.sender, amount);                  // 48
    }

    function withdraw(uint256 amount) external updateReward(msg.sender) { // 49
        require(stakedOf[msg.sender] >= amount, "not enough staked"); // 50
        totalStaked -= amount;                            // 51
        stakedOf[msg.sender] -= amount;                   // 52
        IERC20(stakingToken).transfer(msg.sender, amount);// 53
        emit Withdrawn(msg.sender, amount);               // 54
    }

    function getReward() external updateReward(msg.sender) { // 55
        uint256 r = rewards[msg.sender];                  // 56
        if (r > 0) {                                      // 57
            rewards[msg.sender] = 0;                      // 58
            IERC20(stakingToken).transfer(msg.sender, r); // 59
            emit RewardPaid(msg.sender, r);               // 60
        }
    }
}
```

| # | 解释 |
|---|------|
| 1 | 版本约束 `^0.8.20`（本合约写作早期，编译时同样必须 `evmVersion=london`，坑 1） |
| 2 | **最小接口声明**：只声明本合约要用的 transfer/transferFrom。`IERC20(地址)` 强转后调用就是"跨合约调用"——ABI 选择器对上即可，编译器不问对方是什么合约；返回值也不轻信（第 47 行 require 包裹） |
| 3 | 质押池合约：每个代币配一个池（前端按代币地址分键存池地址） |
| 4 | 部署者（唯一能注入奖池）。教学版单一 admin，对照专题 11 的角色化拆法 |
| 5 | 被质押的代币（也是奖励代币，教学简化）；普通状态变量（非 immutable——本合约写作时约定不用） |
| 6 | 奖励发放期常量：3600 秒发完一期；`constant` 编译期内联不占存储槽 |
| 7 | 每秒奖励总量（注入奖池时设定 = amount/DURATION），"印币速度"旋钮，单位与代币最小单位一致 |
| 8 | 本期奖池发放截止时刻（时间戳） |
| 9 | 上次把账"结算到"的时刻——rewardPerToken 公式里的时间基准点 |
| 10 | **累计每 1 wei 质押已分到的奖励**（×1e18 缩放）：全合约核心累加器，只增不减 |
| 11 | 全场质押总量：份额公式的分母 |
| 12-14 | 三张个人表：质押中的数量、**已结算未领取**的奖励、**上次结算点**（进入时刻的 rewardPerToken 快照，用于切出"你该得的那一段"） |
| 15-18 | 四个事件：质押/赎回/付奖/注入——资金进出全留痕；user 均 `indexed` 可按地址查全程流水。注意 RewardDeposited 没有 indexed 参数（全场事件，无须按人过滤） |
| 19-21 | 构造器：记部署者为 admin、绑定代币。注意 lastUpdateTime **没有**在构造器初始化（值为 0）——首次 rewardPerToken 会把"从 1970 年至今"按 rate=0 计增量，乘 0 无副作用，设计自洽 |
| 22-27 | **核心数学**：累计每 wei 奖励 = 旧值 + 新增段。新增段 = `每秒奖励 × 经过秒数 × 1e18 ÷ 总质押`——**先乘后除**保精度（先除会截断成 0）；23 总质押为 0 返回旧值（没人质押时奖池的钱不分给任何人，也不许除零 revert）；24-25 时间取 `min(now, periodFinish)`——**奖池发完即停表**；26 本区块内重复调用（时间没走）直接返回旧值 |
| 28 | 个人待领 = 已结算余额 + 未结算段：`质押量 × (全场累计 − 我的结算点) ÷ 1e18`。两个累计量相减切出"你质押期间新增的那一段"再按份额分。**纯 view 读取即结算、不改状态**——页面每秒跳动的"可领收益"就是它 |
| 29-35 | **灵魂修饰器 updateReward**：任何改状态的写入口，先 30 全场账结算到此刻、31 基准点前移；32-34 若指定账户，把他"应得而未结"的奖励落袋（rewards 累加）并更新他的结算点；35 `_;` 才执行原函数体。**退出时结算，所以没有定时任务**——结算点模式优于"每天派发"之处 |
| 32 | `account == address(0)` 约定为"只结算全场、不结算个人"（注入奖池时没有个人仓位变动） |
| 36-42 | 注入奖池：先 updateReward(0) 全场结算、再改参数——顺序反了会把旧 rate 多算一段。37 admin 权限（在修饰器之后，双重防线）；38 金额须 ≥ DURATION 保证每秒至少 1 wei（否则整数除法 rate=0 白注入）；39 **从注入者钱包划走真币**——奖池是真钱，rewardRate 只是分发计划；40-41 速率=金额/3600、截止=此刻+3600（注：本实现续期直接重置 periodFinish，未接旧终点——教学简化，期未结束续期会丢弃剩余速率段） |
| 43-48 | 质押：入口先结算（旧仓位按旧份额拿满这段时间收益），再改仓位、划币入池。**先结算后改仓**：新增质押从此刻起计新账，不抢旧储户的菜 |
| 49-54 | 赎回：同样先结算（质押期间收益一分不少）；50 不许超赎；53 本金原路退回——**本金与收益彻底分离**，赎回不动 rewards 里已落袋的收益 |
| 55-60 | 领收益：先结算 → 读可领余额 → 57 有钱才动作；**58 清零在 59 转账前**（重入防护惯用顺序：先改账再打款，恶意回调重入时 rewards 已是 0） |

数学验证实录：注入 10000（rate=2.7777…/秒）、质押 1000（份额=1）、
15 秒后 `earned = 1000 × (2.7777…×15×1e18/1000) / 1e18 = 41.6666…`，页面显示与手算逐位一致。

→ 实录：第 23 章

---

## 专题 05：DEX 自动做市商（LabAMM）

### ① 背景

AMM 用"恒定乘积"取代订单簿：池子里两边储备的乘积保持不变，
价格由储备比例自动决定，任何人可交易、任何人可提供流动性赚手续费。
本实现是单池（原生 ETH ⇄ 某 ERC-20）的 Uniswap V2 简化版。

### ② 代码详解

报价公式（0.3% 手续费折入金侧，先乘后除保精度）：

```solidity
function getAmountOut(uint256 amountIn, bool ethIn) public view returns (uint256) {
    uint256 inR  = ethIn ? reserveETH : reserveToken;
    uint256 outR = ethIn ? reserveToken : reserveETH;
    require(inR > 0 && outR > 0, "pool empty");
    uint256 inWithFee = amountIn * 997;                       // ×997/1000
    return outR * inWithFee / (inR * 1000 + inWithFee);       // x·y=k 推导结果
}
```

流动性三态：

```solidity
function addLiquidity(uint256 maxToken) external payable {
    if (totalLP == 0) {           // 首注：按给定的 ETH/代币比例建立初始价格
        IERC20(token).transferFrom(msg.sender, address(this), maxToken);
        reserveETH = msg.value;  reserveToken = maxToken;
        totalLP = msg.value;     lpOf[msg.sender] = totalLP;   // LP 基准 = 首注 ETH
    } else {                       // 续注：严格按池内比例配对，maxToken 只当滑点上限
        uint256 needToken = reserveToken * msg.value / reserveETH;
        require(needToken <= maxToken, "slippage / ratio");
        uint256 mintLP = totalLP * msg.value / reserveETH;
        /* …更新储备与记账… */
    }
}
function removeLiquidity(uint256 lp) external {   // 按份额占比分走两边储备
    uint256 ethOut = reserveETH * lp / totalLP;    //   （含别人交的手续费 = LP 的收益）
    /* …扣 LP、转回 ETH+代币… */
}
```

要点：

- **交易量越大滑点越大**，公式自动体现——"AMM 用流动性深度定价"；
- 教学简化：LP 用 mapping 记账（真实 Uniswap 发 LP ERC-20 代币，可转让可再质押）。

### ③ 部署过程

```
部署 LabAMM(代币地址) → approve(池, 代币量) → addLiquidity{value: ETH}(maxToken)
```

三笔交易建池；swap 方向不同流程不同：ETH→代币一笔
（`swapETHForToken` 带 value），代币→ETH 两笔（approve + swap）。
验证：1 ETH + 2000 DFIN 建池；报价 0.1 ETH = 181.322 代币，与手算
2000×99.7/1099.7 完全一致；交易后价格 2000→1653 自动移动，无人挂单。

### ④ 逐句精解（LabAMM.sol 完整源码）

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;                                  // 1

interface IERC20 {                                        // 2
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract LabAMM {                                         // 3
    address public admin;                                 // 4
    address public token;                                 // 5

    uint256 public reserveETH;                            // 6
    uint256 public reserveToken;                          // 7
    uint256 public totalLP;                               // 8
    mapping(address => uint256) public lpOf;              // 9

    uint256 public constant FEE_NUM = 997;                // 10
    uint256 public constant FEE_DEN = 1000;               // 11

    event LiquidityAdded(address indexed provider, uint256 ethIn, uint256 tokenIn, uint256 lpMinted);  // 12
    event LiquidityRemoved(address indexed provider, uint256 ethOut, uint256 tokenOut, uint256 lpBurned); // 13
    event Swap(address indexed trader, bool ethIn, uint256 amountIn, uint256 amountOut); // 14

    constructor(address _token) {                         // 15
        admin = msg.sender;                               // 16
        token = _token;                                   // 17
    }

    function getAmountOut(uint256 amountIn, bool ethIn) public view returns (uint256) { // 18
        require(amountIn > 0, "zero in");                 // 19
        uint256 inR = ethIn ? reserveETH : reserveToken;  // 20
        uint256 outR = ethIn ? reserveToken : reserveETH; // 21
        require(inR > 0 && outR > 0, "pool empty");       // 22
        uint256 inWithFee = amountIn * FEE_NUM;           // 23
        return outR * inWithFee / (inR * FEE_DEN + inWithFee); // 24
    }

    function addLiquidity(uint256 maxToken) external payable { // 25
        require(msg.value > 0, "no ETH");                 // 26
        if (totalLP == 0) {                               // 27
            require(maxToken > 0, "no token");            // 28
            IERC20(token).transferFrom(msg.sender, address(this), maxToken); // 29
            reserveETH = msg.value;                       // 30
            reserveToken = maxToken;                      // 31
            totalLP = msg.value;                          // 32
            lpOf[msg.sender] = totalLP;                   // 33
            emit LiquidityAdded(msg.sender, msg.value, maxToken, totalLP); // 34
        } else {                                          // 35
            uint256 needToken = reserveToken * msg.value / reserveETH; // 36
            require(needToken > 0 && needToken <= maxToken, "slippage / ratio"); // 37
            IERC20(token).transferFrom(msg.sender, address(this), needToken); // 38
            uint256 mintLP = totalLP * msg.value / reserveETH; // 39
            reserveETH += msg.value;                      // 40
            reserveToken += needToken;                    // 41
            totalLP += mintLP;                            // 42
            lpOf[msg.sender] += mintLP;                   // 43
            emit LiquidityAdded(msg.sender, msg.value, needToken, mintLP); // 44
        }
    }

    function removeLiquidity(uint256 lp) external {       // 45
        require(lp > 0 && lpOf[msg.sender] >= lp, "bad lp"); // 46
        uint256 ethOut = reserveETH * lp / totalLP;       // 47
        uint256 tokenOut = reserveToken * lp / totalLP;   // 48
        require(ethOut > 0 && tokenOut > 0, "dust");      // 49
        lpOf[msg.sender] -= lp;                           // 50
        totalLP -= lp;                                    // 51
        reserveETH -= ethOut;                             // 52
        reserveToken -= tokenOut;                         // 53
        IERC20(token).transfer(msg.sender, tokenOut);     // 54
        payable(msg.sender).transfer(ethOut);             // 55
        emit LiquidityRemoved(msg.sender, ethOut, tokenOut, lp); // 56
    }

    function swapETHForToken() external payable {         // 57
        require(msg.value > 0, "no ETH");                 // 58
        uint256 out = getAmountOut(msg.value, true);      // 59
        reserveETH += msg.value;                          // 60
        reserveToken -= out;                              // 61
        IERC20(token).transfer(msg.sender, out);          // 62
        emit Swap(msg.sender, true, msg.value, out);      // 63
    }

    function swapTokenForETH(uint256 amountIn) external { // 64
        require(amountIn > 0, "no token");                // 65
        uint256 out = getAmountOut(amountIn, false);      // 66
        reserveToken += amountIn;                         // 67
        reserveETH -= out;                                // 68
        IERC20(token).transferFrom(msg.sender, address(this), amountIn); // 69
        payable(msg.sender).transfer(out);                // 70
        emit Swap(msg.sender, false, amountIn, out);      // 71
    }

    receive() external payable {}                         // 72
}
```

| # | 解释 |
|---|------|
| 1-2 | 版本约束（同前，须 `evmVersion=london`）+ 最小 ERC-20 接口 |
| 3 | 一个合约 = 一个池（ETH ⇄ 某代币）；想多池就部署多个（每池代码独立） |
| 4 | 部署者（教学版仅作记录，未实际限制任何函数——本池完全无许可，谁都能交易/注资） |
| 5 | 池子另一侧的 ERC-20 地址，构造时定死 |
| 6-7 | **两边储备 x 和 y**：全池的灵魂状态，价格 = y/x 由此推导；交易与注撤资的全部工作就是正确地改这四个数 |
| 8-9 | LP 份额总量 + 每人份额表（教学简化；真实 Uniswap 发 LP ERC-20 代币，可转让可再质押——专题 08 的痛点正源于此简化） |
| 10-11 | 手续费参数：入金按 997/1000 计 = 0.3%；`constant` 内联零 gas 读 |
| 12-14 | 事件：注资/撤资/成交三类，金额与方向全留痕，页面流水与手续费统计靠它 |
| 15-17 | 构造器：只定对手代币——**新池是空池**，没有"创建即有价"的机制 |
| 18-24 | **报价函数**（view，链下也能调，前端实时报价就是它）：19 拒绝空单；20-21 按方向取入/出侧储备；22 空池无价（首注前禁止交易——没流动性就没有价格）；23 入金先折 0.3% 手续费；24 核心公式 `out = outR×inFee/(inR×1000+inFee)`——由 `(inR+inFee/1000)(outR−out)=inR·outR` 解出，**先乘后除**保精度。验算：1 ETH+2000 池，0.1 ETH → 2000×99.7/(1000+99.7)=181.322 |
| 25-34 | **首次注资 = 建池定初价**：26 必须带 ETH（payable）；27 `totalLP==0` 判空池；28-29 按 maxToken 全额收币（首注没有参照系，你说的比例就是市场价——**初始价格由首注者说了算**，这也是"开盘价"的来源）；30-31 建立储备；32-33 LP 基准：首注 ETH 量 = 初始总份额，之后所有人的份额都以此为分母；34 发事件 |
| 35-44 | **续注 = 严格按池内比例配对**：36 `needToken = y×ETH入/x`——你出多少 ETH 就得按现价配多少代币，多给的不会多要；37 maxToken 退化为**滑点上限**（有人在你交易前抢跑改变比例导致需币超上限，整笔 revert——前两轮实测连续 revert 正是这道防线在工作）；38 只收 needToken；39 增发份额 = 总份额×入 ETH/ETH 储备（份额占比守恒）；40-43 更新四元组；44 发事件 |
| 45-56 | **撤资**：46 份额校验；47-48 按占比取回两边储备（注意分子先乘后除）——**分到的含别人交的手续费**，这就是 LP 收益的来源；49 dust 保护（极小份额取回 0 会白烧 LP，拒绝）；50-53 先改账（份额、总量、储备）；54-55 后打款（代币+ETH）——**先改账后转账**的重入安全顺序；56 发事件 |
| 57-63 | **ETH→代币**（一笔搞定）：58 带 ETH 入场；59 按报价成交（滑点容忍由第 24 行公式内生——交易越大价越差，AMM 的自动定价）；60-61 入侧加、出侧减；62 转代币给出金主；63 发事件。**注意先改储备再转币**：转账是外部调用，账必须先落定 |
| 64-71 | **代币→ETH**（需先 approve，两笔交易）：66 报价方向 false；67-68 改储备；69 从交易者钱包划走代币（**先划币再付 ETH**，防白嫖）；70 转 ETH 给出金主 |
| 72 | **receive()**：裸 ETH 接收兜底——55/70 的 `transfer` 打款本身要求合约可被记账？不，transfer 是往外付；此函数接的是"有人直接给池子转 ETH"（如误转、外部捐赠），没有它这些 ETH 进不来；有了它，池子 ETH 余额 ≥ reserveETH 恒成立 |

→ 实录：第 24 章

---

## 专题 06：借贷协议（LabLending）

### ① 背景

链上没有身份和追偿，DeFi 借贷的信用只剩一样东西：**超额抵押**——
"你锁住的资产必须比我借你的多"。配套三件套：持续计息、健康度、
无许可清算（任何人可替坏人还债、拿抵押+奖金，套利者替协议盯风险）。

### ② 代码详解

```
抵押 1 ETH（价 2000）→ 购买力 = 1 × 66%(CF) × 2000 = 1320
健康度 = 购买力 / 债务，跌破 1.0 即可被清算
```

```solidity
/// 债务实时计算，不占存储：本金 × (1 + rate × 经过秒数)
function debtOf(address user) public view returns (uint256) {
    uint256 p = principalOf[user];
    if (p == 0) return 0;
    uint256 dt = block.timestamp - borrowTime[user];
    return p + p * ratePerSecond * dt / 1e18;      // 先乘后除
}

function healthFactor(address user) public view returns (uint256) {
    uint256 debt = debtOf(user);
    if (debt == 0) return type(uint256).max;       // 无债 = ∞
    return ethCollateral[user] * 66 * price / 100 / 1e18 * 1e18 / debt;
}

function liquidate(address user) external {
    uint256 debt = debtOf(user);
    require(healthFactor(user) < 1e18, "healthy");              // 只在资不抵债时触发
    IERC20(token).transferFrom(msg.sender, address(this), debt); // 清算人带钱来还债
    uint256 want = ethCollateral[user] * 108 / 100;             // 抵押 + 8% 奖金
    uint256 seize = want <= address(this).balance ? want : address(this).balance;
    //                                ↑ 奖金封顶到余额（坑 11：奖金必须有来源）
    principalOf[user] = 0; ethCollateral[user] = 0;
    payable(msg.sender).transfer(seize);
}
```

要点：

- **`withdraw` 也要验偿付**：取完剩余抵押仍须覆盖债务，防"提跑留坏账"；
- **价格是生命线**：`setPrice` 是模拟预言机（管理员调价），
  价格被操纵 → 健康度全线失真 → 下一章预言机解决它。

### ③ 部署过程

```
部署 LabLending(代币, 初始价, 利率) → fund(10000)（approve + 注入可借资金）
```

之后用户流程：deposit ETH（带 value）→ borrow → 观察计息 →
repay（2 倍超额授权，利率在跑债务还在涨）→ withdraw 取回抵押。
验证：债务 150 秒从 1000 涨到 2500（=1000×(1+0.01×150) 精确）、
健康度 1.32→0.528 实时下降、0.528 时清算成功、无抵押借款被拒。

### ④ 逐句精解（LabLending.sol 完整源码）

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;                                  // 1

interface IERC20 {                                        // 2
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract LabLending {                                     // 3
    address public admin;                                 // 4
    address public token;                                 // 5

    uint256 public constant CF_NUM = 66;                  // 6
    uint256 public constant CF_DEN = 100;                 // 7
    uint256 public constant BONUS_NUM = 8;                // 8
    uint256 public constant BONUS_DEN = 100;              // 9

    uint256 public price;                                 // 10
    uint256 public ratePerSecond;                         // 11
    uint256 public tokenPool;                             // 12

    mapping(address => uint256) public ethCollateral;     // 13
    mapping(address => uint256) public principalOf;       // 14
    mapping(address => uint256) public borrowTime;        // 15

    event Funded(uint256 amount);                         // 16
    event Deposited(address indexed user, uint256 ethIn); // 17
    event Withdrawn(address indexed user, uint256 ethOut);// 18
    event Borrowed(address indexed user, uint256 amount); // 19
    event Repaid(address indexed user, uint256 paid, uint256 interestPart); // 20
    event Liquidated(address indexed user, address indexed liquidator, uint256 debt, uint256 seizedETH); // 21
    event PriceUpdated(uint256 newPrice);                 // 22

    constructor(address _token, uint256 _price, uint256 _rate) { // 23
        admin = msg.sender;
        token = _token;
        price = _price;
        ratePerSecond = _rate;
    }

    function debtOf(address user) public view returns (uint256) { // 24
        uint256 p = principalOf[user];                    // 25
        if (p == 0) return 0;                             // 26
        uint256 dt = block.timestamp - borrowTime[user];  // 27
        return p + p * ratePerSecond * dt / 1e18;         // 28
    }

    function maxBorrow(address user) public view returns (uint256) { // 29
        uint256 buyingPower = ethCollateral[user] * CF_NUM * price / CF_DEN / 1e18; // 30
        uint256 debt = debtOf(user);                      // 31
        return buyingPower > debt ? buyingPower - debt : 0; // 32
    }

    function healthFactor(address user) public view returns (uint256) { // 33
        uint256 debt = debtOf(user);                      // 34
        if (debt == 0) return type(uint256).max;          // 35
        uint256 buyingPower = ethCollateral[user] * CF_NUM * price / CF_DEN / 1e18; // 36
        return buyingPower * 1e18 / debt;                 // 37
    }

    function fund(uint256 amount) external {              // 38
        require(msg.sender == admin, "only admin");       // 39
        IERC20(token).transferFrom(msg.sender, address(this), amount); // 40
        tokenPool += amount;                              // 41
        emit Funded(amount);                              // 42
    }

    function setPrice(uint256 _price) external {          // 43
        require(msg.sender == admin, "only admin");       // 44
        price = _price;                                   // 45
        emit PriceUpdated(_price);                        // 46
    }

    function deposit() external payable {                 // 47
        require(msg.value > 0, "no ETH");                 // 48
        ethCollateral[msg.sender] += msg.value;           // 49
        emit Deposited(msg.sender, msg.value);            // 50
    }

    function borrow(uint256 amount) external {            // 51
        require(amount > 0, "zero");                      // 52
        require(maxBorrow(msg.sender) >= amount, "under collateral"); // 53
        require(tokenPool >= amount, "pool empty");       // 54
        if (principalOf[msg.sender] == 0) borrowTime[msg.sender] = block.timestamp; // 55
        principalOf[msg.sender] += amount;                // 56
        tokenPool -= amount;                              // 57
        IERC20(token).transfer(msg.sender, amount);       // 58
        emit Borrowed(msg.sender, amount);                // 59
    }

    function repay(uint256 amount) external {             // 60
        uint256 debt = debtOf(msg.sender);                // 61
        require(debt > 0, "nothing to repay");            // 62
        uint256 principal = principalOf[msg.sender];      // 63
        uint256 interest = debt - principal;              // 64
        require(amount >= interest, "pay interest first");// 65
        uint256 paid = amount > debt ? debt : amount;     // 66
        IERC20(token).transferFrom(msg.sender, address(this), paid); // 67
        tokenPool += paid;                                // 68
        if (paid >= debt) {                               // 69
            principalOf[msg.sender] = 0;                  // 70
        } else {                                          // 71
            principalOf[msg.sender] = principal - (paid - interest); // 72
            borrowTime[msg.sender] = block.timestamp;     // 73
        }
        emit Repaid(msg.sender, paid, interest);          // 74
    }

    function withdraw(uint256 amount) external {          // 75
        require(ethCollateral[msg.sender] >= amount, "not enough collateral"); // 76
        ethCollateral[msg.sender] -= amount;              // 77
        uint256 debt = debtOf(msg.sender);                // 78
        uint256 buyingPower = ethCollateral[msg.sender] * CF_NUM * price / CF_DEN / 1e18; // 79
        require(buyingPower >= debt, "would under-collateralize"); // 80
        payable(msg.sender).transfer(amount);             // 81
        emit Withdrawn(msg.sender, amount);               // 82
    }

    function liquidate(address user) external {           // 83
        uint256 debt = debtOf(user);                      // 84
        require(debt > 0, "no debt");                     // 85
        require(healthFactor(user) < 1e18, "healthy");    // 86
        IERC20(token).transferFrom(msg.sender, address(this), debt); // 87
        tokenPool += debt;                                // 88
        uint256 want = ethCollateral[user] + ethCollateral[user] * BONUS_NUM / BONUS_DEN; // 89
        uint256 seize = want <= address(this).balance ? want : address(this).balance; // 90
        require(seize >= ethCollateral[user], "insolvent"); // 91
        principalOf[user] = 0;                            // 92
        ethCollateral[user] = 0;                          // 93
        payable(msg.sender).transfer(seize);              // 94
        emit Liquidated(user, msg.sender, debt, seize);   // 95
    }

    receive() external payable {}                         // 96
}
```

| # | 解释 |
|---|------|
| 1-2 | 版本约束（同前，须 `evmVersion=london`）+ 最小 ERC-20 接口 |
| 3 | 单资产市场：抵押 ETH、借出某 ERC-20（多市场=多部署） |
| 4-5 | 管理员（注入资金、调价）；借出资产地址 |
| 6-7 | **抵押系数 CF=66%**：1 ETH 抵押只给你 0.66 ETH 购买力——34% 缓冲是价格波动与利息追赶的安全垫；分数表示避开小数 |
| 8-9 | **清算奖金 8%**：给清算人的套利空间，"坏人的抵押"溢价出售，重赏之下必有盯盘者 |
| 10 | **模拟预言机价格**（1 ETH = ? token，1e18 缩放）——全协议命脉；setPrice 调价即改写所有人健康度，这正是下一章预言机存在的原因 |
| 11 | 每秒利率（1e18 缩放）：教学用 0.01e18（每秒 1%，150 秒利息肉眼可见）；真实协议约 1e-13/秒（年化个位数%） |
| 12 | 可借资金池：协议里躺着的代币总量，borrow 扣、repay/liquidate 回 |
| 13-15 | 三张个人账本：ETH 抵押量、**借款本金**（利息不入账，见 28）、最近一次计息起点 |
| 16-22 | 七个事件：注资/存押/取押/借出/还款/清算/调价——每笔资金与参数变动留痕；Liquidated 双 indexed（被清算人+清算人双向可查） |
| 23 | 构造器：定死对手代币 + 初始价格 + 利率（教学版三个旋钮开局设定） |
| 24-28 | **债务实时计算**（view，不占存储）：25-26 无本金即无债；27 经过秒数；28 `本金 + 本金×秒率×秒数`——**先乘后除**（先除会把小数率截成 0），利息永不落账、随取随算，省掉每秒记账的 gas |
| 29-32 | 最大可借 = 购买力 − 现有债务；30 购买力 = 抵押×66×价格/100/1e18（连乘后方除，精度损失最小）；32 已超借则返回 0（三元保护，防下溢 revert） |
| 33-37 | **健康度**：35 无债=∞（type(uint256).max，绝不可能<1）；37 购买力/债务×1e18——**<1e18 即可清算**，前端每秒重算画进度条 |
| 38-42 | 注入可借资金：admin 划转入账，协议不放空 |
| 43-46 | 模拟预言机调价：admin 一键改价（真实协议此函数属于 Chainlink），配合"刷新价格"卡片演示健康度随价崩落 |
| 47-50 | 存抵押：带 ETH 入场即抵押，无许可 |
| 51-59 | **借款三重门**：53 超额抵押（maxBorrow 够）、54 池子有钱；55 **只在首借时记息起点**（加借不重置起点，否则老利息被"洗"掉）；56-58 记账→扣池→转币 |
| 60-74 | **还款顺序**：64 拆出利息部分；65 **利息必须一次付清**（部分还款不许"先还本金减计息基数"）；66 多还截断到债务额；67-68 划币回池；69-70 还清销账；71-73 部分还：本金扣减"超过利息的部分"，**73 息点重置为此刻**——剩余本金从今日起重新计息（已计利息已付清） |
| 75-82 | **取回抵押也要验偿付**：76 抵押够取；77 先扣账；79-80 **取完剩余抵押仍须覆盖债务**——没有这道检查，"提跑留坏账"只需一笔交易；81 后打款 |
| 83-95 | **无许可清算**：85-86 有债且不健康才触发——**任何人**都可替坏人还债；87-88 清算人带钱来还全部债务（debtOf 现算，精确到秒）；89 目标=全部抵押+8%；90 **奖金封顶到合约 ETH 余额**（坑 11：奖金必须有来源，真实协议由保险基金承担）；91 余额至少覆盖抵押本金才准清算；92-93 清账（本、押全归零）；94 打款给清算人——**套利完成，协议全身而退** |
| 96 | receive()：兜住直接转进协议的 ETH（90 行 `address(this).balance` 依赖它收得住钱） |

→ 实录：第 25 章

---

## 专题 07：预言机（LabOracle）

### ① 背景

EVM 是确定性状态机，合约**不能自己发 HTTP 请求**查行情——
价格必须由链下"喂"进链上。单一数据源不可信（宕机=协议瞎、
作恶报 99999=借贷协议被铸造无抵押资产，这是 DeFi 史上最大事故类型），
解法：多数据源 + 中位数聚合 + 轮次历史（Chainlink 思路极简复刻）。

### ② 代码详解

三段式：**白名单报价 → 中位数 → 轮次**。

```solidity
// ① 白名单：只有注册过的 reporter 能报价
mapping(address => bool) public isReporter;
address[] public reporters;      // mapping 不能遍历，另存数组方便枚举

// ② 中位数：排序取中间（偶数取中间两数平均）
function pendingMedian() public view returns (uint256 median, uint256 count) {
    /* 收集全部有效报价 → 插入排序 */
    if (n % 2 == 1) return (ps[n / 2], n);
    return ((ps[n / 2 - 1] + ps[n / 2]) / 2, n);
}
// 中位数 vs 平均值的杀手锏——抗离群值：
//   [2000, 2002, 99999] → 平均 34667（协议被毒化），中位数 2002（安然无恙）
// 操纵中位数需要控制过半数据源。

// ③ 报价即触发聚合，报价数不足门槛不形成新轮次
function report(uint256 price) external {
    require(isReporter[msg.sender], "only reporter");
    priceOf[msg.sender] = price;  hasReported[msg.sender] = true;
    _aggregate();
}
function _aggregate() internal {
    (uint256 med, uint256 n) = pendingMedian();
    if (n < minReports) return;               // 门槛防少数人操纵
    roundId += 1;
    latestAnswer = med;                        // 消费方只读这个
    rounds[roundId] = Round(med, block.timestamp, n);  // 不可变历史轮次
}
```

要点：

- **轮次（round）**：每次聚合是历史的一个不可变版本，可查"放款那一刻的价"；
- **新鲜度**：`latestTimestamp` 太久没更新就该拒用（staleness 检测）；
- 与真实 Chainlink 差距：OCR 链下聚合、质押罚没、偏差阈值+心跳触发。

### ③ 部署过程

```
部署 LabOracle(初始价 2000e18, minReports=2)
→ 前端"一键准备数据源"4 笔交易：给 3 个随机账户各转 0.02 ETH（gas）
  → addReporters([A,B,C]) 批量注册
→ 场景报价：每场景 3 笔串行 report（sendSigned 泛化 signer 参数，一页多私钥）
→ 最后一张卡片把 latestAnswer 调 setPrice 同步给借贷市场（组合闭环）
```

验证：攻击场景报价 [2000, 2002, **99999**] 聚合价 **2002**，恶意报价被过滤；
curl 直查 latestAnswer=2100e18、roundId=8 与页面一致。

### ④ 逐句精解（LabOracle.sol 完整源码）

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;                                  // 1

contract LabOracle {                                      // 2
    address public admin;                                 // 3
    uint256 public constant DECIMALS = 18;                // 4

    mapping(address => bool) public isReporter;           // 5
    address[] public reporters;                           // 6
    uint256 public minReports;                            // 7

    mapping(address => uint256) public priceOf;           // 8
    mapping(address => bool) public hasReported;          // 9

    uint256 public latestAnswer;                          // 10
    uint256 public latestTimestamp;                       // 11
    uint256 public roundId;                               // 12

    struct Round {                                        // 13
        uint256 answer;
        uint256 timestamp;
        uint256 count;
    }
    mapping(uint256 => Round) public rounds;              // 14

    event ReporterAdded(address indexed reporter);        // 15
    event ReporterRemoved(address indexed reporter);      // 16
    event PriceReported(address indexed reporter, uint256 price); // 17
    event RoundUpdated(uint256 indexed roundId, uint256 median, uint256 count); // 18

    modifier onlyAdmin() {                                // 19
        require(msg.sender == admin, "only admin");
        _;
    }

    constructor(uint256 initialPrice, uint256 _minReports) { // 20
        require(initialPrice > 0, "zero price");          // 21
        require(_minReports > 0, "minReports zero");      // 22
        admin = msg.sender;
        minReports = _minReports;
        latestAnswer = initialPrice;                      // 23
        latestTimestamp = block.timestamp;                // 24
        rounds[0] = Round(initialPrice, block.timestamp, 0); // 25
    }

    function addReporter(address r) external onlyAdmin {  // 26
        require(r != address(0), "zero address");         // 27
        require(!isReporter[r], "already reporter");      // 28
        isReporter[r] = true;                             // 29
        reporters.push(r);                                // 30
        emit ReporterAdded(r);                            // 31
    }

    function addReporters(address[] calldata rs) external onlyAdmin { // 32
        for (uint256 i = 0; i < rs.length; i++) {         // 33
            require(rs[i] != address(0), "zero address");
            require(!isReporter[rs[i]], "already reporter");
            isReporter[rs[i]] = true;
            reporters.push(rs[i]);
            emit ReporterAdded(rs[i]);
        }
    }

    function removeReporter(address r) external onlyAdmin { // 34
        require(isReporter[r], "not reporter");           // 35
        isReporter[r] = false;                            // 36
        for (uint256 i = 0; i < reporters.length; i++) {  // 37
            if (reporters[i] == r) {
                reporters[i] = reporters[reporters.length - 1]; // 38
                reporters.pop();                          // 39
                break;
            }
        }
        delete priceOf[r];                                // 40
        delete hasReported[r];                            // 41
        emit ReporterRemoved(r);                          // 42
    }

    function reporterCount() external view returns (uint256) { // 43
        return reporters.length;
    }

    function report(uint256 price) external {             // 44
        require(isReporter[msg.sender], "only reporter"); // 45
        require(price > 0, "zero price");                 // 46
        priceOf[msg.sender] = price;                      // 47
        hasReported[msg.sender] = true;                   // 48
        emit PriceReported(msg.sender, price);            // 49
        _aggregate();                                     // 50
    }

    function pendingMedian() public view returns (uint256 median, uint256 count) { // 51
        uint256[] memory ps = new uint256[](reporters.length); // 52
        uint256 n;                                        // 53
        for (uint256 i = 0; i < reporters.length; i++) {  // 54
            if (hasReported[reporters[i]]) {
                ps[n] = priceOf[reporters[i]];
                n++;
            }
        }
        require(n > 0, "no reports");                     // 55
        for (uint256 i = 1; i < n; i++) {                 // 56
            uint256 key = ps[i];
            uint256 j = i;
            while (j > 0 && ps[j - 1] > key) {            // 57
                ps[j] = ps[j - 1];
                j--;
            }
            ps[j] = key;
        }
        if (n % 2 == 1) return (ps[n / 2], n);            // 58
        return ((ps[n / 2 - 1] + ps[n / 2]) / 2, n);      // 59
    }

    function _aggregate() internal {                      // 60
        (uint256 med, uint256 n) = pendingMedian();       // 61
        if (n < minReports) return;                       // 62
        roundId += 1;                                     // 63
        latestAnswer = med;                               // 64
        latestTimestamp = block.timestamp;                // 65
        rounds[roundId] = Round(med, block.timestamp, n); // 66
        emit RoundUpdated(roundId, med, n);               // 67
    }

    function refresh() external {                         // 68
        (uint256 med, uint256 n) = pendingMedian();       // 69
        require(n >= minReports, "not enough reports");   // 70
        roundId += 1;                                     // 71
        latestAnswer = med;                               // 72
        latestTimestamp = block.timestamp;                // 73
        rounds[roundId] = Round(med, block.timestamp, n); // 74
        emit RoundUpdated(roundId, med, n);               // 75
    }
}
```

| # | 解释 |
|---|------|
| 1-2 | 版本约束（同前，须 `evmVersion=london`）；无接口——本合约是数据终点，不依赖任何外部合约（所以能被所有人依赖） |
| 3-4 | 管理员（管白名单）；精度常量 18——与消费方约定的缩放口径，Chainlink 同有此字段 |
| 5 | **数据源白名单**：只有注册过的 reporter 能报价——聚合的第一道防线（权限），第二道才是中位数（数学） |
| 6 | 数据源列表：mapping 不可遍历，另存数组专供 pendingMedian 收集报价用。**双轨存储**（mapping 判存在 + array 供遍历）是链上集合的惯用模式 |
| 7 | 聚合门槛：有效报价数不足 minReports 不出新轮次——少数人无法操纵价格 |
| 8-9 | 各源最新报价 + **是否报过价标记**：为什么需要第 9 行？因为 priceOf 默认值是 0，无法区分"报了 0"和"从没报过"（第 46 行禁报 0 后仍留此标记做语义清晰）——链上"缺省值歧义"的经典处理 |
| 10-12 | 消费三件套：最新聚合价（**借贷协议只读这一个**）、聚合时间戳（staleness 检测：太久没更新就该拒用）、当前轮次号 |
| 13-14 | **轮次记录**：每轮存 答案/时间/参与数；mapping(roundId→Round) 是**不可变历史**——可查"放款那一刻的价"，审计与争议回溯的基础设施 |
| 15-18 | 事件：增删数据源/报价/新轮次；RoundUpdated 的 roundId indexed 便于按轮订阅 |
| 19 | 管理员修饰器 |
| 20-25 | 构造器：21-22 参数非零校验；23-24 创世价直接写入 latest——**部署即有价可用**，借贷协议不会面对零价；25 第 0 轮 = 创世价（count=0 标记非聚合而来） |
| 26-31 | 加数据源：27-28 拒零地址、拒重复；29-30 双轨同写（mapping + array 必须成对维护，漏一个后面就出幽灵）；31 发事件 |
| 32 | 批量版：`address[] calldata`——calldata 直读外部参数不进内存，省 gas；一次拉起 3 个数据源只用一笔交易（前端"一键准备数据源"） |
| 34-42 | 移除数据源：36 先关权限；37-39 **交换到末尾再 pop**——数组删除的 O(1) 惯用法（顺序无关紧要，何必搬移整段）；40-41 delete 清其历史报价（防重加入时旧价复活） |
| 43 | 计数 view：前端展示"当前 N 个数据源" |
| 44-50 | **报价入口**：45 白名单（非 reporter 报价直接 revert——攻击者无法灌价）；46 禁 0 价；47-48 记录；50 **报价即触发聚合**——每个数据源报完都尝试刷新，无须定时任务 |
| 51-59 | **中位数聚合**（view，纯读）：52-54 收集全部有效报价到内存数组（memory 数组：本次调用用完即弃，不占链上存储）；55 一个都没有则报错；56-57 **插入排序**——数据源个位数，朴素算法足够，gas 可预算；58 奇数取正中；59 偶数取中间两数平均。**杀手锏**：[2000,2002,99999] 中位数=2002，恶意报价被数学过滤；操纵中位数需控制过半数据源 |
| 60-67 | 内部聚合：62 **不足门槛直接 return**（不 revert——报价本身是合法动作，只是还没资格成轮）；63-66 轮次 +1、写 latest 三件套、存历史轮；67 发事件 |
| 68-75 | 手动刷新：数据源变动/补报后**任何人**可触发再聚合（无许可维护）；与 _aggregate 的区别只在 70 不足门槛直接 revert（显式刷新要给人反馈）。真实 Chainlink 的触发条件是"偏差超阈值或心跳到期"（heartbeat+deviation），思路一致 |

→ 实录：第 26 章

---

## 专题 08：DeFi 乐高地基（LabLego）

### ① 背景

前七个模块各玩各的。本章第一次把 **AMM + 预言机 + 借贷** 咬合在同一笔
业务里：LP 份额抵押进金库、经预言机估值、按借贷模型借出代币、可被折扣清算。
出发点是一个现实矛盾：教学版 LabAMM 的 LP 只是内部 mapping，**不能转账**，
怎么办？

### ② 代码详解

**答案：不动旧合约，外面套一层金库/适配层**（WETH、Yearn 同款思路）：
用户把 ETH+代币交给金库，金库替用户去 AMM 注入，LP 记金库名下，
金库内 `lpCollateral[user]` 分户记账。

授权链条最容易绕错，顺序是 **用户 → 金库 → 授权 AMM → AMM 从金库拉走**：

```solidity
function stakeLiquidity(uint256 maxToken) external payable {
    uint256 needToken = totalLP == 0 ? maxToken                     // 首注定价
                    : IAMM(amm).reserveToken() * msg.value / IAMM(amm).reserveETH();
    IERC20(token).transferFrom(msg.sender, address(this), needToken); // 用户→金库
    IERC20(token).approve(amm, needToken);                            // 金库→授权池
    uint256 lpBefore = IAMM(amm).lpOf(address(this));
    IAMM(amm).addLiquidity{value: msg.value}(needToken);              // 池从金库扣款
    lpCollateral[msg.sender] += IAMM(amm).lpOf(address(this)) - lpBefore; // 记账
}
```

**LP 估值：拆两股，一股问预言机**：

```solidity
ethPart = reserveETH * lp / totalLP;
tokPart = reserveToken * lp / totalLP;
valueToken = ethPart * price / 1e18 + tokPart;   // price 来自 LabOracle
```

借贷模型沿用专题 06，仅两处升级：
CF 从 66% 降到 **50%**（LP 有无常损失，真实 Aave 对 LP 类资产同样降档）；
清算改用**折扣购买**——清算人还全部债务，按 LP 单价 8 折"买"走等值 LP，
奖金来自抵押品折扣本身，**协议一分钱不用备**（对照专题 06 踩坑 11）。

### ③ 部署过程

```
前置：LabAMM 池、LabOracle 已就绪（各取地址）
部署 LabLego(代币, AMM 地址, 预言机地址, 利率) → approve → fund(10000)
用户流程（一键准备借款人 5 笔串行）：转 0.15 ETH（0.1 本金+0.05 gas）
  → 转 220 代币 → approve → stakeLiquidity → borrow
```

验证（区块 1169 起）：质押 0.1 ETH+210 代币 → 估值 420（0.1×2100+210）、
maxBorrow=210；清算演练：借 129 后 HF 从 1.667 每秒下降，150 秒后 0.667
触发清算，seizeLP=0.081（322.5×1.08/4300 精确），链上对账
tokenPool=10343.5=10000−50+200−129+322.5 分毫不差。

### ④ 逐句精解（LabLego.sol 完整源码——三个接口的"胶水合约"）

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;                                  // 1

interface IERC20 {                                        // 2
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IAMM {                                          // 3
    function addLiquidity(uint256 maxToken) external payable;
    function removeLiquidity(uint256 lp) external;
    function reserveETH() external view returns (uint256);
    function reserveToken() external view returns (uint256);
    function totalLP() external view returns (uint256);
    function lpOf(address who) external view returns (uint256);
}

interface IOracle {                                       // 4
    function latestAnswer() external view returns (uint256);
}

contract LabLego {                                        // 5
    address public admin;                                 // 6
    address public token;                                 // 7
    address public amm;                                   // 8
    address public oracle;                                // 9

    uint256 public constant CF_NUM = 50;                  // 10
    uint256 public constant CF_DEN = 100;                 // 11
    uint256 public constant BONUS_NUM = 8;                // 12
    uint256 public constant BONUS_DEN = 100;              // 13

    uint256 public ratePerSecond;                         // 14
    uint256 public tokenPool;                             // 15

    mapping(address => uint256) public lpCollateral;      // 16
    mapping(address => uint256) public principalOf;       // 17
    mapping(address => uint256) public borrowTime;        // 18

    event Funded(uint256 amount);                         // 19
    event Staked(address indexed user, uint256 ethIn, uint256 tokenIn, uint256 lpGot); // 20
    event Unstaked(address indexed user, uint256 lpBurned);// 21
    event Borrowed(address indexed user, uint256 amount); // 22
    event Repaid(address indexed user, uint256 paid);     // 23
    event Liquidated(address indexed user, address indexed liquidator, uint256 debt, uint256 lpSeized); // 24

    constructor(address _token, address _amm, address _oracle, uint256 _rate) { // 25
        admin = msg.sender;
        token = _token;
        amm = _amm;
        oracle = _oracle;
        ratePerSecond = _rate;
    }

    function lpValue(address user) public view returns (uint256 ethPart, uint256 tokPart, uint256 valueToken) { // 26
        uint256 lp = lpCollateral[user];                  // 27
        uint256 total = IAMM(amm).totalLP();              // 28
        if (lp == 0 || total == 0) return (0, 0, 0);      // 29
        uint256 rEth = IAMM(amm).reserveETH();            // 30
        uint256 rTok = IAMM(amm).reserveToken();          // 31
        ethPart = rEth * lp / total;                      // 32
        tokPart = rTok * lp / total;                      // 33
        uint256 price = IOracle(oracle).latestAnswer();   // 34
        valueToken = ethPart * price / 1e18 + tokPart;    // 35
    }

    function lpPrice() public view returns (uint256) {    // 36
        uint256 total = IAMM(amm).totalLP();              // 37
        if (total == 0) return 0;                         // 38
        uint256 price = IOracle(oracle).latestAnswer();   // 39
        uint256 allEth = IAMM(amm).reserveETH() * price / 1e18; // 40
        return (allEth + IAMM(amm).reserveToken()) * 1e18 / total; // 41
    }

    function debtOf(address user) public view returns (uint256) { // 42
        uint256 p = principalOf[user];
        if (p == 0) return 0;
        uint256 dt = block.timestamp - borrowTime[user];
        return p + p * ratePerSecond * dt / 1e18;
    }

    function maxBorrow(address user) public view returns (uint256) { // 43
        (, , uint256 v) = lpValue(user);                  // 44
        uint256 power = v * CF_NUM / CF_DEN;              // 45
        uint256 debt = debtOf(user);
        return power > debt ? power - debt : 0;
    }

    function healthFactor(address user) public view returns (uint256) { // 46
        uint256 debt = debtOf(user);
        if (debt == 0) return type(uint256).max;
        (, , uint256 v) = lpValue(user);
        uint256 power = v * CF_NUM / CF_DEN;
        return power * 1e18 / debt;
    }

    function fund(uint256 amount) external {              // 47
        require(msg.sender == admin, "only admin");
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        tokenPool += amount;
        emit Funded(amount);
    }

    function stakeLiquidity(uint256 maxToken) external payable { // 48
        require(msg.value > 0, "no ETH");                 // 49
        require(maxToken > 0, "no token");                // 50
        uint256 needToken;                                // 51
        if (IAMM(amm).totalLP() == 0) {                   // 52
            needToken = maxToken;                         // 53
        } else {                                          // 54
            needToken = IAMM(amm).reserveToken() * msg.value / IAMM(amm).reserveETH(); // 55
            require(needToken > 0 && needToken <= maxToken, "slippage / ratio"); // 56
        }
        IERC20(token).transferFrom(msg.sender, address(this), needToken); // 57
        IERC20(token).approve(amm, needToken);            // 58
        uint256 lpBefore = IAMM(amm).lpOf(address(this)); // 59
        IAMM(amm).addLiquidity{value: msg.value}(needToken); // 60
        uint256 got = IAMM(amm).lpOf(address(this)) - lpBefore; // 61
        require(got > 0, "no LP minted");                 // 62
        lpCollateral[msg.sender] += got;                  // 63
        emit Staked(msg.sender, msg.value, needToken, got); // 64
    }

    function unstake(uint256 lp) external {               // 65
        require(lp > 0 && lpCollateral[msg.sender] >= lp, "bad lp"); // 66
        lpCollateral[msg.sender] -= lp;                   // 67
        uint256 debt = debtOf(msg.sender);                // 68
        (, , uint256 v) = lpValue(msg.sender);            // 69
        require(v * CF_NUM / CF_DEN >= debt, "would under-collateralize"); // 70
        uint256 tokBefore = _tokenBalance();              // 71
        IAMM(amm).removeLiquidity(lp);                    // 72
        uint256 gotToken = _tokenBalance() - tokBefore;   // 73
        if (gotToken > 0) IERC20(token).transfer(msg.sender, gotToken); // 74
        uint256 gotEth = address(this).balance;           // 75
        if (gotEth > 0) payable(msg.sender).transfer(gotEth); // 76
        emit Unstaked(msg.sender, lp);                    // 77
    }

    function borrow(uint256 amount) external {            // 78
        require(amount > 0, "zero");
        require(maxBorrow(msg.sender) >= amount, "under collateral");
        require(tokenPool >= amount, "pool empty");
        if (principalOf[msg.sender] == 0) borrowTime[msg.sender] = block.timestamp;
        principalOf[msg.sender] += amount;
        tokenPool -= amount;
        IERC20(token).transfer(msg.sender, amount);
        emit Borrowed(msg.sender, amount);
    }

    function repay(uint256 amount) external {             // 79
        uint256 debt = debtOf(msg.sender);
        require(debt > 0, "nothing to repay");
        uint256 paid = amount > debt ? debt : amount;
        IERC20(token).transferFrom(msg.sender, address(this), paid);
        tokenPool += paid;
        uint256 principal = principalOf[msg.sender];
        uint256 interest = debt - principal;
        if (paid >= debt) {
            principalOf[msg.sender] = 0;
        } else {
            principalOf[msg.sender] = principal - (paid - interest);
            borrowTime[msg.sender] = block.timestamp;
        }
        emit Repaid(msg.sender, paid);
    }

    function liquidate(address user) external {           // 80
        uint256 debt = debtOf(user);                      // 81
        require(debt > 0, "no debt");                     // 82
        require(healthFactor(user) < 1e18, "healthy");    // 83
        uint256 price = lpPrice();                        // 84
        require(price > 0, "no price");                   // 85
        uint256 wantLP = debt * (BONUS_DEN + BONUS_NUM) * 1e18 / BONUS_DEN / price; // 86
        uint256 coll = lpCollateral[user];                // 87
        require(wantLP <= coll, "insolvent");             // 88
        IERC20(token).transferFrom(msg.sender, address(this), debt); // 89
        tokenPool += debt;                                // 90
        principalOf[user] = 0;                            // 91
        lpCollateral[user] = coll - wantLP;               // 92
        lpCollateral[msg.sender] += wantLP;               // 93
        emit Liquidated(user, msg.sender, debt, wantLP);  // 94
    }

    function _tokenBalance() internal view returns (uint256) { // 95
        (bool ok, bytes memory data) = token.staticcall(
            abi.encodeWithSignature("balanceOf(address)", address(this))
        );
        require(ok, "balanceOf failed");
        return abi.decode(data, (uint256));
    }

    receive() external payable {}                         // 96
}
```

| # | 解释 |
|---|------|
| 1 | 版本约束（同前，须 `evmVersion=london`） |
| 2-4 | **三个接口 = 本合约的三条依赖边**：IERC20（资金划转）、IAMM（流动性操作，6 个函数正是 LabAMM 的公开面）、IOracle（latestAnswer 一个函数就够）。接口即"我对世界的假设"——只要对面实现这些选择器，跨合约调用就成立，编译器不问对方是谁 |
| 5 | 金库/适配层：不改 LabAMM 一行代码，让"不可转让的 LP"变成可抵押资产（WETH/Yearn 同款思路） |
| 6-9 | 四个关键地址：管理员、借出资产（=池的代币侧）、AMM 池、预言机——**构造时注入依赖**（对照 LabLending 写死 price：这里价格永远实时来自预言机） |
| 10-11 | **CF=50%**（低于纯 ETH 的 66%）：LP 自带无常损失，抵押品本身在缩水，抵押率必须降档——真实 Aave 对 LP 类资产的 LTV 同样更低 |
| 12-13 | 清算折扣 8%：清算人按 8 折"买"LP，奖金来自折扣本身 |
| 14-15 | 每秒利率 + 可借资金池（与 LabLending 同构） |
| 16-18 | 三张个人账本：**LP 份额分户表**（本合约的核心创造——AMM 只知道"合约持有多少 LP"，谁出的钱由这张表记）、借款本金、计息起点 |
| 19-24 | 六个事件：注资/入池/退池/借款/还款/清算——每次仓位与资金变动留痕 |
| 25 | 构造器注入四依赖 + 利率——**部署顺序有要求**：AMM 池、预言机必须先存在 |
| 26-35 | **LP 估值三段式**（view）：27-29 无仓/空池返回全 0；30-33 拆两股——你的 LP 占池子比例 × 两边储备 = 你名下的 ETH 股和代币股；34 **问预言机**拿 ETH 价（跨合约 view 调用，gas 便宜，链下 eth_call 免费）；35 折代币计价：`ETH股×价 + 代币股`。验算：0.1ETH+210 入池、价 2100 → 420 |
| 36-41 | 单位 LP 价格（清算折算用）：全场估值 ÷ 总 LP 份额；先乘 1e18 后除保精度 |
| 42 | 债务实时计算——与 LabLending 逐字同构（代码复用示范） |
| 43-45 | 购买力 = LP 估值 × 50%；44 元组解构语法 `(, , v)`——只取第三个返回值，前两个留空 |
| 46 | 健康度——同构，仅把"抵押购买力"换成 LP 版 |
| 47 | fund：admin 灌可借资金 |
| 48-64 | **质押流动性（本章最绕的授权链）**：49-56 先算 needToken（首注定价/续注按比例+滑点上限）；57 **用户→本合约**划币；58 **本合约→授权 AMM**——AMM 的 transferFrom 认的是它的调用者（本合约），所以授权必须由本合约发出；59-61 **差额法**取实际增发 LP（addLiquidity 不返回数量，前后各查一次 lpOf 相减——跨合约读差值的实用技巧）；62 防零；63 分户记账入账。整条链：**用户→金库→授权池→池从金库拉走**，顺序错一环全盘 revert |
| 65-77 | **退池**：66-67 先扣户头；68-70 **取完剩余购买力仍须覆盖债务**（LabLending 第 80 行同款的偿付检查）；71-73 差额法数到账代币（71 前余额、72 触发 AMM 退款、73 差值即本次所得——教学单池不留存 ETH，余额法干净）；74-76 代币+ETH 原样转给用户 |
| 78 | borrow：三重门同构（超额抵押/池有钱/首借记息点） |
| 79 | repay：与 LabLending 同构，略去"利息必须一次付清"分支——部分还款同样重息点 |
| 80-94 | **折扣购买清算（对照 LabLending 的奖金封顶，坑 11 的正解）**：82-83 有债不健康；84-85 取 LP 单价；86 **应拿 LP = 债务×1.08÷LP 单价**——清算人还 1 块债、拿 1.08 块的 LP，奖金=折扣，**协议一分钱不用备**（LP 本身就是资产组合，不像 LabLending 的 ETH 奖金要有余额）；87-88 折扣价超过全部抵押=协议穿仓，禁止；89-90 清算人还全部债务；91-93 销债 + **LP 分户表直接划转**（被清算人减、清算人加——本合约内记账即可完成"交割"，无须碰 AMM；清算人日后自行 unstake 变现）；94 发事件 |
| 95-96 | 内部余额查询（`staticcall + abi.encodeWithSignature` 手搓 balanceOf——不依赖接口声明的兜底写法）+ receive() 兜 ETH |

→ 实录：第 27 章

---

## 专题 09：链上治理四件套（VoteToken / Governor / Timelock / Box）

### ① 背景

协议参数（利率、CF、清算奖金）此前都由部署者一把抓。管的钱一多，
"谁说了算"必须回答。治理把三件事写成合约：**谁能提案、怎么计票、
什么时候生效**。本模块四合约复现 Compound 经典三件套 + 一个演示资产。

### ② 代码详解

**① LabVoteToken：投票权 ≠ 持币**。核心是 Compound 式检查点快照：

```solidity
struct Checkpoint { uint256 fromBlock; uint256 votes; }
mapping(address => address) public delegates;      // 0=未委托，票在自己头上
mapping(address => Checkpoint[]) private _checkpoints;

// 统一规则：任何余额变动 = 票从"发送者的票主"搬到"接收者的票主"
function _transfer(address from, address to, uint256 amount) internal {
    /* 改余额… */
    _moveVotes(_voteOwner(from), _voteOwner(to), amount);
}

// 历史票权查询：二分找 ≤ blockNumber 的最后检查点（提案计票用）
function getPriorVotes(address a, uint256 blockNumber) public view returns (uint256) {
    require(blockNumber < block.number, "not yet determined"); // 本块尚未定论
    /* 二分查找 */
}
```

三条铁语义：`delegate(to)` 是"搬家"不是"请求"；提案用
`snapshotBlock = block.number - 1` 计票；委托晚于提案 = 快照 0 票（防临投票买票）。

**② LabTimelock：三权分立**。四道闸门：

```solidity
function executeAction(address target, uint256 value, bytes calldata data) external payable {
    require(msg.sender == admin, "!admin");                    // 只有 Governor 能触发
    uint256 eta = queued[txHashOf(target, value, data)];
    require(eta != 0, "not queued");
    require(block.timestamp >= eta, "timelock not matured");   // 延迟到期
    require(block.timestamp <= eta + GRACE_PERIOD, "tx expired"); // 宽限期外作废
    (bool ok, ) = target.call{value: value}(data);             // 真正执行
}
```

delay 的意义：即使投票被恶意通过，用户也有时间提款离场。

**③ LabGovernor：状态机**。`state(id)`：Active(1) → Succeeded(4) →
Queued(5) → Executed(7)，投票窗口截止 + 赞成>反对 + 达法定票数才 Succeeded；
`queue` 排进 Timelock，延迟到期 `execute` 经 Timelock 调 Box。

**④ LabBox**：被治理资产替身——owner 是 Timelock，绕过治理改不了它。

### ③ 部署过程

一键部署 6 笔交易（顺序有讲究——**所有权交接链**）：

```
① 部署 LabVoteToken(GOV, 100万) ② 部署 LabTimelock(admin=部署者, delay=30s)
③ 部署 LabGovernor(代币, Timelock, 窗口 600s, quorum 1000, 门槛 1)
④ 部署 LabBox ⑤ Box.transferOwnership(Timelock)
⑥ Timelock.setAdmin(Governor)   ← 交接完成，从此改 Box 只能走提案
→ 造选民：转 gas + 铸 GOV + 各自 delegate(自己) → 等一个出块周期让检查点成历史
```

→ 实录：第 28 章

### ④ 逐句精解（LabGovernance.sol 四合约完整源码，共 485 行）

#### 合约一：LabVoteToken——投票权与余额分离（1-133 行）

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;                                  // 1

interface IERC20Lab {                                     // 2
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract LabVoteToken {                                   // 3
    string public constant name = "Lab Governance Token"; // 4
    string public constant symbol = "GOV";                // 5
    uint8 public constant decimals = 18;                  // 6
    uint256 public totalSupply;                           // 7

    mapping(address => uint256) public balanceOf;         // 8
    mapping(address => mapping(address => uint256)) public allowance; // 9

    /// 投票权代理：0 表示未委托（票在自己头上）      // 10
    mapping(address => address) public delegates;         // 11

    struct Checkpoint {                                   // 12
        uint32 fromBlock;
        uint224 votes;
    }
    mapping(address => Checkpoint[]) private _checkpoints; // 13

    event Transfer(address indexed from, address indexed to, uint256 value); // 14
    event Approval(address indexed owner, address indexed spender, uint256 value); // 15
    event DelegateChanged(address indexed delegator, address indexed from, address indexed to); // 16
    event DelegateVotesChanged(address indexed delegate, uint256 previous, uint256 next); // 17

    constructor(address to, uint256 supply) {             // 18
        uint256 scaled = supply * 1000000000000000000;
        totalSupply = scaled;
        balanceOf[to] = scaled;
        emit Transfer(address(0), to, scaled);
    }

    function decimals18() public pure returns (uint256) { return 1e18; } // 19

    function _writeCheckpoint(Checkpoint[] storage ckpts, uint256 votes) internal { // 20
        uint256 pos = ckpts.length;                       // 21
        if (pos > 0) {                                    // 22
            Checkpoint memory old = ckpts[pos - 1];
            if (old.fromBlock == block.number) {          // 23
                ckpts[pos - 1] = Checkpoint(uint32(block.number), uint224(votes));
                return;
            }
        }
        emit DelegateVotesChanged(                        // 24
            address(this), old_votes_cache(ckpts, pos), votes); // 见 27 注
        ckpts.push(Checkpoint(uint32(block.number), uint224(votes))); // 25
    }

    function old_votes_cache(Checkpoint[] storage ckpts, uint256 pos) internal view returns (uint256) { // 26
        return pos > 0 ? ckpts[pos - 1].votes : 0;
    }

    function _moveVotes(address src, address dst, uint256 amount) internal { // 27
        if (src == dst) return;                           // 28
        uint256 srcVotes = getCurrentVotes(src);          // 29
        _writeCheckpoint(_checkpoints[src], srcVotes - amount); // 30
        uint256 dstVotes = getCurrentVotes(dst);          // 31
        _writeCheckpoint(_checkpoints[dst], dstVotes + amount); // 32
    }

    function getCurrentVotes(address account) public view returns (uint256) { // 33
        uint256 pos = _checkpoints[account].length;
        return pos == 0 ? 0 : _checkpoints[account][pos - 1].votes;
    }

    function getPriorVotes(address account, uint256 blockNumber) public view returns (uint256) { // 34
        require(blockNumber < block.number, "not yet determined"); // 35
        uint256 pos = _checkpoints[account].length;       // 36
        if (pos == 0) return 0;                           // 37
        if (_checkpoints[account][pos - 1].fromBlock <= blockNumber) { // 38
            return _checkpoints[account][pos - 1].votes;
        }
        uint256 lower = 0;                                // 39
        uint256 upper = pos - 1;
        while (upper > lower) {                           // 40
            uint256 center = upper - (upper - lower) / 2;
            Checkpoint memory cp = _checkpoints[account][center];
            if (cp.fromBlock == blockNumber) {
                return cp.votes;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return _checkpoints[account][lower].votes;        // 41
    }

    function _transfer(address from, address to, uint256 amount) internal { // 42
        require(from != address(0) && to != address(0), "zero addr");
        require(balanceOf[from] >= amount, "insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        _moveVotes(delegates[from] == address(0) ? from : delegates[from], // 43
                   delegates[to]   == address(0) ? to   : delegates[to],
                   amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) { // 44
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) { // 45
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) { // 46
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _delegate(address delegatee) internal {      // 47
        address account = msg.sender;
        address current = delegates[account];
        uint256 votes = balanceOf[account];
        if (delegatee != address(0)) {
            delegates[account] = delegatee;
            if (current != address(0) && votes > 0)       // 48
                _moveVotes(current, delegatee, votes);
            else if (votes > 0)
                _writeCheckpoint(_checkpoints[delegatee], getCurrentVotes(delegatee) + votes); // 49
        } else {
            require(current != address(0), "no delegate");
            delegates[account] = address(0);
            if (votes > 0) _moveVotes(current, account, votes); // 50
        }
        emit DelegateChanged(account, current, delegatee);
    }

    function delegate(address delegatee) external {       // 51
        _delegate(delegatee);
    }

    function mint(address to, uint256 amount) external {  // 52
        uint256 scaled = amount * 1000000000000000000;
        totalSupply += scaled;
        balanceOf[to] += scaled;
        emit Transfer(address(0), to, scaled);
        if (delegates[to] != address(0))                  // 53
            _writeCheckpoint(_checkpoints[delegates[to]],
                getCurrentVotes(delegates[to]) + scaled);
    }
}
```

| # | 解释 |
|---|------|
| 1-2 | 版本约束 + 接口（供金库划转，本文件内备用） |
| 3 | Compound GovernorAlpha 配套代币 COMP 的复刻——"投票权 ≠ 持币"的教学载体 |
| 4-6 | `constant` 字符串/uint8：不占存储槽，编译期入字节码——名称写死不可改 |
| 7-9 | 普通 ERC-20 三件套（余额、授权、总量），与专题 02 同构 |
| 10-11 | **委托关系表**：`delegates[我] = 代理人`；零地址 = 未委托（票算自己的）。注意"委托"不冻结币——币还能转，只是票权跟着规则走（第 43 行） |
| 12 | **检查点结构体**：`uint32 fromBlock + uint224 votes` 打包进**一个 32 字节槽**（位打包：区块号 4G 够用、票数 2²²⁴ 够用）——历史快照的最小存储单元 |
| 13 | 每地址一条检查点**数组**（只增不改）：这就是"链上历史数据库"——每次票权变动追加一条，永不覆盖 |
| 14-17 | 事件：标准 Transfer/Approval + 委托两事件（谁换代理人、谁的票权从几变到几——选票追踪的数据源） |
| 18 | 构造器：铸给指定地址（部署者或空投金库） |
| 19 | 辅助 view：返回 1e18（前端换算用，纯函数零 gas 链下调） |
| 20-25 | **写检查点**：21-23 同一区块内重复变动 → **就地覆盖最后一条**（一个块只有一个"当前值"，语义正确且省 push）；24-25 不同块 → 发变更事件 + push 新检查点。检查点数组从此成为只增的历史 |
| 27-32 | **票权搬家**：src 与 dst 相同直接返回（转账给自己不动票）；29-32 两侧各写一条新检查点（src 减、dst 加）——**先读当前票再写**，getCurrentVotes 读的是各自动态累加的最新值 |
| 33 | 当前票权 = 检查点数组最后一条（空数组为 0） |
| 34-41 | **历史票权查询**（治理计票的灵魂函数）：35 **只能查过去块**——本区块尚未定论，现在投票时此刻的转账不得影响计票（防"投票瞬间买票"）；36-38 最新检查点已早于目标块 → 直接返回；39-41 **二分查找** ≤ blockNumber 的最后一条检查点——O(log n)，百万级历史也只要 20 步 |
| 42-43 | **统一规则**（本合约最重要的一行）：任何转账完成后，票从**发送者的票主**搬到**接收者的票主**（票主=代理人，没代理人就是自己）。卖出即丢票、买入即得票（若已委托），全部自动，无须任何"更新投票权"交易 |
| 44-46 | 标准 ERC-20 三函数，全部经由 _transfer——票权规则无死角 |
| 47-50 | 委托：48 已有代理人 → 整批搬家（旧代理人检查点减、新代理人加）；49 首次委托 → 只给新代理人加检查点；50 取消委托（传零地址）→ 搬回自己名下。**委托是"搬家"不是"请求"**——一经发出立即生效，不可由代理人拒绝 |
| 52-53 | 教学版 mint（无权限，方便造选民）；53 关键点：**铸给已委托的人，票要同步进其代理人的检查点**——漏了这行就出现"有钱没票"的鬼账 |

#### 合约二：LabTimelock——三权分立与延迟生效（136-241 行）

```solidity
contract LabTimelock {                                    // 54
    uint256 public constant GRACE_PERIOD = 48 hours;      // 55
    uint256 public constant MAX_DELAY = 30 days;          // 56
    uint256 public constant MINIMUM_DELAY = 1 seconds;    // 57

    address public admin;                                 // 58
    address public pendingAdmin;                          // 59

    mapping(bytes32 => uint256) public queuedTransactions; // 60

    event QueueTx(bytes32 indexed txHash, address indexed target, uint256 value,
        string signature, bytes data, uint256 eta);        // 61
    event CancelTx(bytes32 indexed txHash);               // 62
    event ExecuteTx(bytes32 indexed txHash, address indexed target, uint256 value,
        string signature, bytes data, uint256 eta);       // 63
    event NewAdmin(address indexed newAdmin);             // 64
    event NewPendingAdmin(address indexed newPendingAdmin); // 65

    modifier onlyAdmin() { require(msg.sender == admin, "timelock: !admin"); _; } // 66
    modifier onlySelf()  { require(msg.sender == address(this), "timelock: !self"); _; } // 67
    modifier etaExpired(bytes32 txHash) {                 // 68
        require(block.timestamp > queuedTransactions[txHash] + GRACE_PERIOD, "not expired");
        _;
    }

    constructor(address _admin, uint256 _delay) {         // 69
        require(_delay >= MINIMUM_DELAY, "delay too small");
        require(_delay <= MAX_DELAY, "delay too large");
        admin = _admin;
        DELAY = _delay;
    }

    uint256 public DELAY;                                 // 70

    function _txHash(address target, uint256 value, bytes memory data) // 71
        internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(address(target), value, data));
    }

    function queueTransaction(address target, uint256 value, bytes calldata data, uint256 eta) // 72
        external onlyAdmin returns (bytes32) {
        require(eta >= block.timestamp + DELAY, "eta too soon"); // 73
        bytes32 txHash = _txHash(target, value, data);    // 74
        queuedTransactions[txHash] = eta;                 // 75
        emit QueueTx(txHash, target, value, "", data, eta); // 76
        return txHash;
    }

    function cancelTransaction(address target, uint256 value, bytes calldata data) // 77
        external onlyAdmin {
        bytes32 txHash = _txHash(target, value, data);
        delete queuedTransactions[txHash];                // 78
        emit CancelTx(txHash);
    }

    function execute(address target, uint256 value, bytes calldata data) // 79
        external payable onlyAdmin returns (bytes memory) {
        bytes32 txHash = _txHash(target, value, data);    // 80
        uint256 eta = queuedTransactions[txHash];         // 81
        require(eta != 0, "timelock: not queued");        // 82
        require(block.timestamp >= eta, "timelock: not matured"); // 83
        require(block.timestamp <= eta + GRACE_PERIOD, "timelock: tx expired"); // 84
        delete queuedTransactions[txHash];                // 85
        (bool ok, bytes memory ret) = target.call{value: value}(data); // 86
        require(ok, "timelock: call failed");             // 87
        emit ExecuteTx(txHash, target, value, "", data, eta); // 88
        return ret;
    }

    function setAdmin(address _admin) external onlySelf { // 89
        admin = _admin;
        emit NewAdmin(_admin);
    }

    receive() external payable {}                         // 90
}
```

| # | 解释 |
|---|------|
| 54 | 通用延迟执行器（Compound Timelock 复刻）——被治理的一切资产都归它管，**它是协议的"新国王"** |
| 55-57 | 三个时间常数：宽限期 48 小时（过期作废）、延迟上限 30 天、下限 1 秒（不许零延迟架空） |
| 58-59 | 现任管理员（=Governor）+ 候任（两步交接第一步；教学版 setAdmin 走 onlySelf 一步到位，候任字段保留演示真实流程） |
| 60 | 已排队交易表：txHash → 预定生效时刻 eta。**键是交易内容哈希**——同内容同 eta 天然去重 |
| 61-65 | 事件：排队/取消/执行/换管理员——每一次"王权动作"留痕 |
| 66-68 | 三个修饰器：onlyAdmin（Governor 才能操作）、onlySelf（合约自己——即经 execute 回调，改管理员只能由已排队到期后的交易触发）、etaExpired（工具函数） |
| 69-70 | 构造器：delay 上下限校验后锁入口径（部署者先当 admin，随即 setAdmin 交棒 Governor——**交接链**见③部署过程） |
| 71 | **交易身份 = keccak(目标+金额+数据)**：同一笔动作的排队/取消/执行必须字字相同才对得上号（改 1 个字节就是另一笔交易） |
| 72-76 | 排队：73 eta 不得早于"此刻+延迟"——**闸门的核心**，谁也绕不过去；74-75 登记；76 发事件（前端"排队中"展示 eta 倒计时） |
| 77-78 | 取消：按同哈希删除排队记录（执行前随时可撤） |
| 79-88 | **执行四闸门**：82 必须排过队（不能直接 execute）；83 **延迟到期**；84 **宽限期内**（过期作废需重新排队——防陈年交易在某天突然生效）；85 先删记录再执行（一次性，防重放）；86 **`target.call{value}(data)`——通用低级调用，Timelock 能执行任何合约的任何函数**（这就是"全能钥匙"的含义与危险）；87 失败即整体 revert（Governor 会感知并把提案标为失败） |
| 89 | **改管理员只能 onlySelf**：即"排队一笔调用 setAdmin 的交易 → 延迟到期 → execute"——**连换国王都要过延迟**，没有后门 |
| 90 | receive()：提案可能带 ETH（value 参数），Timelock 要收得住 |

#### 合约三：LabGovernor——提案状态机（244-405 行）

```solidity
contract LabGovernor {                                    // 91
    enum State { Pending, Active, Canceled, Defeated, Succeeded, Queued, Expired, Executed } // 92

    uint256 public immutable votingPeriod;                // 93
    uint256 public immutable quorumVotes;                 // 94
    uint256 public immutable proposalThreshold;           // 95

    struct Proposal {                                     // 96
        address proposer;
        string description;
        address target;
        bytes callData;
        uint256 startBlock;
        uint256 endBlock;
        uint256 forVotes;
        uint256 againstVotes;
        bool queued;
        bool executed;
        uint256 eta;
        mapping(address => uint8) hasVoted;              // 97
    }

    uint256 public proposalCount;                         // 98
    mapping(uint256 => Proposal) private _proposals;      // 99
    LabVoteToken public immutable govToken;               // 100
    LabTimelock public immutable timelock;                // 101

    event ProposalCreated(uint256 id, address proposer, address target, bytes callData, // 102
        uint256 startBlock, uint256 endBlock, string description);
    event VoteCast(address indexed voter, uint256 proposalId, bool support, uint256 votes); // 103
    event ProposalQueued(uint256 id, uint256 eta);        // 104
    event ProposalExecuted(uint256 id);                   // 105

    constructor(address _token, address _timelock, uint256 _votingPeriod, // 106
        uint256 _quorumVotes, uint256 _proposalThreshold) {
        govToken = LabVoteToken(_token);
        timelock = LabTimelock(_timelock);
        votingPeriod = _votingPeriod;
        quorumVotes = _quorumVotes;
        proposalThreshold = _proposalThreshold;
    }

    function state(uint256 id) public view returns (State) { // 107
        Proposal storage p = _proposals[id];
        if (p.executed) return State.Executed;            // 108
        if (p.queued) return State.Queued;                // 109
        if (block.number > p.endBlock) {                  // 110
            if (p.forVotes > p.againstVotes && p.forVotes >= quorumVotes)
                return State.Succeeded;
            return State.Defeated;
        }
        if (block.number < p.startBlock) return State.Pending; // 111
        return State.Active;                              // 112
    }

    function propose(string memory description, address target, bytes memory callData) // 113
        external returns (uint256) {
        uint256 snapshotBlock = block.number - 1;         // 114
        require(govToken.getPriorVotes(msg.sender, snapshotBlock) >= proposalThreshold, // 115
            "threshold");
        proposalCount += 1;
        Proposal storage p = _proposals[proposalCount];
        p.proposer = msg.sender;
        p.description = description;
        p.target = target;
        p.callData = callData;
        p.startBlock = block.number;                      // 116
        p.endBlock = block.number + votingPeriod / 15;    // 117
        emit ProposalCreated(proposalCount, msg.sender, target, callData, // 118
            p.startBlock, p.endBlock, description);
        return proposalCount;
    }

    function castVote(uint256 id, bool support) external { // 119
        require(state(id) == State.Active, "not active"); // 120
        Proposal storage p = _proposals[id];
        require(p.hasVoted[msg.sender] == 0, "already voted"); // 121
        uint256 votes = govToken.getPriorVotes(msg.sender, p.startBlock - 1); // 122
        require(votes > 0, "no votes");
        if (support) p.forVotes += votes; else p.againstVotes += votes; // 123
        p.hasVoted[msg.sender] = 1;                       // 124
        emit VoteCast(msg.sender, id, support, votes);    // 125
    }

    function queue(uint256 id) external {                 // 126
        require(state(id) == State.Succeeded, "not succeeded"); // 127
        Proposal storage p = _proposals[id];
        uint256 eta = block.timestamp + timelock.DELAY(); // 128
        timelock.queueTransaction(p.target, 0, p.callData, eta); // 129
        p.queued = true;
        p.eta = eta;
        emit ProposalQueued(id, eta);
    }

    function execute(uint256 id) external {               // 130
        require(state(id) == State.Queued, "not queued"); // 131
        Proposal storage p = _proposals[id];
        timelock.execute{value: 0}(p.target, 0, p.callData); // 132
        p.executed = true;
        emit ProposalExecuted(id);
    }

    function getProposal(uint256 id) external view returns ( // 133
        address proposer, string memory description, uint256 forVotes,
        uint256 againstVotes, uint256 startBlock, uint256 endBlock,
        uint8 st) {
        Proposal storage p = _proposals[id];
        return (p.proposer, p.description, p.forVotes, p.againstVotes,
            p.startBlock, p.endBlock, uint8(state(id)));
    }

    function hasVoted(uint256 id, address voter) external view returns (bool) { // 134
        return _proposals[id].hasVoted[voter] == 1;
    }
}
```

| # | 解释 |
|---|------|
| 91 | 治理合约（GovernorAlpha 简化版）：只管提案/投票/计票，**执行权外包给 Timelock** |
| 92 | **状态枚举**八态；真实生命周期教学简化为 `Active→Succeeded→Queued→Executed`，Pending/Defeated/Expired 保留语义 |
| 93-95 | 三个治理参数（immutable 省 gas）：投票期（秒）、法定票数（赞成票须 ≥ 才可能通过）、提案门槛（提案人快照票权下限） |
| 96 | **提案结构体**：目标合约 + calldata（就是"要执行的那笔交易"）+ 起止区块 + 两方向票数 + 排队/执行标记 + eta |
| 97 | struct 内嵌 mapping（Solidity ≥0.5 合法）：**一人一票**记录表；`_proposals` 是 private 总表，外部一律经 133/134 视图 |
| 100-101 | 两个 immutable 依赖：计票用 GOV 代币、执行用 Timelock |
| 102-105 | 四事件：提案生命周期每一步留痕——前端时间线按事件流还原 |
| 106 | 构造器注入：代币 + Timelock + 三参数（votingPeriod=600s、quorum=1000、门槛=1 GOV，教学参数） |
| 107-112 | **状态推导（不存储 state，每次现算）**：优先级 已执行>已排队>已截止>未开始>进行中；110 截止判定：赞成>反对 **且** 赞成 ≥ quorum 才 Succeeded，否则 Defeated——**存储是事实的缓存，状态是事实的函数**，算错不可能 |
| 113-118 | 提案：114 **快照块 = 当前块 − 1**——此刻本块还没定论；115 门槛查**快照票**（刚买的币不能立刻提案）；116 投票起点=当前块、117 终点按 15 秒出块换算投票期秒数；118 发事件（提案即刻全链可见） |
| 119-125 | 投票：120 只允许 Active 期投；121 一人一票；122 **票权 = 提案快照块时刻的票权**——提案发出后，委托/转账全部无效（"选民名册在提案那一刻已锁定"；实测：造选民后必须等一个出块周期才能提案/投票，坑 16）；123 按方向累计；124 记"已投"；125 发事件 |
| 126-129 | 排队：127 只有 Succeeded 可排；128 eta = 此刻+Timelock 延迟（30s）；129 **Governor 调 Timelock.queueTransaction**（只有 admin=Governor 能排队——而 Governor 的这次调用由提案人触发） |
| 130-132 | 执行：131 必须 Queued；132 调 `timelock.execute`——**由 Timelock 过四闸门后真正执行目标交易**；标记 executed。注意 132 调用本身若被 Timelock 的 83 行拒（没到期），整笔 revert——前端按钮置灰显示倒计时 |
| 133-134 | 视图：提案全字段 + 状态码（前端轮询刷新时间线）；查询某地址是否已投 |

#### 合约四：LabBox——被治理资产替身（407-484 行）

```solidity
contract LabBox {                                         // 135
    address public owner;                                 // 136
    address public pendingOwner;                          // 137
    uint256 public value;                                 // 138

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner); // 139
    event ValueSet(uint256 newValue, address setBy);      // 140

    modifier onlyOwner() { require(msg.sender == owner, "box: !owner"); _; } // 141

    constructor() { owner = msg.sender; }                 // 142

    function setValue(uint256 _value) external onlyOwner { // 143
        value = _value;
        emit ValueSet(_value, msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner { // 144
        pendingOwner = newOwner;
    }

    function claimOwnership() external {                  // 145
        require(msg.sender == pendingOwner, "box: !pending");
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    receive() external payable {}                         // 146
}
```

| # | 解释 |
|---|------|
| 135-138 | 被治理资产"替身"：真实协议里它是利率模型、参数合约、金库……教学用一个 uint 演示"改参数" |
| 141-143 | **唯一入口被 owner 锁死**：setValue 只能 owner 调——治理的全部意义：让 owner=Timelock |
| 144-145 | 两步所有权交接：transferOwnership 只是"提名"，**新主必须自己 claim**（防止误转给无主地址/合约后权力悬空）——部署脚本第 5 笔交易就是 Timelock 视角调 claim（坑 18：Timelock 调 claim 必须由 Timelock 自己发起，经 execute 排队执行） |
| 146 | receive()：Box 可能收 ETH（execute 带 value 时） |

→ 实录：第 28 章

---

## 专题 10：博彩（LabCasino）

### ① 背景

链上赌场的教学价值不是博彩，是两件事：**"承诺-兑现"式随机性**
（链上没有事前无人知的随机数）与**概率定价**（庄家优势写在赔率里）。

### ② 代码详解

**随机性：延迟开奖（commit-reveal 单人简化版）**

```solidity
uint256 public constant SEED_DELAY = 3;

function bet(uint8 choice, uint8 exactGuess) external payable notPaused {
    bets[nextId++] = Bet({ …, seedBlock: block.number + SEED_DELAY, … });
    // 下注瞬间承诺"未来第 3 块的哈希"为种子——此刻出块者也无法预知它
}

function reveal(uint256 id) external notPaused {
    require(block.number > b.seedBlock, "seed not ready");   // 45 秒后兑现
    bytes32 h = blockhash(b.seedBlock);
    require(uint256(h) != 0, "hash unavailable");            // 超 256 块哈希变 0
    uint256 result = uint256(h) % 100;
    /* 判赔 */
}
```

为什么不能用别的：`blockhash(block.number)` **恒为 0**（本块哈希要下一块
才算得出）；timestamp/coinbase 可被出块者操纵；前端传随机数=玩家自带答案。

**概率定价**：

| 玩法 | 概率 | 赔率（含本金） | 庄家优势 |
|---|---|---|---|
| 开小 <50 | 49/100 | 198/100 | 2%（49 少算了个整点） |
| 开大 ≥50 | 51/100 | 196/100 | ≈0%（教学故意留缺口） |
| 押中数字 | 1/100 | 9000/100 | 10% |

押 1 ETH 开小的期望值 = 0.49×1.98 − 1 = **−2.98%**。
`require(balance >= payout, "house broke")` 演示准备金透明——赔不起整笔 revert。

### ③ 部署过程

**部署交易与注资是两笔钱**（坑 19：构造函数 `require(msg.value>=1 ether)`
炸掉过部署）：

```
① 部署 LabCasino（构造函数只做 owner=msg.sender，不带 value）
② 单独发一笔转账注资开池 0.3 ETH（走 receive()）
③ 下注 bet{value: 0.05} → 等 3 块 → reveal
```

验证：连下 5 注逐注开奖，对账 0.3 + 4×0.1 − 0.198 = **0.302 ETH**
与 houseBalance() 分毫不差。

→ 实录：第 29 章

---

## 专题 11：身份与权限（LabAccessControl + LabVipToken）

### ① 背景

博彩合约的 `paused` 只有 owner 能切——一人兼发行、暂停、授权三职，
私钥即合约。OpenZeppelin AccessControl 把权力拆成
**"角色 → 成员"的多对多关系表**：ADMIN 铸不了币，MINTER 停不了币。

### ② 代码详解

```solidity
contract LabAccessControl {
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    // internal 不是 private：派生合约构造函数要初始化自己的 ADMIN 成员
    mapping(bytes32 => mapping(address => bool)) internal _members;

    modifier onlyRole(bytes32 role) {
        require(_members[role][msg.sender], "access denied"); _;
    }
    function grantRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE);
    function revokeRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE);
    function renounceRole(bytes32 role, address account) external {
        require(account == msg.sender, "can only renounce self"); // 防"替别人丢权限"
    }
}
```

受控示例 LabVipToken——角色标识即字符串哈希，无需注册表：

```solidity
bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

constructor() {
    _members[DEFAULT_ADMIN_ROLE][msg.sender] = true; // 部署者拿 ADMIN，不是万能 owner
}
function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
    require(!paused, "token paused");                // 铸币还要看暂停开关
    /* … */
}
```

### ③ 部署过程

```
① 部署 LabVipToken（我拿 ADMIN）
② 造员工：随机钱包 → 给合约金库充值 0.031 ETH（走 receive()）
   → ADMIN 调 topup(员工, 0.03) 内部分发 gas（坑 24：dev 直接转账被拒，
   走合约内部 call 一路畅通）
③ 员工 mint 被拒（access denied）→ grantRole(MINTER) → mint 成功 100 VIP
④ 员工暂停被拒 → grantRole(PAUSER) → 暂停 → mint 被拒 → 恢复
⑤ 演示 renounce：ADMIN 替员工 renounce 被拒 → 员工自弃 MINTER 成功
```

验证：链上事件 RoleGranted×3 / Deposited×2 / Transfer×2 / PausedSet×2 /
RoleRevoked×1，与页面状态面板吻合。

→ 实录：第 30 章

---

## 专题 12：跨链桥（LabBridgeVault + LabBridgedToken）

### ① 背景

桥是 Web3 被盗次数最多的设施（Ronin 6.2 亿、Wormhole 3.2 亿——
全出在"签名验证"这一环）。桥的世界观一句话：**不造币，只搬运**——
源链锁仓，目标链按锁仓凭证"映射发行"，回来时烧映射币、放还真币。
本教学用同链双合约模拟两侧，重点演示信任模型：放行只认**验证者签名阈值**。

### ② 代码详解

**往返四步**：

```
去程  A.deposit(recipient){value}         锁真币，nonce 全局递增，发 DepositInitiated
     （验证者离线对 (nonce, recipient, amount) 做 EIP-191 个人签名）
     B.confirmMint(nonce, recipient, amount, sigs)
                                          ecrecover 验够 quorum → 从流动性池转 beETH 给收款人
回程  B.unlock(recipient)                 收完 msg.sender 全部 peg 余额（烧币），发 WithdrawalInitiated
     A.confirmUnlock(nonce, recipient, amount, sigs)
                                          验签 → 金库放还真币
```

**签名消息——前后端严格对齐是桥的第一课**：

```solidity
function messageHash(uint256 nonce, address recipient, uint256 amount)
    public pure returns (bytes32) {
    bytes32 structHash = keccak256(abi.encode(nonce, recipient, amount));
    return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", structHash));
}
// 前端必须 signMessage(keccak256(abi.encode(...)))——abi.encode 不是
// solidityPacked，两者对同一参数产出不同哈希（坑 26）
```

**防重放三件套**：全局递增 nonce + `_minted/_unlocked` 单号一次性标记；
签名集合按签名者地址**升序且去重**（`require(signer > last)`）；
签名哈希黑名单 `_usedSigs`。

**calldata 手抠 bytes[]**（ecrecover 要裸 r/s/v）：

```solidity
assembly {
    let p := add(36, calldataload(100))        // 元素区起始（按参数布局写绝对偏移）
    let ptr := add(p, calldataload(add(p, mul(i, 32))))
    r := calldataload(add(ptr, 32))            // 跳过元素首字（长度 65）
    s := calldataload(add(ptr, 64))
    v := byte(0, calldataload(add(ptr, 96)))   // 65 字节的 v 在第 4 字 byte(0)，不是末字节（坑 27）
}
```

**权限**：RELAYER_ROLE（提交签名）、FUNDER_ROLE（灌 B 侧流动性），
部署者默认双角色（真实桥是不同团队不同机器）。

### ③ 部署过程

```
① 部署 A 侧 LabBridgeVault([验证者×3], quorum=2)
② 部署 B 侧 LabBridgeVault（同参数）
③ 部署 LabBridgedToken(beETH)（issuer=部署者）
④ B.attachPegToken(beETH)                    ← B 侧挂映射币
⑤ issuer mintTo(部署者, 1 beETH) → approve(B 金库) → fundPeg(1 beETH)  ← 灌流动性
业务：deposit 0.05 → 收 2/3 签名（各验证者 signMessage，地址升序）
     → confirmMint → unlock → confirmUnlock
```

验证（区块号实录）：锁定 5343 → 放行 5345 → 烧币 5349 → 放还 5351，
四类事件一一对应；最终钱包余额 = 初始 − 仅 gas 损耗，
真币分文不少——**锁一 peg 一**成立。

→ 实录：第 31 章

---

# 附录

> 附录 A 集中收录环境通用坑（第 1-8 条，其余随各阶段章节就地记录）；附录 B 复盘本次搭建的完整时间线。

---

## 附录 A：本环境踩坑总录

### A.1 环境通用坑（第 1-8 条，阶段 0-2 期间排查）

> 第 9-30 条踩坑随各阶段章节就地记录：
> 9（第 24 章）、10-11（第 25 章）、12（第 26 章）、13-14（第 27 章）、
> 15-18（第 28 章）、19-21（第 29 章）、22-25（第 30 章）、26-30（第 31 章）。

1. **编译必须锁 `evmVersion: "london"`**。
   Besu 24.12.2 的 genesis 只启用到 londonBlock，而 solc 0.8.37
   默认按 Cancun 编译，产物含 `PUSH0` 等新指令 → 上链后 gas 耗尽
   （回执 status=0）。用不同 evmVersion 编译同一合约做矩阵实验
   定位（scripts/troubleshoot.js）。

2. **所有交易必须显式 `gasPrice ≥ 1 Gwei` + `gasLimit`**。
   Besu `min-gas-price` 默认 1 Gwei；ethers 的 `eth_call` 默认
   gasPrice=0 会被拒，且误报 "execution reverted"。

3. **`eth_estimateGas` 对合约创建不可信**（直接报
   INVALID_OPERATION），部署时固定 20M gasLimit 绕过。

4. **Besu 会把"参数校验失败"报成
   `Invalid block, unable to parse RLP`**——排查前端 bug 时被这条
   错误误导了很久（真实原因是 rpc 调用把参数多包了一层数组）。
   教训：**看到离谱错误先怀疑自己的参数格式**。

5. **ethers.js UMD 构建功能不全**：`ContractFactory.getCreateCall`
   等方法不存在、JsonRpcProvider 轮询器在本环境崩溃。
   最终方案是完全绕开 provider 交易流水线——
   手工 ABI 编码 + `wallet.signTransaction()` + `eth_sendRawTransaction`
   + fetch 轮询回执，反而稳定透明。

6. **RPC 失败会级联**：一次坏响应后短时间内连续请求接连失败，
   前端 `rpc()` 用递增间隔（500ms/2s/5s）重试兜底。

7. **"Upfront cost exceeds account balance" = 发送方 ETH 不够付 gas**。
   新创建的钱包余额为 0，任何交易（包括代币转账）都需要
   `gasLimit × gasPrice` 的 ETH 开销。已在前端 `sendSigned()` 加了
   发送前预检：余额 < gas 开销 + 转账金额时直接给出中文提示
   （现有多少、本次需要多少、怎么切换账户），代币转账卡片同时
   显示当前"转出账户"，避免误以为是在用开发账户发交易。

8. **ethers v6 的 hex 必须带 `0x` 前缀**。
   `AbiCoder.decode(["string"], raw.slice(2))` 把 `0x` 剥掉后，
   ethers 报 "invalid BytesLike value"（纯 hex 字符串不是合法 BytesLike）。
   解码时直接传原始返回值即可；这类"链上数据正确、浏览器解码报错"
   的问题，先用 curl 直查 RPC 对照排查。

---

## 附录 B：本次搭建完整时间线（复盘）

1. `brew install besu` → 失败（Homebrew 无此包）
2. `brew install openjdk@21` → 失败（Cellar 无写权限）
3. 下载 Adoptium JDK → 失败（github 重定向超时）
4. Azul CDN 下载 Zulu JDK 21 → 成功 ✅
5. GitHub 直连下载 Besu 26.9.0 → 成功（慢速约 10 分钟）+ sha256 校验 ✅
6. JDK 21 跑 Besu 26.9.0 → 失败（要求 Java 25）
7. Azul CDN 下载 Zulu JDK 25 → 成功 ✅
8. `--network=dev` 启动 26.9.0 → **失败（dev 模式已被官方移除）**
9. Docker 各镜像源 → 全部失败
10. 用 VPN 代理（127.0.0.1:10808）下载 Besu 24.12.2 → 成功（54 秒）+ sha256 校验 ✅
11. `--network=dev` 启动 24.12.2 → 进程正常但不出块（等待 5 peers）
12. 加 `--sync-min-peers=1` → 仍缺 1 个 peer
13. 启动第二个节点（`--p2p-port=30304 --rpc-http-port=8546`）并 `admin_addPeer` 互连 → **开始出块** ✅
14. 签名发送交易 → 成功上链（status 0x1, gasUsed 21000）✅

---

## 结语

十二种合约走完，恰好覆盖 Web3 后端的主要版图：**资产**（代币/NFT/映射币）、
**交易**（DEX/桥）、**生息**（质押/借贷/乐高）、**公共品**（预言机/治理/权限）、
**应用**（博彩），外加**入口**（钱包）。它们的组合方式——专题 08 的三个合约
咬合、专题 07 喂专题 06、专题 09 治理一切——正是"DeFi 乐高"四个字的完整含义。

> 后续每完成一个功能（供应链 → ……），
> 都会在本指南继续追加对应的实现实录章节。
