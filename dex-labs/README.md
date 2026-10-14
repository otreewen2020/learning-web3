# dex-labs —— 智能合约交易所教学工程

在本地 Besu 链（Chain ID 1337，15 秒出块）上逐个实现 DeFi 全套组件。
配套理论见仓库根目录《[Besu本地链与智能合约开发指南.md](../Besu本地链与智能合约开发指南.md)》
（第四部分为入门理论，第五、六部分即本工程各阶段的实录与逐合约精解）。

## 工程结构

```
dex-labs/
├── contracts/          Solidity 源码
│   ├── LabToken.sol        阶段 1：ERC-20 代币（已完成 ✅）
│   ├── LabFactoryToken.sol 发币工厂模板（名称/符号/总量可配置）
│   ├── LabNFT.sol          阶段 2：ERC-721 手写精简版（已完成 ✅）
│   ├── LabStaking.sol      阶段 3：Synthetix 简化版质押奖励（已完成 ✅）
│   ├── LabAMM.sol          阶段 4：恒定乘积 AMM + 0.3% 手续费（已完成 ✅）
│   ├── LabLending.sol      阶段 5：超额抵押借贷/计息/健康度/清算（已完成 ✅）
│   ├── LabOracle.sol       阶段 6：多数据源中位数聚合预言机（已完成 ✅）
│   ├── LabLego.sol         阶段 7：DeFi 乐高——LP 抵押借贷金库（已完成 ✅）
│   ├── LabGovernance.sol   阶段 8：治理四件套 VoteToken/Governor/Timelock/Box（已完成 ✅）
│   ├── LabCasino.sol       阶段 9：链上博彩——blockhash 延迟开奖/固定赔率/准备金（已完成 ✅）
│   ├── LabAccess.sol       阶段 10：身份权限——AccessControl 角色表/白名单 mint/暂停（已完成 ✅）
│   └── LabBridge.sol       阶段 11：跨链桥——锁仓+映射发行/验证者阈值签名/防重放（已完成 ✅）
├── public/             发币网站前端
│   ├── index.html      单页：账户/发行/代币列表/转账/日志
│   ├── app.js          ethers.js 浏览器内本地签名 + 手工编码交易
│   └── vendor/         ethers.6 UMD（离线）
├── server.js           网站后端：静态服务 + /factory、/lego 合约模板 + /rpc 代理
├── scripts/
│   ├── deploy.js       通用编译+部署工具（所有阶段复用）
│   └── verify-token.js 阶段 1 验证脚本
├── deployments.json    已部署合约地址登记簿（自动维护）
└── node_modules/       solc + ethers
```

## 发币网站（一键发 ERC-20）

```sh
node server.js        # http://127.0.0.1:3000
```

- 打开页面自动加载本机开发账户（私钥留空时从 `/dev-key` 读取，仅本机）
- 填写 名称/符号/总量 → 点"发行代币"：浏览器本地签名 → `/rpc` 代理转发 Besu → 约 15 秒出块 → 显示合约地址并登记到"我的代币"
- 代币列表可下拉选择，向任意地址转账并回显接收方余额
- 私钥只在浏览器内存中用于本地签名，不经过服务器

## 常用命令

```sh
# 部署合约（编译→上链→记录地址）
node scripts/deploy.js contracts/LabToken.sol::LabToken 1000000

# 验证阶段 1
node scripts/verify-token.js
```

## 进度

| 阶段 | 内容 | 状态 |
|---|---|---|
| 0 | 钱包（创建/导入/切账户、ETH 转账、交易记录）| ✅ 已完成并验证 |
| 1 | 代币 LabToken（ERC-20，100 万发行）+ 网页发行 | ✅ 已完成并验证 |
| 2 | NFT（ERC-721：mint/ownerOf/tokenURI/transferFrom + 网页铸造确权转手）| ✅ 已完成并验证 |
| 3 | 质押（LabStaking：按秒累计奖励，网页部署池/质押/领取/赎回）| ✅ 已完成并验证 |
| 4 | DEX（LabAMM：x·y=k 恒定乘积 + 0.3% 手续费，网页建池/双向兑换/撤出）| ✅ 已完成并验证 |
| 5 | 借贷（LabLending：超额抵押/持续计息/健康度/清算，网页全流程）| ✅ 已完成并验证 |
| 6 | 预言机（LabOracle：多数据源白名单/中位数聚合/轮次门槛/异常值过滤/喂价借贷）| ✅ 已完成并验证 |
| 7 | DeFi 乐高（LabLego：LP 金库适配层，AMM+预言机+借贷三合一，抵押借款/折扣清算全流程）| ✅ 已完成并验证 |
| 8 | 治理（LabGovernance：Compound 式检查点票权/快照计票/Timelock 延迟执行，网页提案→投票→排队→执行全流程）| ✅ 已完成并验证 |
| 9 | 博彩（LabCasino：blockhash 延迟开奖/固定赔率与庄家优势/准备金透明，网页部署→注资→下注→开奖全流程）| ✅ 已完成并验证 |
| 10 | 身份权限（LabAccessControl+LabVipToken：角色表/授权回收/renounce 自弃/白名单 mint/PAUSER 暂停，网页授权→铸币→暂停→恢复全流程）| ✅ 已完成并验证 |
| 11 | 跨链桥（LabBridgeVault：同链双金库模拟 A/B 侧，锁仓→验证者 2/3 签名→映射币放行→烧币→放还真币，网页往返全流程）| ✅ 已完成并验证 |
| 12 | 供应链 | 待开始 |

阶段 1 成果：
- 合约地址以 `deployments.json` 里 `LabToken.address` 为准
- 验证覆盖：转账、事件日志、approve/transferFrom 授权代转、余额不足 revert

## ⚠️ 本环境重要注意事项（踩坑实录）

以下三条是 Besu 24.12.2 dev/Clique 链 + solc 0.8.37 的组合坑，
**新写合约前必读**：

1. **编译必须锁 `evmVersion: "london"`**。
   genesis 只启用到 londonBlock，solc 默认按 Cancun 编译，
   产物含 `PUSH0` 等新指令 → 上链执行 gas 耗尽、状态 0。
   （排查过程见 scripts/troubleshoot.js 的实验矩阵）

2. **发交易必须显式带 `gasLimit` 和 `gasPrice ≥ 1 Gwei`**。
   Besu 节点 `min-gas-price` 默认 1 Gwei；ethers 默认 eth_call
   用 gasPrice=0 会被拒（`INVALID_OPERATION` / `Upfront cost...`），
   并误报"execution reverted"。deploy.js 里已统一处理。

3. **`eth_estimateGas` 对本链不可信**（对任何合约创建均报
   INVALID_OPERATION），deploy.js 通过覆写估算器固定 gas 绕过。

另外：新账户（如随机钱包）要先有链原生 ETH 才能发交易付 gas，
验证脚本里用 alice 给 bob 转 0.5 ETH 演示了这一点。

4. **Besu 会把参数校验失败报成误导性错误**
   `Invalid block, unable to parse RLP`（如 eth_call 参数多包了一层数组、
   地址不是规范 0x+40 位十六进制）。前端 rpc() 里统一
   显式数组传参 + 递增间隔重试兜底；地址一律转小写规范后再用。
