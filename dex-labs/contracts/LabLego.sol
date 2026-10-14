// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title LabLego —— DeFi 乐高：把 DEX 的 LP 份额抵押出去借代币
/// @notice 组合的三个模块：
///           LabAMM（第 14 章，ETH/代币池）
///         + LabOracle（第 16 章，1 ETH = ? 代币的聚合价）
///         + LabLending 的借贷模型（第 15 章，超额抵押/计息/健康度/清算）
///
///         关键设计：LabAMM 的 LP 是内部 mapping 记账（不可转让），
///         无法像 Uniswap V2 的 LP ERC-20 那样直接转给借贷合约。
///         本合约用【金库适配层（Adapter/Vault）】解决，且不改动 LabAMM：
///           1) 用户把 ETH+代币交给本合约，由本合约替用户调 amm.addLiquidity，
///              LP 记在本合约名下，本合约内按 lpCollateral[user] 分户记账；
///           2) LP 价值实时按池内储备 + 预言机价估值：
///              价值(代币单位) = LP份额 × reserveETH/totalLP × price/1e18
///                            + LP份额 × reserveToken/totalLP；
///           3) 抵押率 CF=50%（低于纯 ETH 的 66%）——LP 承担无常损失，
///              真实 Aave 对 LP 类资产给的 LTV 也更低；
///           4) 清算用"折扣购买"模型：清算人还 debt，按 LP 单价 1.08 倍
///              折算拿走 LP（seizeLP = debt×1.08/lpPrice），剩余 LP 留给
///              借款人；奖金来自折扣，不需要协议另备资金（对比第 15 章
///              踩坑 11：那里奖金要从合约余额出，这里 LP 本身就是资产组合）。
///         本环境约束：evmVersion london（禁 PUSH0）、避免 ** 幂运算。
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IAMM {
    function addLiquidity(uint256 maxToken) external payable;
    function removeLiquidity(uint256 lp) external;
    function reserveETH() external view returns (uint256);
    function reserveToken() external view returns (uint256);
    function totalLP() external view returns (uint256);
    function lpOf(address who) external view returns (uint256);
}

interface IOracle {
    function latestAnswer() external view returns (uint256);
}

