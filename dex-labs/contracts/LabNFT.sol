// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title LabNFT —— 教学用手写 ERC-721（精简版）
/// @notice 演示 NFT 的核心：tokenId 全局唯一、ownerOf 确权、tokenURI 元数据、
///         approve / transferFrom 授权转手。
///         本环境约束：evmVersion london（禁 PUSH0）、避开 ** 幂运算。
contract LabNFT {
    string public name;
    string public symbol;
    uint256 public nextTokenId = 1;   // tokenId 从 1 开始，全局唯一自增
    address public admin;             // 部署者（教学演示用）

    mapping(uint256 => address) private _owners;            // tokenId -> 持有人
    mapping(address => uint256) public balanceOf;           // 地址 -> 持有数量
    mapping(uint256 => address) public getApproved;         // 单枚授权
    mapping(address => mapping(address => bool)) public isApprovedForAll; // 全量授权
    mapping(uint256 => string) private _tokenURIs;          // tokenId -> 元数据

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
        admin = msg.sender;
    }

    /// @notice 铸造：任何人可铸，tokenId 自增分配
    function mint(address to, string memory uri) public returns (uint256) {
        require(to != address(0), "mint to zero");
        uint256 id = nextTokenId;
        nextTokenId = id + 1;
        _tokenURIs[id] = uri;
        _owners[id] = to;
        balanceOf[to] += 1;
        emit Transfer(address(0), to, id);   // from = 0 表示铸造
        return id;
    }

    /// @notice 链上确权：查 tokenId 的持有人
    function ownerOf(uint256 tokenId) public view returns (address) {
        require(_owners[tokenId] != address(0), "token not exist");
        return _owners[tokenId];
    }

    /// @notice 元数据：查 tokenId 的 URI
    function tokenURI(uint256 tokenId) public view returns (string memory) {
        require(_owners[tokenId] != address(0), "token not exist");
        return _tokenURIs[tokenId];
    }

    /// @notice 单枚授权：允许 spender 转走这一枚
    function approve(address spender, uint256 tokenId) public {
        address o = _owners[tokenId];
        require(o == msg.sender || isApprovedForAll[o][msg.sender], "not owner");
        getApproved[tokenId] = spender;
        emit Approval(o, spender, tokenId);
    }

    /// @notice 全量授权：允许 operator 操作名下全部 NFT（挂交易市场用）
    function setApprovalForAll(address operator, bool ok) public {
        isApprovedForAll[msg.sender][operator] = ok;
        emit ApprovalForAll(msg.sender, operator, ok);
    }

    /// @notice 转手：持有人或被授权者调用
    function transferFrom(address from, address to, uint256 tokenId) public {
        require(_owners[tokenId] == from, "wrong from");
        require(
            from == msg.sender ||
            getApproved[tokenId] == msg.sender ||
            isApprovedForAll[from][msg.sender],
            "not allowed"
        );
        require(to != address(0), "to zero");
        balanceOf[from] -= 1;
        balanceOf[to] += 1;
        _owners[tokenId] = to;
        delete getApproved[tokenId];         // 转手后旧授权失效
        emit Transfer(from, to, tokenId);
    }
}
