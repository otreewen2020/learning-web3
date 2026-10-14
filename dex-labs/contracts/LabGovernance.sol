// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title LabGovernance 教学治理套件（4 个合约，同文件编译）
///
/// 组合关系：
///   LabVoteToken（ERC-20 + 委托投票权 + 区块检查点）
///     └─ 票数喂给 ──> LabGovernor（提案/投票/排队/执行，Compound Governor 简化版）
///                         └─ 只有它能调 ──> LabTimelock（最短延迟队列）
///                                                └─ 延迟到期后 call ──> LabBox.setValue
///
/// 教学简化（与真实 Compound/OpenZeppelin Governor 的差距见指南第 18 章）：
///   - 提案只含单个 action（真实是 targets[]/values[]/calldatas[] 批量）；
///   - 无 EIP-712 签名投票/委托（只支持本人发交易）；
///   - Timelock 换手用 setAdmin 直接改（真实换手本身也要走 timelock 队列自举）；
///   - 投票期/延迟用秒级时间戳（真实用区块数），方便课堂演示。
/// 本环境约束：evmVersion london（禁 PUSH0）；避免 ** 幂运算。

// ════════════════════════════════════════════════════════
// 1) ERC-20 + 投票权（Compound ERC20Votes 精简版）
// ════════════════════════════════════════════════════════
contract LabVoteToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // 投票权独立于余额：余额持有者把票"委托"给某个地址（常是自己）
    struct Checkpoint {
        uint256 fromBlock;
        uint256 votes;
    }
    mapping(address => address) public delegates;
    mapping(address => Checkpoint[]) private _checkpoints;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
    event DelegateVotesChanged(address indexed delegate, uint256 previousBalance, uint256 newBalance);

    constructor(string memory _name, string memory _symbol, uint256 _supply, address recipient) {
        name = _name;
        symbol = _symbol;
        _mint(recipient, _supply);
    }

    // ── 标准 ERC-20 ──
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        require(a >= amount, "allowance");
        if (a != type(uint256).max) allowance[from][msg.sender] = a - amount;
        _transfer(from, to, amount);
        return true;
    }

    // ── 投票权检查点（Compound 式）──
    // 不变式：delegate == 0（从未委托）时票记在持币人自己头上；
    // delegate != 0 时票记在委托目标头上。所有余额变动都表现为
    // "票从发送者的票主搬到接收者的票主"，检查点始终守恒。
    function _moveVotes(address src, address dst, uint256 amount) internal {
        if (amount == 0 || src == dst) return;
        if (src != address(0)) {
            uint256 old = getCurrentVotes(src);
            _writeCheckpoint(src, old, old - amount);
        }
        if (dst != address(0)) {
            uint256 old = getCurrentVotes(dst);
            _writeCheckpoint(dst, old, old + amount);
        }
    }

    /// @notice 转走的票归属解析：delegate==0（从未委托）时票在自己头上，
    ///         否则票在委托目标头上。与 Compound getCurrentVotes 语义一致。
    function _voteOwner(address a) internal view returns (address) {
        address d = delegates[a];
        return d == address(0) ? a : d;
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
        // 铸币视同从 0x0 转入：票搬到接收者的票主（未委托即本人）
        _moveVotes(address(0), _voteOwner(to), amount);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        // 统一规则（Compound 式）：票从"发送者的票主"搬到"接收者的票主"。
        // 未委托时票主就是本人，因此一条规则同时覆盖四种组合：
        //   未→未 / 已→未 / 未→已 / 已→已（srcDel==dstDel 时自动跳过）
        _moveVotes(_voteOwner(from), _voteOwner(to), amount);
    }

    // ── 委托 ──
    function delegate(address to) external {
        require(to != address(0), "zero delegatee");
        address account = msg.sender;
        address current = delegates[account];
        address newCurrent = to;
        if (current == address(0)) current = account; // 从未委托：票在自己头上
        if (newCurrent == current) return;            // 幂等：自委托直接返回
        uint256 balance = balanceOf[account];
        if (balance > 0) _moveVotes(current, newCurrent, balance);
        delegates[account] = to;
        emit DelegateChanged(account, current, to);
    }

    function _writeCheckpoint(address delegatee, uint256 oldVotes, uint256 newVotes) internal {
        Checkpoint[] storage cps = _checkpoints[delegatee];
        uint256 n = cps.length;
        if (n > 0 && cps[n - 1].fromBlock == block.number) {
            cps[n - 1].votes = newVotes; // 同一块内多次变更：覆盖
        } else {
            cps.push(Checkpoint(block.number, newVotes));
        }
        emit DelegateVotesChanged(delegatee, oldVotes, newVotes);
    }

    function numCheckpoints(address a) external view returns (uint256) {
        return _checkpoints[a].length;
    }

    function getCurrentVotes(address a) public view returns (uint256) {
        uint256 n = _checkpoints[a].length;
        return n == 0 ? 0 : _checkpoints[a][n - 1].votes;
    }

    /// @notice 历史投票权（提案快照用）：二分查找 <= blockNumber 的最后一个检查点
    function getPriorVotes(address a, uint256 blockNumber) public view returns (uint256) {
        require(blockNumber < block.number, "not yet determined"); // 只能查已成历史的区块
        uint256 n = _checkpoints[a].length;
        if (n == 0) return 0;
        Checkpoint storage newest = _checkpoints[a][n - 1];
        if (newest.fromBlock <= blockNumber) return newest.votes;
        if (_checkpoints[a][0].fromBlock > blockNumber) return 0;
        uint256 lower = 0;
        uint256 upper = n - 1;
        while (upper > lower) {
            uint256 center = upper - (upper - lower) / 2; // 向上取中，避免死循环
            Checkpoint storage cp = _checkpoints[a][center];
            if (cp.fromBlock == blockNumber) return cp.votes;
            if (cp.fromBlock < blockNumber) lower = center;
            else upper = center - 1;
        }
        return _checkpoints[a][lower].votes;
    }
}

