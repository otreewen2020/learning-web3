// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title LabAMM —— 教学用恒定乘积做市商（Uniswap V2 简化版）
/// @notice 单池：原生 ETH ⇄ 某一个 ERC-20。
///         核心不变式：x·y = k（交易前后乘积只增不减，手续费留给池子）。
///         LP 份额用 mapping 记账（教学简化，真实 Uniswap 发 LP ERC-20）。
///         本环境约束：evmVersion london（禁 PUSH0）、避免 ** 幂运算。
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract LabAMM {
    address public admin;
    address public token;            // 池子另一侧的 ERC-20

    uint256 public reserveETH;       // x：ETH 储备
    uint256 public reserveToken;     // y：代币储备
    uint256 public totalLP;
    mapping(address => uint256) public lpOf;

    uint256 public constant FEE_NUM = 997;    // 0.3% 手续费：入金按 997/1000 计
    uint256 public constant FEE_DEN = 1000;

    event LiquidityAdded(address indexed provider, uint256 ethIn, uint256 tokenIn, uint256 lpMinted);
    event LiquidityRemoved(address indexed provider, uint256 ethOut, uint256 tokenOut, uint256 lpBurned);
    event Swap(address indexed trader, bool ethIn, uint256 amountIn, uint256 amountOut);

    constructor(address _token) {
        admin = msg.sender;
        token = _token;
    }

    /// @notice 报价：输入 amountIn（方向 ethIn），按 x·y=k 加手续费算输出
    function getAmountOut(uint256 amountIn, bool ethIn) public view returns (uint256) {
        require(amountIn > 0, "zero in");
        uint256 inR = ethIn ? reserveETH : reserveToken;
        uint256 outR = ethIn ? reserveToken : reserveETH;
        require(inR > 0 && outR > 0, "pool empty");
        uint256 inWithFee = amountIn * FEE_NUM;
        // out = outR * inFee / (inR * 1000 + inFee)  —— 先乘后除保精度
        return outR * inWithFee / (inR * FEE_DEN + inWithFee);
    }

    /// @notice 注入流动性（首注按 1:1 定价，后续按池内比例自动配对代币量）
    function addLiquidity(uint256 maxToken) external payable {
        require(msg.value > 0, "no ETH");
        if (totalLP == 0) {
            // 首次注入：按使用者给的 ETH/代币比例建立初始价格
            require(maxToken > 0, "no token");
            IERC20(token).transferFrom(msg.sender, address(this), maxToken);
            reserveETH = msg.value;
            reserveToken = maxToken;
            totalLP = msg.value;                 // 初始 LP = 首注 ETH 量
            lpOf[msg.sender] = totalLP;
            emit LiquidityAdded(msg.sender, msg.value, maxToken, totalLP);
        } else {
            // 后续注入：代币按 ETH 比例自动计算，maxToken 只作滑点保护上限
            uint256 needToken = reserveToken * msg.value / reserveETH;
            require(needToken > 0 && needToken <= maxToken, "slippage / ratio");
            IERC20(token).transferFrom(msg.sender, address(this), needToken);
            uint256 mintLP = totalLP * msg.value / reserveETH;
            reserveETH += msg.value;
            reserveToken += needToken;
            totalLP += mintLP;
            lpOf[msg.sender] += mintLP;
            emit LiquidityAdded(msg.sender, msg.value, needToken, mintLP);
        }
    }

    /// @notice 撤出流动性：按 LP 份额比例取回 ETH + 代币
    function removeLiquidity(uint256 lp) external {
        require(lp > 0 && lpOf[msg.sender] >= lp, "bad lp");
        uint256 ethOut = reserveETH * lp / totalLP;
        uint256 tokenOut = reserveToken * lp / totalLP;
        require(ethOut > 0 && tokenOut > 0, "dust");
        lpOf[msg.sender] -= lp;
        totalLP -= lp;
        reserveETH -= ethOut;
        reserveToken -= tokenOut;
        IERC20(token).transfer(msg.sender, tokenOut);
        payable(msg.sender).transfer(ethOut);
        emit LiquidityRemoved(msg.sender, ethOut, tokenOut, lp);
    }

    /// @notice ETH → 代币（ETH 随交易带入）
    function swapETHForToken() external payable {
        require(msg.value > 0, "no ETH");
        uint256 out = getAmountOut(msg.value, true);
        reserveETH += msg.value;
        reserveToken -= out;
        IERC20(token).transfer(msg.sender, out);
        emit Swap(msg.sender, true, msg.value, out);
    }

    /// @notice 代币 → ETH（需先 approve）
    function swapTokenForETH(uint256 amountIn) external {
        require(amountIn > 0, "no token");
        uint256 out = getAmountOut(amountIn, false);
        reserveToken += amountIn;
        reserveETH -= out;
        IERC20(token).transferFrom(msg.sender, address(this), amountIn);
        payable(msg.sender).transfer(out);
        emit Swap(msg.sender, false, amountIn, out);
    }

    /// @notice 接收 ETH（removeLiquidity 提款用；同时兜住直接转账）
    receive() external payable {}
}
