// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// 教学用链上赌场：固定赔率 Dice + blockhash 延迟开奖
///
/// 核心教学点：
/// 1. 链上没有真随机——blockhash(block.number) 在【当前块】永远为 0
///    （EVM 只保留最近 256 个区块哈希，本区块的哈希要等下一块才能算出），
///    block.timestamp / coinbase / difficulty 都可被出块者操纵。
///    教学版方案：下注时把"未来某块的哈希"承诺为种子，开奖时兑现——
///    玩家下注时庄家（出块者）也无法预知该哈希。
/// 2. 延迟开奖（commit-reveal 的简化版）：bet 锁定 seedBlock，
///    reveal 在 seedBlock 之后才可执行，seed = uint(blockhash(seedBlock)) % 100。
/// 3. 固定赔率与抽水：押中区间赔率 payout 倍（含本金），庄家抽水走
///    概率优势（house edge），余额不足时 reveal 直接失败，赌池透明。
///
/// 玩法（Dice）：0-99 均匀分布，玩家下注猜一个区间：
///   0=solo 小于 50（50% 概率，赔率 198/100，庄家优势 1%）
///   1=pair 大于等于 50（50% 概率，赔率 196/100，庄家优势 2%）
///   2=exact 恰好等于 exactNumber（1% 概率，赔率 9000/100，庄家优势 10%）
/// 教学演示赔率与概率的关系；真实产品必须用 Chainlink VRF 等可验证随机。
contract LabCasino {
    address public owner;
    bool public paused;

    // 赔率分母 100：198 = 押 1 ETH 返 1.98 ETH（含本金）
    uint256 public constant ODDS_SOLO = 198;
    uint256 public constant ODDS_PAIR = 196;
    uint256 public constant ODDS_EXACT = 9000;
    uint256 public constant MIN_BET = 0.01 ether;

    uint256 public houseEdgeFees; // 累计抽水（本教学版抽水=负概率差，不单独扣）
    uint256 public totalBets;
    uint256 public totalPaid;

    struct Bet {
        address player;
        uint256 amount;
        uint8 choice;     // 0 solo / 1 pair / 2 exact
        uint8 exactGuess; // choice==2 时的猜测数字 0-99
        uint256 seedBlock; // 承诺的开奖区块（下注块 + SEED_DELAY）
        bool revealed;
        bool won;
    }
    uint256 public constant SEED_DELAY = 3; // 3 个区块后开奖（45 秒）
    uint256 public nextId = 1;
    mapping(uint256 => Bet) public bets;

    event BetPlaced(uint256 indexed id, address indexed player, uint8 choice, uint8 exactGuess, uint256 amount, uint256 seedBlock);
    event BetRevealed(uint256 indexed id, address indexed player, uint256 result, bool won, uint256 payout);
    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event PausedSet(bool paused);

    modifier notPaused() {
        require(!paused, "casino paused");
        _;
    }

    constructor() payable {
        owner = msg.sender;
        // 部署即开池：教学环境庄家初始资金由前端注入（真实赌场另有序则）
    }

    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    function setPaused(bool p) external {
        require(msg.sender == owner, "!owner");
        paused = p;
        emit PausedSet(p);
    }

    /// 庄家提款（只能提走当前空闲资金——真实赌场有准备金模型，教学从简）
    function withdraw(uint256 amount) external {
        require(msg.sender == owner, "!owner");
        require(address(this).balance >= amount, "insufficient house");
        (bool ok, ) = payable(owner).call{value: amount}("");
        require(ok, "send failed");
        emit Withdrawn(owner, amount);
    }

    /// 下注。choice: 0 = 开小(<50), 1 = 开大(>=50), 2 = 押中 exactGuess
    function bet(uint8 choice, uint8 exactGuess) external payable notPaused {
        require(msg.value >= MIN_BET, "min bet 0.01 ETH");
        require(choice <= 2, "bad choice");
        if (choice == 2) require(exactGuess < 100, "guess 0-99");
        uint256 id = nextId++;
        bets[id] = Bet({
            player: msg.sender,
            amount: msg.value,
            choice: choice,
            exactGuess: exactGuess,
            seedBlock: block.number + SEED_DELAY,
            revealed: false,
            won: false
        });
        totalBets += 1;
        emit BetPlaced(id, msg.sender, choice, exactGuess, msg.value, block.number + SEED_DELAY);
    }

    /// 开奖：必须在 seedBlock 之后（seedBlock 已成历史，blockhash 才可读）
    function reveal(uint256 id) external notPaused {
        Bet storage b = bets[id];
        require(b.player != address(0), "no bet");
        require(!b.revealed, "revealed");
        require(block.number > b.seedBlock, "seed not ready");
        bytes32 h = blockhash(b.seedBlock);
        require(uint256(h) != 0, "hash unavailable"); // 超 256 区块旧哈希为 0
        uint256 result = uint256(h) % 100;

        bool won;
        uint256 odds;
        if (b.choice == 0) {
            won = result < 50;
            odds = ODDS_SOLO;
        } else if (b.choice == 1) {
            won = result >= 50;
            odds = ODDS_PAIR;
        } else {
            won = result == b.exactGuess;
            odds = ODDS_EXACT;
        }
        b.revealed = true;
        b.won = won;

        uint256 payout = 0;
        if (won) {
            payout = (b.amount * odds) / 100;
            require(address(this).balance >= payout, "house broke");
            totalPaid += payout;
            (bool ok, ) = payable(b.player).call{value: payout}("");
            require(ok, "payout failed");
        } else {
            houseEdgeFees += b.amount;
        }
        emit BetRevealed(id, b.player, result, won, payout);
    }

    // ── 只读查询（前端展示用）──
    function betInfo(uint256 id)
        external
        view
        returns (
            address player,
            uint256 amount,
            uint8 choice,
            uint8 exactGuess,
            uint256 seedBlock,
            bool revealed,
            bool won,
            uint256 result,
            bool canReveal
        )
    {
        Bet storage b = bets[id];
        player = b.player;
        amount = b.amount;
        choice = b.choice;
        exactGuess = b.exactGuess;
        seedBlock = b.seedBlock;
        revealed = b.revealed;
        won = b.won;
        canReveal = !b.revealed && b.player != address(0) && block.number > b.seedBlock;
        if (revealed && seedBlock + 1 <= block.number && block.number <= seedBlock + 256) {
            result = uint256(blockhash(seedBlock)) % 100;
        }
    }

    function houseBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