// ════════════════════════════════════════════════════════
// 2) Timelock：所有治理动作必须排队等够最短延迟
// ════════════════════════════════════════════════════════
contract LabTimelock {
    address public admin;
    uint256 public delay; // 排队后最早可执行的等待秒数
    uint256 public constant GRACE_PERIOD = 1 days; // 到期后再不执行就作废

    mapping(bytes32 => uint256) public queued; // txHash → 可执行时间戳 eta

    event NewAdmin(address indexed newAdmin);
    event Queued(bytes32 indexed txHash, address target, uint256 value, bytes data, uint256 eta);
    event Executed(bytes32 indexed txHash, address target, uint256 value, bytes data, uint256 eta);
    event Canceled(bytes32 indexed txHash);

    constructor(address _admin, uint256 _delay) {
        admin = _admin;
        delay = _delay;
    }

    // 教学简化：admin 直接换手（真实 Timelock 换手自己也要排队走一遍延迟自举）
    function setAdmin(address newAdmin) external {
        require(msg.sender == admin, "!admin");
        admin = newAdmin;
        emit NewAdmin(newAdmin);
    }

    function txHashOf(address target, uint256 value, bytes calldata data) public pure returns (bytes32) {
        return keccak256(abi.encode(target, value, data));
    }

    function queueAction(address target, uint256 value, bytes calldata data, uint256 eta)
        external
        returns (bytes32)
    {
        require(msg.sender == admin, "!admin");
        require(eta >= block.timestamp + delay, "eta violates delay");
        bytes32 h = txHashOf(target, value, data);
        require(queued[h] == 0, "already queued");
        queued[h] = eta;
        emit Queued(h, target, value, data, eta);
        return h;
    }

    function cancelAction(address target, uint256 value, bytes calldata data) external {
        require(msg.sender == admin, "!admin");
        bytes32 h = txHashOf(target, value, data);
        require(queued[h] != 0, "not queued");
        queued[h] = 0;
        emit Canceled(h);
    }

    function executeAction(address target, uint256 value, bytes calldata data)
        external
        payable
        returns (bytes memory)
    {
        require(msg.sender == admin, "!admin");
        bytes32 h = txHashOf(target, value, data);
        uint256 eta = queued[h];
        require(eta != 0, "not queued");
        require(block.timestamp >= eta, "timelock not matured");
        require(block.timestamp <= eta + GRACE_PERIOD, "tx expired");
        queued[h] = 0;

        (bool ok, bytes memory ret) = target.call{value: value}(data);
        require(ok, "action call failed");
        emit Executed(h, target, value, data, eta);
        return ret;
    }
}

