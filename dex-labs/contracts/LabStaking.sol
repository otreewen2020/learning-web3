// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title LabStaking —— 教学用质押挖矿（Synthetix StakingRewards 简化版）
/// @notice 质押任意 ERC-20，按秒累计奖励；注入金库后 DURATION 秒内发完。
///         核心数学：rewardPerToken（每份质押累计奖励，1e18 缩放）。
///         本环境约束：evmVersion london（禁 PUSH0）、避免 ** 幂运算。
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract LabStaking {
    address public admin;                 // 部署者
    address public stakingToken;          // 被质押的 ERC-20
    uint256 public constant DURATION = 3600; // 奖励发放期：3600 秒发完一期

    uint256 public rewardRate;            // 每秒奖励总量（decimals 同代币）
    uint256 public periodFinish;          // 本期奖励发完的时间戳
    uint256 public lastUpdateTime;        // 上次结算时间
    uint256 public rewardPerTokenStored;  // 每份质押累计奖励（1e18 缩放）
    uint256 public totalStaked;

    mapping(address => uint256) public stakedOf;               // 用户质押中的数量
    mapping(address => uint256) public rewards;                // 已结算未领取
    mapping(address => uint256) public userRewardPerTokenPaid; // 用户上次结算点

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardDeposited(uint256 amount, uint256 finishAt);

    constructor(address _token) {
        admin = msg.sender;
        stakingToken = _token;
    }

    /// @notice 每份质押（1 wei）到当前时刻累计可分得的奖励（1e18 缩放）
    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) return rewardPerTokenStored;
        uint256 t = block.timestamp;
        if (t > periodFinish) t = periodFinish;   // 过期后停止累计
        if (t <= lastUpdateTime) return rewardPerTokenStored;
        // 先乘后除，1e18 缩放保精度
        return rewardPerTokenStored + rewardRate * (t - lastUpdateTime) * 1e18 / totalStaked;
    }

    /// @notice 查询用户待领取奖励（读取即结算，不改状态）
    function earned(address account) public view returns (uint256) {
        return rewards[account]
            + stakedOf[account] * (rewardPerToken() - userRewardPerTokenPaid[account]) / 1e18;
    }

    /// @dev 任何改状态入口先"结算到此刻"，再执行业务——按秒计息的通用技巧
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

    /// @notice 注入奖励金库（需先 approve 本合约）；
    ///         注入 amount 后，未来 DURATION 秒内按 rewardRate = amount/DURATION 每秒发放
    function depositReward(uint256 amount) external updateReward(address(0)) {
        require(msg.sender == admin, "only admin");
        require(amount >= DURATION, "too small"); // 保证每秒至少 1 wei
        IERC20(stakingToken).transferFrom(msg.sender, address(this), amount);
        rewardRate = amount / DURATION;
        periodFinish = block.timestamp + DURATION;
        emit RewardDeposited(amount, periodFinish);
    }

    /// @notice 质押（需先 approve 本合约）
    function stake(uint256 amount) external updateReward(msg.sender) {
        require(amount > 0, "zero amount");
        totalStaked += amount;
        stakedOf[msg.sender] += amount;
        IERC20(stakingToken).transferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    /// @notice 赎回本金
    function withdraw(uint256 amount) external updateReward(msg.sender) {
        require(stakedOf[msg.sender] >= amount, "not enough staked");
        totalStaked -= amount;
        stakedOf[msg.sender] -= amount;
        IERC20(stakingToken).transfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice 领取累计奖励
    function getReward() external updateReward(msg.sender) {
        uint256 r = rewards[msg.sender];
        if (r > 0) {
            rewards[msg.sender] = 0;
            IERC20(stakingToken).transfer(msg.sender, r);
            emit RewardPaid(msg.sender, r);
        }
    }
}
