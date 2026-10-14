// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title LabOracle —— 教学用多数据源聚合预言机（Chainlink 思路简化版）
/// @notice 解决的问题：智能合约不能自己上网查行情，价格必须由链下"喂"进来。
///         单一数据源不可信（它挂了/作恶了怎么办？），所以：
///         1) 多个数据源（reporter，模拟 Chainlink 的节点网络）各自独立报价；
///         2) 合约收集全部有效报价，排序后取【中位数】作为聚合结果
///            —— 少数异常值/恶意报价会被自然过滤；
///         3) 有效报价数达到门槛 minReports 才形成新轮次（round），防止少数人操纵；
///         4) 每次聚合产生一个新 roundId，历史轮次可查（对应 Chainlink 的 round）。
///         价格统一 1e18 缩放：1 ETH = 2000 DFIN → 2000e18。
///         本环境约束：evmVersion london（禁 PUSH0）、避免 ** 幂运算。
contract LabOracle {
    address public admin;
    uint256 public constant DECIMALS = 18;

    mapping(address => bool) public isReporter;   // 数据源白名单
    address[] public reporters;                   // 数据源列表（enumerable）
    uint256 public minReports;                    // 聚合所需最少报价数

    mapping(address => uint256) public priceOf;    // 各数据源的最新报价
    mapping(address => bool) public hasReported;  // 是否报过价（0 无法区分"未报"）

    uint256 public latestAnswer;     // 最新聚合价（消费端就读这个）
    uint256 public latestTimestamp;  // 最新聚合时间（用于判断数据是否过时/staleness）
    uint256 public roundId;          // 当前轮次号

    struct Round {
        uint256 answer;
        uint256 timestamp;
        uint256 count; // 本轮参与报价数
    }
    mapping(uint256 => Round) public rounds; // 轮次历史

    event ReporterAdded(address indexed reporter);
    event ReporterRemoved(address indexed reporter);
    event PriceReported(address indexed reporter, uint256 price);
    event RoundUpdated(uint256 indexed roundId, uint256 median, uint256 count);

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin");
        _;
    }

    constructor(uint256 initialPrice, uint256 _minReports) {
        require(initialPrice > 0, "zero price");
        require(_minReports > 0, "minReports zero");
        admin = msg.sender;
        minReports = _minReports;
        latestAnswer = initialPrice;
        latestTimestamp = block.timestamp;
        rounds[0] = Round(initialPrice, block.timestamp, 0); // 第 0 轮 = 创世价
    }

    function addReporter(address r) external onlyAdmin {
        require(r != address(0), "zero address");
        require(!isReporter[r], "already reporter");
        isReporter[r] = true;
        reporters.push(r);
        emit ReporterAdded(r);
    }

    /// @notice 批量添加（教学演示一次拉起多个数据源，省 gas 省时间）
    function addReporters(address[] calldata rs) external onlyAdmin {
        for (uint256 i = 0; i < rs.length; i++) {
            require(rs[i] != address(0), "zero address");
            require(!isReporter[rs[i]], "already reporter");
            isReporter[rs[i]] = true;
            reporters.push(rs[i]);
            emit ReporterAdded(rs[i]);
        }
    }

    function removeReporter(address r) external onlyAdmin {
        require(isReporter[r], "not reporter");
        isReporter[r] = false;
        // 交换到末尾再 pop（顺序无关，O(1) 删除）
        for (uint256 i = 0; i < reporters.length; i++) {
            if (reporters[i] == r) {
                reporters[i] = reporters[reporters.length - 1];
                reporters.pop();
                break;
            }
        }
        delete priceOf[r];
        delete hasReported[r];
        emit ReporterRemoved(r);
    }

    function reporterCount() external view returns (uint256) {
        return reporters.length;
    }

    /// @notice 数据源报价；报价后自动尝试聚合
    function report(uint256 price) external {
        require(isReporter[msg.sender], "only reporter");
        require(price > 0, "zero price");
        priceOf[msg.sender] = price;
        hasReported[msg.sender] = true;
        emit PriceReported(msg.sender, price);
        _aggregate();
    }

    /// @notice 当前所有有效报价排序后的中位数（纯读，不触发更新）
    /// @dev 教学链上数据源很少，直接插入排序；偶数个取中间两个的平均
    function pendingMedian() public view returns (uint256 median, uint256 count) {
        uint256[] memory ps = new uint256[](reporters.length);
        uint256 n;
        for (uint256 i = 0; i < reporters.length; i++) {
            if (hasReported[reporters[i]]) {
                ps[n] = priceOf[reporters[i]];
                n++;
            }
        }
        require(n > 0, "no reports");
        for (uint256 i = 1; i < n; i++) {
            uint256 key = ps[i];
            uint256 j = i;
            while (j > 0 && ps[j - 1] > key) {
                ps[j] = ps[j - 1];
                j--;
            }
            ps[j] = key;
        }
        if (n % 2 == 1) return (ps[n / 2], n);
        return ((ps[n / 2 - 1] + ps[n / 2]) / 2, n);
    }

    /// @notice 报价后自动聚合：报价数不足门槛则等待，不更新轮次
    function _aggregate() internal {
        (uint256 med, uint256 n) = pendingMedian();
        if (n < minReports) return;
        roundId += 1;
        latestAnswer = med;
        latestTimestamp = block.timestamp;
        rounds[roundId] = Round(med, block.timestamp, n);
        emit RoundUpdated(roundId, med, n);
    }

    /// @notice 数据源变动/补报后，任何人可手动触发再聚合
    ///         （真实 Chainlink 由节点在偏差超阈值或心跳到期时触发）
    function refresh() external {
        (uint256 med, uint256 n) = pendingMedian();
        require(n >= minReports, "not enough reports");
        roundId += 1;
        latestAnswer = med;
        latestTimestamp = block.timestamp;
        rounds[roundId] = Round(med, block.timestamp, n);
        emit RoundUpdated(roundId, med, n);
    }
}