// ════════════════════════════════════════════════════════
// 3) Governor：提案 → 快照计票 → 排队 → 执行
// ════════════════════════════════════════════════════════
contract LabGovernor {
    // OZ 状态码：0 Pending 1 Active 2 Canceled 3 Defeated 4 Succeeded 5 Queued 6 Expired 7 Executed
    string public constant VERSION = "lab-governor-1";

    address public voteToken;
    address public timelock;
    address public guardian; // setup 时的部署者：setVotingPeriod 专用（Timelock admin 已交给 Governor）
    uint256 public votingPeriod;   // 投票窗口秒数（教学用时间戳）
    uint256 public quorumVotes;    // 法定票数
    uint256 public proposalThreshold; // 提案门槛票

    struct Receipt {
        bool hasVoted;
        uint8 support; // 0 反对 1 赞成 2 弃权
        uint256 votes;
    }
    struct Proposal {
        address proposer;
        address target;
        uint256 value;
        bytes data;
        uint256 snapshotBlock;
        uint256 deadline;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        bool queued;
        bool executed;
        bool canceled;
        string description;
    }

    uint256 public proposalCount;
    mapping(uint256 => Proposal) private _proposals;
    mapping(uint256 => mapping(address => Receipt)) public receipts;

    event ProposalCreated(
        uint256 indexed id,
        address indexed proposer,
        address target,
        uint256 value,
        bytes data,
        uint256 snapshotBlock,
        uint256 deadline,
        string description
    );
    event VoteCast(address indexed voter, uint256 indexed proposalId, uint8 support, uint256 votes);
    event ProposalQueued(uint256 indexed id, uint256 eta);
    event ProposalExecuted(uint256 indexed id);
    event ProposalCanceled(uint256 indexed id);

    constructor(
        address _voteToken,
        address _timelock,
        uint256 _votingPeriod,
        uint256 _quorumVotes,
        uint256 _proposalThreshold
    ) {
        voteToken = _voteToken;
        timelock = _timelock;
        guardian = msg.sender;
        votingPeriod = _votingPeriod;
        quorumVotes = _quorumVotes;
        proposalThreshold = _proposalThreshold;
    }

    // 教学辅助：部署者（guardian）可延长投票窗口，
    // 便于课堂上"部署→造选民→提案"跨多步操作时窗口不过期。
    // 注意：Timelock 的 admin 在 setup 时已转给 Governor，所以这里用 guardian 而非 admin
    function setVotingPeriod(uint256 _votingPeriod) external {
        require(msg.sender == guardian, "!guardian");
        votingPeriod = _votingPeriod;
    }

    function propose(
        address target,
        uint256 value,
        bytes calldata data,
        string calldata description
    ) external returns (uint256) {
        require(target != address(0), "bad target");
        require(data.length > 0, "empty action");
        uint256 pv = LabVoteToken(voteToken).getCurrentVotes(msg.sender);
        require(pv >= proposalThreshold, "proposer below threshold");
        proposalCount += 1;
        uint256 id = proposalCount;
        _proposals[id] = Proposal({
            proposer: msg.sender,
            target: target,
            value: value,
            data: data,
            snapshotBlock: block.number - 1,       // 票数以提案前一区块的历史持股为准（getPriorVotes 要求 < 当前块）
            deadline: block.timestamp + votingPeriod,
            forVotes: 0,
            againstVotes: 0,
            abstainVotes: 0,
            queued: false,
            executed: false,
            canceled: false,
            description: description
        });
        emit ProposalCreated(id, msg.sender, target, value, data, block.number, block.timestamp + votingPeriod, description);
        return id;
    }

    function castVote(uint256 id, uint8 support) external {
        require(id > 0 && id <= proposalCount, "bad id");
        require(support <= 2, "bad support");
        Proposal storage p = _proposals[id];
        require(!p.canceled, "canceled");
        require(block.timestamp <= p.deadline, "vote closed");
        Receipt storage r = receipts[id][msg.sender];
        require(!r.hasVoted, "already voted");
        // 快照计票：委托必须发生在提案区块之前，防"临投票前买票"
        uint256 votes = LabVoteToken(voteToken).getPriorVotes(msg.sender, p.snapshotBlock);
        // 与真实 Compound 的 require(votes>0) 不同：votes==0 也允许记录（计 0 票），
        // 让"没票的人来投票"这种场景可观察、不炸回执，便于课堂对比。
        if (support == 0) p.againstVotes += votes;
        else if (support == 1) p.forVotes += votes;
        else p.abstainVotes += votes;
        r.hasVoted = true;
        r.support = support;
        r.votes = votes;
        emit VoteCast(msg.sender, id, support, votes);
    }

    function state(uint256 id) public view returns (uint8) {
        Proposal storage p = _proposals[id];
        require(id > 0 && id <= proposalCount, "bad id");
        if (p.canceled) return 2;
        if (p.executed) return 7;
        if (block.timestamp <= p.deadline) return 1; // Active（教学版省略 Pending）
        bool quorumOk = p.forVotes + p.abstainVotes >= quorumVotes;
        bool voteOk = p.forVotes > p.againstVotes;
        if (!quorumOk || !voteOk) return 3; // Defeated
        if (!p.queued) return 4;            // Succeeded，等待 queue
        bytes32 h = keccak256(abi.encode(p.target, p.value, p.data));
        uint256 eta = LabTimelock(timelock).queued(h);
        if (eta == 0) return 6;
        if (block.timestamp <= eta + LabTimelock(timelock).GRACE_PERIOD()) return 5; // Queued
        return 6; // Expired
    }

    function queue(uint256 id) external {
        require(state(id) == 4, "not succeeded");
        Proposal storage p = _proposals[id];
        uint256 eta = block.timestamp + LabTimelock(timelock).delay();
        LabTimelock(timelock).queueAction(p.target, p.value, p.data, eta);
        p.queued = true;
        emit ProposalQueued(id, eta);
    }

    function execute(uint256 id) external payable {
        require(state(id) == 5, "not queued or matured");
        Proposal storage p = _proposals[id];
        p.executed = true; // 先置位防重入
        LabTimelock(timelock).executeAction{value: p.value}(p.target, p.value, p.data);
        emit ProposalExecuted(id);
    }

    function cancel(uint256 id) external {
        Proposal storage p = _proposals[id];
        require(msg.sender == p.proposer, "only proposer");
        require(!p.executed, "executed");
        p.canceled = true;
        if (p.queued) {
            LabTimelock(timelock).cancelAction(p.target, p.value, p.data);
        }
        emit ProposalCanceled(id);
    }

    // ── 扁平化只读视图（前端一次 eth_call 解码；拆两个避免 stack too deep）──
    function proposalHead(uint256 id)
        external
        view
        returns (
            address proposer,
            address target,
            uint256 value,
            uint256 snapshotBlock,
            uint256 deadline
        )
    {
        Proposal storage p = _proposals[id];
        return (p.proposer, p.target, p.value, p.snapshotBlock, p.deadline);
    }

    function proposalVotes(uint256 id)
        external
        view
        returns (
            uint256 forVotes,
            uint256 againstVotes,
            uint256 abstainVotes,
            uint256 st,
            bool queued,
            bool executed
        )
    {
        Proposal storage p = _proposals[id];
        return (p.forVotes, p.againstVotes, p.abstainVotes, state(id), p.queued, p.executed);
    }

    function proposalData(uint256 id) external view returns (bytes memory) {
        return _proposals[id].data;
    }

    function proposalDescription(uint256 id) external view returns (string memory) {
        return _proposals[id].description;
    }
}

// ════════════════════════════════════════════════════════
// 4) Box：受治理控制的演示资产（金库参数/协议开关的替身）
// ════════════════════════════════════════════════════════
contract LabBox {
    address public owner;
    uint256 public value;

    event NewValue(uint256 newValue, address indexed by);
    event OwnershipTransferred(address indexed previous, address indexed current);

    constructor() {
        owner = msg.sender;
    }

    function setValue(uint256 newValue) external {
        require(msg.sender == owner, "!owner");
        value = newValue;
        emit NewValue(newValue, msg.sender);
    }

    function transferOwnership(address newOwner) external {
        require(msg.sender == owner, "!owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    receive() external payable {}
}
