// 通用可配置 ERC-20 —— 网页发币用的合约模板
// 注意：名称/符号由构造函数传入（存储变量而非常量，编译一次即可发任意币）
// 已避开本环境的坑：不用 ** 幂运算、构造函数保持简单算术
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract LabFactoryToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;

    uint256 public totalSupply;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint256 _supply) {
        name = _name;
        symbol = _symbol;
        _mint(msg.sender, _supply * 1000000000000000000);
    }

    function balanceOf(address a) public view returns (uint256) { return _balances[a]; }
    function allowance(address o, address s) public view returns (uint256) { return _allowances[o][s]; }

    function transfer(address to, uint256 v) public returns (bool) {
        require(to != address(0), "to zero");
        _transfer(msg.sender, to, v);
        return true;
    }

    function approve(address spender, uint256 v) public returns (bool) {
        _allowances[msg.sender][spender] = v;
        emit Approval(msg.sender, spender, v);
        return true;
    }

    function transferFrom(address from, address to, uint256 v) public returns (bool) {
        uint256 allowed = _allowances[from][msg.sender];
        require(allowed >= v, "allowance");
        if (allowed != type(uint256).max) _allowances[from][msg.sender] = allowed - v;
        _transfer(from, to, v);
        return true;
    }

    function _transfer(address from, address to, uint256 v) internal {
        require(_balances[from] >= v, "balance");
        unchecked { _balances[from] -= v; }
        _balances[to] += v;
        emit Transfer(from, to, v);
    }

    function _mint(address to, uint256 v) internal {
        totalSupply += v;
        _balances[to] += v;
        emit Transfer(address(0), to, v);
    }
}
