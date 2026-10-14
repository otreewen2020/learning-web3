// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title LabLending —— 教学用借贷协议（Compound/Aave 简化版）
/// @notice 抵押 ETH，借出某个 ERC-20。
///         核心概念：超额抵押（CF=66%）、持续计息、健康度、清算。
///         价格来自"模拟预言机"（管理员 setPrice，教学用固定值）。
///         演示利率默认每秒 1%（真实协议约 1e-13/秒），让利息肉眼可见。
///         本环境约束：evmVersion london（禁 PUSH0）、避免 ** 幂运算。
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract LabLending {
    address public admin;
    address public token;              // 借出资产

    uint256 public constant CF_NUM = 66;   // 抵押率 66%
    uint256 public constant CF_DEN = 100;
    uint256 public constant BONUS_NUM = 8; // 清算奖金 8%
    uint256 public constant BONUS_DEN = 100;

    uint256 public price;                  // 模拟预言机：1 ETH = ? token（1e18 缩放）
    uint256 public ratePerSecond;          // 每秒利率（1e18 缩放，如 0.01e18 = 每秒 1%）
    uint256 public tokenPool;              // 可借出的代币池

    mapping(address => uint256) public ethCollateral;  // ETH 抵押
    mapping(address => uint256) public principalOf;    // 借款本金
    mapping(address => uint256) public borrowTime;     // 借款起点（计息用）

    event Funded(uint256 amount);
    event Deposited(address indexed user, uint256 ethIn);
    event Withdrawn(address indexed user, uint256 ethOut);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, uint256 paid, uint256 interestPart);
    event Liquidated(address indexed user, address indexed liquidator, uint256 debt, uint256 seizedETH);
    event PriceUpdated(uint256 newPrice);

    constructor(address _token, uint256 _price, uint256 _rate) {
        admin = msg.sender;
        token = _token;
        price = _price;
        ratePerSecond = _rate;
    }

    /// @notice 应计债务 = 本金 × (1 + rate × 经过秒数)，先乘后除保精度
    function debtOf(address user) public view returns (uint256) {
        uint256 p = principalOf[user];
        if (p == 0) return 0;
        uint256 dt = block.timestamp - borrowTime[user];
        return p + p * ratePerSecond * dt / 1e18;
    }

    /// @notice 最大可借 = 抵押 ETH × CF × price / 1e18 - 现有债务
    function maxBorrow(address user) public view returns (uint256) {
        uint256 buyingPower = ethCollateral[user] * CF_NUM * price / CF_DEN / 1e18;
        uint256 debt = debtOf(user);
        return buyingPower > debt ? buyingPower - debt : 0;
    }

    /// @notice 健康度 = 抵押购买力 / 债务（1e18 缩放；<1e18 可被清算）
    function healthFactor(address user) public view returns (uint256) {
        uint256 debt = debtOf(user);
        if (debt == 0) return type(uint256).max;
        uint256 buyingPower = ethCollateral[user] * CF_NUM * price / CF_DEN / 1e18;
        return buyingPower * 1e18 / debt;
    }

    /// @notice 管理员注入可借代币（需先 approve）
    function fund(uint256 amount) external {
        require(msg.sender == admin, "only admin");
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        tokenPool += amount;
        emit Funded(amount);
    }

    /// @notice 模拟预言机调价（真实协议由 Chainlink 等喂价）
    function setPrice(uint256 _price) external {
        require(msg.sender == admin, "only admin");
        price = _price;
        emit PriceUpdated(_price);
    }

    /// @notice 存 ETH 作抵押
    function deposit() external payable {
        require(msg.value > 0, "no ETH");
        ethCollateral[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice 借代币：超额抵押校验
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

    /// @notice 还款：先付清应计利息，剩余减本金（需先 approve）
    function repay(uint256 amount) external {
        uint256 debt = debtOf(msg.sender);
        require(debt > 0, "nothing to repay");
        uint256 principal = principalOf[msg.sender];
        uint256 interest = debt - principal;
        require(amount >= interest, "pay interest first");
        uint256 paid = amount > debt ? debt : amount;
        IERC20(token).transferFrom(msg.sender, address(this), paid);
        tokenPool += paid;
        if (paid >= debt) {
            principalOf[msg.sender] = 0;
        } else {
            principalOf[msg.sender] = principal - (paid - interest);
            borrowTime[msg.sender] = block.timestamp;
        }
        emit Repaid(msg.sender, paid, interest);
    }

    /// @notice 取回抵押 ETH：取完剩余抵押仍须覆盖债务
    function withdraw(uint256 amount) external {
        require(ethCollateral[msg.sender] >= amount, "not enough collateral");
        ethCollateral[msg.sender] -= amount;
        uint256 debt = debtOf(msg.sender);
        uint256 buyingPower = ethCollateral[msg.sender] * CF_NUM * price / CF_DEN / 1e18;
        require(buyingPower >= debt, "would under-collateralize");
        payable(msg.sender).transfer(amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice 清算：任何人偿还欠款人的全部债务，拿走其全部抵押 + 最高 8% 奖金
    ///         （奖金封顶到合约余额——真实协议由保险基金/准备金承担这部分）
    function liquidate(address user) external {
        uint256 debt = debtOf(user);
        require(debt > 0, "no debt");
        require(healthFactor(user) < 1e18, "healthy");
        IERC20(token).transferFrom(msg.sender, address(this), debt);
        tokenPool += debt;
        uint256 want = ethCollateral[user] + ethCollateral[user] * BONUS_NUM / BONUS_DEN;
        uint256 seize = want <= address(this).balance ? want : address(this).balance;
        require(seize >= ethCollateral[user], "insolvent");  // 余额至少覆盖本金
        principalOf[user] = 0;
        ethCollateral[user] = 0;
        payable(msg.sender).transfer(seize);
        emit Liquidated(user, msg.sender, debt, seize);
    }

    receive() external payable {}
}
