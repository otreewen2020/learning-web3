// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// 最小版 ERC20：映射代币（跨链桥在"目标链"发行的资产凭证）
contract LabBridgedToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    address public issuer;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
        issuer = msg.sender;
    }

    /// 教学用：发行方（部署者）给指定地址灌一点映射币，模拟桥的另一侧流动性初始化
    function mintTo(address to, uint256 amount) external {
        require(msg.sender == issuer, "!issuer");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "!allowance");
        require(balanceOf[from] >= amount, "insufficient");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

/// 跨链桥：锁仓 + 映射发行（同链双合约模拟"两侧"，真实桥是两条链各一份）
///
/// 教学核心：桥不创造资产，只做"锁一 peg 一"。
///   源链（A 侧）：用户 deposit() 把真币锁进金库 → 事件 DepositInitiated
///   验证者（离线链下）：观察源链事件，各自对 (nonce, 收款人, 金额) 签名
///   目标链（B 侧）：relayer 收齐 QUORUM 个签名 → confirmMint() → 映射代币铸给收款人
///   回程：收款人在 B 侧 unlock() 烧掉映射币 → 事件 WithdrawalInitiated
///         → A 侧 confirmUnlock() 从金库放还真币
///
/// 安全模型：签名阈值 = 验证者集合的诚实多数。签名用 EIP-191
/// 个人签名（"0x19 personal-sign"），链上 ecrecover 校验——
/// 这是 Optimism/Arbitrum 早期 L1↔L2 桥、Multichain 等方案的骨架。
contract LabBridgeVault {
    // ── 最小权限（AccessControl 思想）──
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE"); // 提交签名集合
    bytes32 public constant FUNDER_ROLE = keccak256("FUNDER_ROLE");   // 补充 B 侧映射币流动性
    mapping(bytes32 => mapping(address => bool)) private _roles;
    address public owner;

    mapping(address => bool) public validators;   // 验证者白名单
    uint256 public validatorCount;
    uint256 public quorum;                        // 放行所需签名数

    event RoleGranted(bytes32 indexed role, address indexed account);

    modifier onlyRole(bytes32 role) {
        require(_roles[role][msg.sender], "!role");
        _;
    }

    function grantRole(bytes32 role, address account) external {
        require(msg.sender == owner, "!owner");
        _roles[role][account] = true;
        emit RoleGranted(role, account);
    }

    function hasRole(bytes32 role, address account) external view returns (bool) {
        return _roles[role][account];
    }

    // ── 锁仓金库 ──
    LabBridgedToken public pegToken;              // 本链映射代币（B 侧部署用，A 侧可留空）
    uint256 public lockedTotal;                   // 金库累计锁仓
    uint256 public nextNonce = 1;                 // 全局递增单号（防重放）

    struct Deposit {
        address recipient;
        uint256 amount;
        bool minted;     // B 侧：是否已放行
        bool withdrawn;  // A 侧：是否已被领回
    }
    mapping(uint256 => Deposit) public deposits;

    // 已消费签名防重放：同一 nonce 的放行只能执行一次（minted 已挡，
    // 这里再加一层"签名集合只用于本 nonce"的语义约束由 require 完成）

    event DepositInitiated(uint256 indexed nonce, address indexed depositor, address indexed recipient, uint256 amount);
    event MintConfirmed(uint256 indexed nonce, address indexed recipient, uint256 amount);
    event WithdrawalInitiated(uint256 indexed nonce, address indexed sender, address indexed recipient, uint256 amount);
    event UnlockConfirmed(uint256 indexed nonce, address indexed recipient, uint256 amount);
    event ValidatorSet(address indexed validator, bool added);
    event PausedSet(bool paused);

    bool public paused;

    modifier notPaused() {
        require(!paused, "bridge paused");
        _;
    }

    /// 放行所需签名数（构造参数传 0 时走默认多数派）
    function _pickQuorum(address[] memory _validators, uint256 _q) internal pure returns (uint256) {
        return _q > 0 ? _q : (_validators.length / 2 + 1);
    }

    constructor(address[] memory _validators, uint256 _quorum) {
        require(_validators.length > 0, "need validators");
        owner = msg.sender;
        // 部署者默认拿双角色：教学环境一个前端账户兼任 relayer/funder，
        // 真实桥是不同团队的不同机器
        _roles[RELAYER_ROLE][msg.sender] = true;
        _roles[FUNDER_ROLE][msg.sender] = true;
        emit RoleGranted(RELAYER_ROLE, msg.sender);
        emit RoleGranted(FUNDER_ROLE, msg.sender);
        quorum = _pickQuorum(_validators, _quorum);
        for (uint256 i = 0; i < _validators.length; i++) {
            validators[_validators[i]] = true;
            validatorCount += 1;
            emit ValidatorSet(_validators[i], true);
        }
    }

    function setPaused(bool p) external {
        require(msg.sender == owner, "!owner");
        paused = p;
        emit PausedSet(p);
    }

    // ── A 侧（源链）：锁仓 ──
    /// 用户把真 ETH 锁进金库，指定目标链接收人
    function deposit(address recipient) external payable notPaused {
        require(msg.value > 0, "need value");
        uint256 nonce = nextNonce++;
        deposits[nonce] = Deposit(recipient, msg.value, false, false);
        lockedTotal += msg.value;
        emit DepositInitiated(nonce, msg.sender, recipient, msg.value);
    }

    /// 放还真币：B 侧烧币后，A 侧 confirmUnlock 打款给收款人
    /// （同链双合约模拟：A 侧金库看不到 B 侧 unlock 的 deposits，
    ///   收款人/金额由调用方随签名带上，由签名背书）
    function confirmUnlock(uint256 nonce, address recipient, uint256 amount, bytes[] calldata sigs) external notPaused {
        require(amount > 0, "amount 0");
        require(!_unlocked[nonce], "already unlocked");
        _verifySigs(nonce, recipient, amount, sigs);
        _unlocked[nonce] = true;
        if (lockedTotal >= amount) lockedTotal -= amount;
        (bool ok, ) = payable(recipient).call{value: amount}("");
        require(ok, "send failed");
        emit UnlockConfirmed(nonce, recipient, amount);
    }

    mapping(uint256 => bool) private _unlocked; // 同一回程单号只能放还一次（防重放）

    // ── B 侧（目标链）：映射发行与回收 ──
    /// 挂映射代币（仅 owner，部署后 setup）
    function attachPegToken(address token) external {
        require(msg.sender == owner, "!owner");
        require(address(pegToken) == address(0), "already attached");
        pegToken = LabBridgedToken(token);
    }

    /// relayer 提交验证者签名集合，放行映射币铸给收款人
    /// （同链双合约模拟：B 侧金库看不到 A 侧的 deposits，
    ///   所以收款人/金额由调用方随签名一起带上，由签名本身背书）
    function confirmMint(uint256 nonce, address recipient, uint256 amount, bytes[] calldata sigs) external notPaused {
        require(amount > 0, "amount 0");
        require(!_minted[nonce], "already minted");
        _verifySigs(nonce, recipient, amount, sigs);
        _minted[nonce] = true;
        // 映射币走"流动性池"模型：桥的 peg 余额转给收款人（余额由 funder 预先灌入）
        require(pegToken.transfer(recipient, amount), "peg transfer failed");
        emit MintConfirmed(nonce, recipient, amount);
    }

    mapping(uint256 => bool) private _minted; // 同一单号只能放行一次（防重放）

    /// B 侧流动性：桥自身没有 mint 权——映射币由 funder 角色转入
    /// （真实桥的 peg 代币发行方 = 桥合约本身或治理金库，这里用转入演示
    ///   "映射币的总量由源链锁仓量背书"这一不变式）
    function fundPeg(uint256 amount) external onlyRole(FUNDER_ROLE) {
        require(address(pegToken) != address(0), "no peg token");
        require(pegToken.transferFrom(msg.sender, address(this), amount), "fund failed");
    }

    /// 回程：目标链用户把映射币烧掉（转给桥后由桥确认放真币）
    /// 注意 transferFrom 需要收款人先 approve 桥地址
    function unlock(address recipient) external notPaused {
        require(address(pegToken) != address(0), "no peg token");
        uint256 bal = pegToken.balanceOf(msg.sender);
        require(bal > 0, "nothing to unlock");
        uint256 nonce = nextNonce++;
        deposits[nonce] = Deposit(recipient, bal, false, false);
        require(pegToken.transferFrom(msg.sender, address(this), bal), "burn failed");
        emit WithdrawalInitiated(nonce, msg.sender, recipient, bal);
    }

    // ── 签名校验 ──
    /// 消息 = keccak256(abi.encode(nonce, recipient, amount)) 的 EIP-191 签名
    function messageHash(uint256 nonce, address recipient, uint256 amount) public pure returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(nonce, recipient, amount));
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", structHash));
    }

    /// @dev 从 calldata 中读取 bytes[] 第 i 个元素（65 字节签名）的 r/s/v。
    ///      Solidity 0.8：内联汇编里 calldata 动态数组变量名直接求值 =
    ///      元素区起始的绝对 calldata 偏移（跳过长度字）；
    ///      head_i @ p+32i = 元素体相对 p 的偏移；元素体首字 = 长度，
    ///      随后 65 字节签名 + 补零（r 在 +32，s 在 +64，v 在 +96 的末字节）。
    function _sigAt(bytes[] calldata sigs, uint256 i)
        internal pure returns (bytes32 r, bytes32 s, uint8 v)
    {
        assembly {
            // p = 元素区起始（绝对 calldata 偏移）：4(选择器) + sigs 头值 + 32(跳过长度字)
            let p := add(36, calldataload(100))
            let ptr := add(p, calldataload(add(p, mul(i, 32))))
            r := calldataload(add(ptr, 32))
            s := calldataload(add(ptr, 64))
            // 第 4 字（ptr+96）= v || 31 字节补零（65 字节签名尾部）→ v 是 byte(0)
            v := byte(0, calldataload(add(ptr, 96)))
        }
    }

    /// 收齐 quorum 个不同验证者的有效签名
    /// （签名集合按签名者地址升序，去重；同一签名只能用一次，防重放）
    mapping(bytes32 => bool) private _usedSigs;

    function _verifySigs(uint256 nonce, address recipient, uint256 amount, bytes[] calldata sigs) internal {
        require(sigs.length >= quorum, "not enough signatures");
        require(!paused, "bridge paused");
        bytes32 h = messageHash(nonce, recipient, amount);
        address last = address(0);
        for (uint256 i = 0; i < sigs.length; i++) {
            require(sigs[i].length == 65, "bad sig length");
            bytes32 sh = keccak256(sigs[i]);
            require(!_usedSigs[sh], "sig already used");
            _usedSigs[sh] = true;
            (bytes32 r, bytes32 s, uint8 v) = _sigAt(sigs, i);
            address signer = ecrecover(h, v, r, s);
            require(validators[signer], "!validator");
            require(signer > last, "sigs must be unique & ascending by signer address");
            last = signer;
        }
    }

    // ── 只读查询 ──
    function depositInfo(uint256 nonce)
        external view returns (address recipient, uint256 amount, bool minted, bool withdrawn)
    {
        Deposit storage d = deposits[nonce];
        return (d.recipient, d.amount, d.minted, d.withdrawn);
    }
}
