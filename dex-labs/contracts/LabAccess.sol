// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// 教学用最小版 AccessControl（对应 OZ 同名合约的骨架）
///
/// 核心思想：权限不是"一个 owner"，而是【角色 → 成员】的多对多关系。
///   - 每个角色是一个 bytes32 标识（OZ 用 keccak256("MINTER_ROLE")）；
///   - hasRole / grantRole / revokeRole 三件套；
///   - DEFAULT_ADMIN_ROLE 成员可以发放/回收其它角色；
///   - renounceRole 只能"放弃自己的"——防止恶意指令让别人丢掉权限。
contract LabAccessControl {
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    // internal（不是 private）：派生合约的构造函数要初始化自己的 ADMIN 成员
    mapping(bytes32 => mapping(address => bool)) internal _members;
    mapping(bytes32 => uint256) internal _memberCount;

    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    modifier onlyRole(bytes32 role) {
        require(_members[role][msg.sender], "access denied");
        _;
    }

    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _members[role][account];
    }

    /// 角色成员数（教学展示用；OZ 用 EnumerableSet 实现同类查询）
    function roleMemberCount(bytes32 role) external view returns (uint256) {
        return _memberCount[role];
    }

    function grantRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "zero address");
        if (!_members[role][account]) {
            _members[role][account] = true;
            _memberCount[role] += 1;
            emit RoleGranted(role, account, msg.sender);
        }
    }

    function revokeRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_members[role][account]) {
            _members[role][account] = false;
            _memberCount[role] -= 1;
            emit RoleRevoked(role, account, msg.sender);
        }
    }

    /// 放弃自己的角色——只能对自己执行（OZ 里这是防钓鱼的关键设计）
    function renounceRole(bytes32 role, address account) external {
        require(account == msg.sender, "can only renounce self");
        if (_members[role][account]) {
            _members[role][account] = false;
            _memberCount[role] -= 1;
            emit RoleRevoked(role, account, msg.sender);
        }
    }
}

/// 受控合约示例：白名单 mint + 角色暂停
///
/// 教学点：owner 独裁（LabCasino 的 paused 只有 owner 能切）升级为
/// 角色分工——MINTER 才能 mint、PAUSER 才能暂停、ADMIN 才能发角色。
/// 一个人可以兼任多个角色，但权限边界在合约里，不在人的自觉里。
contract LabVipToken is LabAccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    string public name = "Lab VIP Token";
    string public symbol = "VIP";
    uint8 public constant decimals = 18;

    uint256 public totalSupply;
    uint256 public mintedCount;
    bool public paused;
    mapping(address => uint256) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event PausedSet(bool paused);

    constructor() {
        // 部署者拿管理员角色，而不是"万能 owner"
        _members[DEFAULT_ADMIN_ROLE][msg.sender] = true;
        _memberCount[DEFAULT_ADMIN_ROLE] += 1;
        emit RoleGranted(DEFAULT_ADMIN_ROLE, msg.sender, msg.sender);
    }

    /// 只有 MINTER_ROLE 能铸币；暂停时全员免谈
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(!paused, "token paused");
        require(to != address(0), "zero address");
        totalSupply += amount;
        balanceOf[to] += amount;
        mintedCount += 1;
        emit Transfer(address(0), to, amount);
    }

    /// gas 金库入口：造员工前先给合约充值，再由 topup 分发给员工
    receive() external payable {
        emit Deposited(address(0), msg.value);
    }

    /// 员工借调：把 ADMIN 的 gas 转到【当前正在操作的员工】身上，
    /// 教学演示"权限与资金随岗位转移"。真实项目当然不会这样设计。
    /// （上一版"给自己转 gas"的死结：调用时 msg.sender 是 ADMIN，
    ///   钱回到 ADMIN，新员工永远没钱；ADMIN 角色转交后，
    ///   新员工以 ADMIN 身份再 topup 才有钱。）
    function topup(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(to != address(0), "zero address");
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "topup send failed");
        emit Deposited(to, amount);
    }

    event Deposited(address indexed from, uint256 amount);

    /// MINTER 或 PAUSER 都能恢复（真实项目通常只给 PAUSER，这里演示多角色重叠）
    function setPaused(bool p) external onlyRole(PAUSER_ROLE) {
        paused = p;
        emit PausedSet(p);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }
}