contract LabLego {
    address public admin;
    address public token;    // 借出资产 = 池的代币侧
    address public amm;
    address public oracle;

    uint256 public constant CF_NUM = 50;   // LP 抵押率 50%
    uint256 public constant CF_DEN = 100;
    uint256 public constant BONUS_NUM = 8; // 清算折扣 8%
    uint256 public constant BONUS_DEN = 100;

    uint256 public ratePerSecond; // 每秒利率（1e18 缩放，演示 0.01e18）
    uint256 public tokenPool;     // 可借代币池

    mapping(address => uint256) public lpCollateral; // 用户质押的 LP 份额
    mapping(address => uint256) public principalOf;  // 借款本金
    mapping(address => uint256) public borrowTime;   // 计息起点

    event Funded(uint256 amount);
    event Staked(address indexed user, uint256 ethIn, uint256 tokenIn, uint256 lpGot);
    event Unstaked(address indexed user, uint256 lpBurned);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, uint256 paid);
    event Liquidated(address indexed user, address indexed liquidator, uint256 debt, uint256 lpSeized);

    constructor(address _token, address _amm, address _oracle, uint256 _rate) {
        admin = msg.sender;
        token = _token;
        amm = _amm;
        oracle = _oracle;
        ratePerSecond = _rate;
    }

    // ── LP 估值 ──────────────────────────────────────────

    /// @notice 用户 LP 抵押的三段估值（全部 1e18 缩放）
    /// @return ethPart     LP 对应的 ETH 数量
    /// @return tokPart     LP 对应的代币数量
    /// @return valueToken  折合代币的总价值（喂给购买力/健康度）
    function lpValue(address user)
        public
        view
        returns (uint256 ethPart, uint256 tokPart, uint256 valueToken)
    {
        uint256 lp = lpCollateral[user];
        uint256 total = IAMM(amm).totalLP();
        if (lp == 0 || total == 0) return (0, 0, 0);
        uint256 rEth = IAMM(amm).reserveETH();
        uint256 rTok = IAMM(amm).reserveToken();
        ethPart = rEth * lp / total;
        tokPart = rTok * lp / total;
        uint256 price = IOracle(oracle).latestAnswer(); // 1 ETH = price 代币
        valueToken = ethPart * price / 1e18 + tokPart;
    }

    /// @notice 单位 LP 的代币价格（清算折算用，1e18 缩放）
    function lpPrice() public view returns (uint256) {
        uint256 total = IAMM(amm).totalLP();
        if (total == 0) return 0;
        uint256 price = IOracle(oracle).latestAnswer();
        uint256 allEth = IAMM(amm).reserveETH() * price / 1e18;
        return (allEth + IAMM(amm).reserveToken()) * 1e18 / total;
    }

    /// @notice 债务 = 本金 × (1 + rate × 经过秒数)
    function debtOf(address user) public view returns (uint256) {
        uint256 p = principalOf[user];
        if (p == 0) return 0;
        uint256 dt = block.timestamp - borrowTime[user];
        return p + p * ratePerSecond * dt / 1e18;
    }

    /// @notice 购买力 = LP 估值 × CF；最大可借 = 购买力 - 现有债务
    function maxBorrow(address user) public view returns (uint256) {
        (, , uint256 v) = lpValue(user);
        uint256 power = v * CF_NUM / CF_DEN;
        uint256 debt = debtOf(user);
        return power > debt ? power - debt : 0;
    }

    /// @notice 健康度 = 购买力 / 债务（<1e18 可被清算）
    function healthFactor(address user) public view returns (uint256) {
        uint256 debt = debtOf(user);
        if (debt == 0) return type(uint256).max;
        (, , uint256 v) = lpValue(user);
        uint256 power = v * CF_NUM / CF_DEN;
        return power * 1e18 / debt;
    }

    // ── 资金与质押 ────────────────────────────────────────

    /// @notice 管理员注入可借代币（需先 approve）
    function fund(uint256 amount) external {
        require(msg.sender == admin, "only admin");
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        tokenPool += amount;
        emit Funded(amount);
    }

    /// @notice 质押流动性：本合约替用户向 AMM addLiquidity，LP 留合约内分户记账
    /// @param maxToken 用户授权的代币上限（滑点保护；首注按此数量成交，
    ///                 续注合约按池内比例只拉实际所需 needToken）
    function stakeLiquidity(uint256 maxToken) external payable {
        require(msg.value > 0, "no ETH");
        require(maxToken > 0, "no token");
        uint256 needToken;
        if (IAMM(amm).totalLP() == 0) {
            needToken = maxToken; // 首注：按用户给的 ETH/代币比例定价
        } else {
            // 续注：按池内当前比例配对，maxToken 只作上限
            needToken = IAMM(amm).reserveToken() * msg.value / IAMM(amm).reserveETH();
            require(needToken > 0 && needToken <= maxToken, "slippage / ratio");
        }
        // 用户 → 本合约 → 授权 AMM → AMM 从本合约拉走（AMM 的 transferFrom 对着 msg.sender=本合约）
        IERC20(token).transferFrom(msg.sender, address(this), needToken);
        IERC20(token).approve(amm, needToken);
        uint256 lpBefore = IAMM(amm).lpOf(address(this));
        IAMM(amm).addLiquidity{value: msg.value}(needToken);
        uint256 got = IAMM(amm).lpOf(address(this)) - lpBefore;
        require(got > 0, "no LP minted");
        lpCollateral[msg.sender] += got;
        emit Staked(msg.sender, msg.value, needToken, got);
    }

    /// @notice 撤出 LP：从 AMM removeLiquidity，取回的 ETH+代币原样转给用户
    ///         取完剩余购买力仍须覆盖债务
    function unstake(uint256 lp) external {
        require(lp > 0 && lpCollateral[msg.sender] >= lp, "bad lp");
        lpCollateral[msg.sender] -= lp;
        uint256 debt = debtOf(msg.sender);
        (, , uint256 v) = lpValue(msg.sender);
        require(v * CF_NUM / CF_DEN >= debt, "would under-collateralize");
        // 教学单池：stake 时 ETH 全部透传给 AMM，合约不留 ETH，
        // 故 removeLiquidity 前合约 ETH 余额为 0，到账的全是本次所得
        uint256 tokBefore = _tokenBalance();
        IAMM(amm).removeLiquidity(lp);
        uint256 gotToken = _tokenBalance() - tokBefore;
        if (gotToken > 0) IERC20(token).transfer(msg.sender, gotToken);
        uint256 gotEth = address(this).balance;
        if (gotEth > 0) payable(msg.sender).transfer(gotEth);
        emit Unstaked(msg.sender, lp);
    }

    // ── 借款/还款 ─────────────────────────────────────────

    function borrow(uint256 amount) external {
        require(amount > 0, "zero");
        require(maxBorrow(msg.sender) >= amount, "under collateral");
        require(tokenPool >= amount, "pool empty");
        if (principalOf[msg.sender] == 0) borrowTime[msg.sender] = block.timestamp;
        principalOf[msg.sender] += amount;
        tokenPool -= amount;
        IERC20(token).transfer(msg.sender, amount);
        emit Borrowed(msg.sender, amount);
    }

    /// @notice 还款（需先 approve；amount 可大于债务，合约只收实际债务）
    function repay(uint256 amount) external {
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

    // ── 清算 ──────────────────────────────────────────────

    /// @notice 清算：替欠款人还全部债务，按 LP 单价×1.08 折扣拿走对应 LP，
    ///         剩余 LP 留给欠款人。拿到的 LP 之后可自行 unstake 变现。
    function liquidate(address user) external {
        uint256 debt = debtOf(user);
        require(debt > 0, "no debt");
        require(healthFactor(user) < 1e18, "healthy");
        uint256 price = lpPrice();
        require(price > 0, "no price");
        // 应拿 LP = debt × 1.08 / LP单价（1e18 缩放对齐）
        uint256 wantLP = debt * (BONUS_DEN + BONUS_NUM) * 1e18 / BONUS_DEN / price;
        uint256 coll = lpCollateral[user];
        require(wantLP <= coll, "insolvent"); // 折扣价连全部 LP 都覆盖不了 → 协议已穿仓
        IERC20(token).transferFrom(msg.sender, address(this), debt);
        tokenPool += debt;
        principalOf[user] = 0;
        lpCollateral[user] = coll - wantLP;
        lpCollateral[msg.sender] += wantLP;
        emit Liquidated(user, msg.sender, debt, wantLP);
    }

    // ── 内部工具 ──────────────────────────────────────────

    function _tokenBalance() internal view returns (uint256) {
        // 极简 ERC-20 余额查询（不占 ABI 面）
        (bool ok, bytes memory data) = token.staticcall(
            abi.encodeWithSignature("balanceOf(address)", address(this))
        );
        require(ok, "balanceOf failed");
        return abi.decode(data, (uint256));
    }

    receive() external payable {}
}
