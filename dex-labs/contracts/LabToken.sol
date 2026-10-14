// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title LabToken —— 教学用 ERC-20 代币
/// @notice 手写完整 ERC-20 实现（不用 OpenZeppelin），便于逐行学习
/// @dev 对应《智能合约入门指南.md》第 3 章"代币"类别，阶段 1
///      踩坑记录：构造函数避免非字面量参数（如 uint8 转 uint256 的表达式），
///      否则生成的字节码在本链上执行会耗尽 gas（详见本目录 README）。
contract LabToken {
    string public constant name = "Lab Token";
    string public constant symbol = "LAB";
    uint8 public constant decimals = 18;

    uint256 public totalSupply;

    mapping(address => uint256) private _balances;
    // owner -> spender -> 额度（ERC-20 的授权机制，DEX/借贷都依赖它）
    mapping(address => mapping(address => uint256)) private _allowances;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @param initialSupply 发行总量（单位：个币，非 wei；全部发给部署者）
     */
    constructor(uint256 initialSupply) {
        // 10**18 写成字面量，避免运行时计算与类型转换
        _mint(msg.sender, initialSupply * 1000000000000000000);
    }

    // ─── ERC-20 必选 6 函数 ───────────────────────────────

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 value) public returns (bool) {
        require(to != address(0), "LAB: transfer to zero");
        _transfer(msg.sender, to, value);
        return true;
    }

    function allowance(address owner, address spender) public view returns (uint256) {
        return _allowances[owner][spender];
    }

    /// @notice 授权 spender 可以从自己账户代扣最多 value
    function approve(address spender, uint256 value) public returns (bool) {
        require(spender != address(0), "LAB: approve to zero");
        _allowances[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    /// @notice 由 spender 代发：从 owner 账户扣钱转给 to
    /// @dev 这是 DEX 能"拿走你的币"、借贷协议能"划走抵押品"的根基
    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        require(to != address(0), "LAB: transfer to zero");
        uint256 allowed = _allowances[from][msg.sender];
        require(allowed >= value, "LAB: insufficient allowance");
        if (allowed != type(uint256).max) {
            _allowances[from][msg.sender] = allowed - value;
        }
        _transfer(from, to, value);
        return true;
    }

    // ─── 内部工具 ────────────────────────────────────────

    function _transfer(address from, address to, uint256 value) internal {
        uint256 fromBalance = _balances[from];
        require(fromBalance >= value, "LAB: insufficient balance");
        unchecked {
            _balances[from] = fromBalance - value;
        }
        _balances[to] += value;
        emit Transfer(from, to, value);
    }

    function _mint(address to, uint256 value) internal {
        totalSupply += value;
        _balances[to] += value;
        emit Transfer(address(0), to, value);
    }
}
