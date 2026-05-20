// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║           PrivateStream NEAR — Solidity Smart Contract        ║
 * ║                                                               ║
 * ║  Deploy via Remix IDE: https://remix.ethereum.org             ║
 * ║  Compiler: Solidity 0.8.20                                    ║
 * ║  Network:  Any EVM testnet (Sepolia recommended)              ║
 * ╚═══════════════════════════════════════════════════════════════╝
 *
 * FEATURES:
 *  - One campaign per wallet address (enforced on-chain)
 *  - AES-256-GCM encrypted metadata CID stored on-chain
 *  - Automatic 90/10 payment split (creator / platform)
 *  - Revenue cap: $20 USD equivalent per campaign
 *  - Time-limited access windows per buyer
 *  - Sold-out enforcement: blocks new purchases after cap
 *  - Existing buyers retain access until expiry after sold-out
 *
 * REMIX DEPLOYMENT STEPS:
 *  1. Open https://remix.ethereum.org
 *  2. Create new file → paste this entire contract
 *  3. Compiler tab → select 0.8.20 → Enable optimization (200 runs)
 *  4. Deploy tab → select "Injected Provider - MetaMask"
 *  5. Connect MetaMask to Sepolia testnet
 *  6. Constructor args:
 *       _treasury    = your MetaMask address (receives 10% fees)
 *       _ethUsdPrice = 3000  (ETH price in USD, e.g. $3000)
 *  7. Click Deploy → confirm in MetaMask
 *  8. Copy the deployed contract address → paste into .env.local
 */

// ─── Interfaces ───────────────────────────────────────────────────────────────

/**
 * @dev Minimal ERC-20 interface for future token payment support.
 *      Currently unused — contract accepts native ETH only.
 */
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
}

// ─── Main Contract ────────────────────────────────────────────────────────────

contract PrivateStreamNEAR {

    // ─── Constants ────────────────────────────────────────────────────────────

    /// @dev Platform fee: 10% of every payment
    uint256 public constant PLATFORM_FEE_BPS = 1000; // basis points (1000 = 10%)

    /// @dev Revenue cap per campaign: $20 USD (in USD cents)
    uint256 public constant REVENUE_CAP_USD_CENTS = 2000; // $20.00

    /// @dev Minimum access duration: 1 hour
    uint256 public constant MIN_DURATION = 3600;

    /// @dev Maximum access duration: 30 days
    uint256 public constant MAX_DURATION = 30 days;

    /// @dev Minimum price: 0.0001 ETH
    uint256 public constant MIN_PRICE_WEI = 0.0001 ether;

    // ─── State Variables ──────────────────────────────────────────────────────

    /// @dev Contract owner (deployer)
    address public immutable owner;

    /// @dev Platform treasury address (receives 10% fees)
    address public treasury;

    /// @dev ETH/USD price in USD cents (e.g. 300000 = $3000.00)
    /// Updated by owner or oracle. Used for revenue cap calculation.
    uint256 public ethUsdCents;

    /// @dev Total campaigns created
    uint256 public totalCampaigns;

    /// @dev Total platform fees collected (in wei)
    uint256 public totalPlatformFees;

    // ─── Structs ──────────────────────────────────────────────────────────────

    struct Campaign {
        string  id;              // UUID v4 campaign identifier
        address creator;         // Creator's wallet address
        string  metadataCid;     // IPFS CID of AES-256-GCM encrypted metadata
        uint256 priceWei;        // Price per access in wei
        uint256 durationSeconds; // Access duration in seconds
        uint256 grossRevenueWei; // Total gross revenue collected
        uint256 purchaseCount;   // Number of purchases
        bool    active;          // Whether campaign accepts new purchases
        bool    soldOut;         // Whether revenue cap was reached
        uint256 createdAt;       // Unix timestamp of creation
        uint256 updatedAt;       // Unix timestamp of last update
    }

    // ─── Mappings ─────────────────────────────────────────────────────────────

    /// @dev campaignId => Campaign
    mapping(string => Campaign) public campaigns;

    /// @dev creator address => campaignId (enforces one campaign per wallet)
    mapping(address => string) public creatorCampaign;

    /// @dev keccak256(buyer, campaignId) => access expiry timestamp
    mapping(bytes32 => uint256) public accessExpiry;

    /// @dev txHash => processed (replay attack prevention)
    mapping(bytes32 => bool) public processedTx;

    // ─── Events ───────────────────────────────────────────────────────────────

    event CampaignCreated(
        string  indexed campaignId,
        address indexed creator,
        string  metadataCid,
        uint256 priceWei,
        uint256 durationSeconds,
        uint256 timestamp
    );

    event AccessPurchased(
        string  indexed campaignId,
        address indexed buyer,
        uint256 priceWei,
        uint256 expiresAt,
        uint256 creatorPayment,
        uint256 platformFee
    );

    event CampaignSoldOut(
        string  indexed campaignId,
        uint256 grossRevenueWei,
        uint256 grossRevenueUsdCents
    );

    event EthPriceUpdated(uint256 oldPriceCents, uint256 newPriceCents);

    event TreasuryUpdated(address oldTreasury, address newTreasury);

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "PrivateStream: caller is not owner");
        _;
    }

    modifier campaignExists(string calldata campaignId) {
        require(campaigns[campaignId].creator != address(0), "PrivateStream: campaign not found");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    /**
     * @param _treasury    Address that receives 10% platform fees
     * @param _ethUsdPrice Current ETH price in USD cents (e.g. 300000 = $3000)
     */
    constructor(address _treasury, uint256 _ethUsdPrice) {
        require(_treasury != address(0), "PrivateStream: treasury cannot be zero address");
        require(_ethUsdPrice > 0, "PrivateStream: ETH price must be positive");

        owner       = msg.sender;
        treasury    = _treasury;
        ethUsdCents = _ethUsdPrice;
    }

    // ─── Campaign Management ──────────────────────────────────────────────────

    /**
     * @notice Creates a new campaign. Each wallet can only create ONE campaign.
     *
     * @dev The metadataCid points to AES-256-GCM encrypted JSON on IPFS.
     *      The raw YouTube URL is NEVER stored on-chain — only the encrypted CID.
     *
     * @param campaignId      UUID v4 identifier (generated by frontend)
     * @param metadataCid     IPFS CID of encrypted campaign metadata
     * @param priceWei        Price per access in wei
     * @param durationSeconds Access duration in seconds (min 1h, max 30d)
     */
    function createCampaign(
        string calldata campaignId,
        string calldata metadataCid,
        uint256 priceWei,
        uint256 durationSeconds
    ) external {
        // ── One campaign per wallet ───────────────────────────────────────────
        require(
            bytes(creatorCampaign[msg.sender]).length == 0,
            "PrivateStream: you already own an active campaign"
        );

        // ── Input validation ──────────────────────────────────────────────────
        require(bytes(campaignId).length > 0,   "PrivateStream: campaign ID required");
        require(bytes(metadataCid).length > 0,  "PrivateStream: metadata CID required");
        require(priceWei >= MIN_PRICE_WEI,       "PrivateStream: price below minimum");
        require(durationSeconds >= MIN_DURATION, "PrivateStream: duration too short (min 1h)");
        require(durationSeconds <= MAX_DURATION, "PrivateStream: duration too long (max 30d)");
        require(
            campaigns[campaignId].creator == address(0),
            "PrivateStream: campaign ID already exists"
        );

        // ── Create campaign ───────────────────────────────────────────────────
        campaigns[campaignId] = Campaign({
            id:              campaignId,
            creator:         msg.sender,
            metadataCid:     metadataCid,
            priceWei:        priceWei,
            durationSeconds: durationSeconds,
            grossRevenueWei: 0,
            purchaseCount:   0,
            active:          true,
            soldOut:         false,
            createdAt:       block.timestamp,
            updatedAt:       block.timestamp
        });

        creatorCampaign[msg.sender] = campaignId;
        totalCampaigns++;

        emit CampaignCreated(
            campaignId,
            msg.sender,
            metadataCid,
            priceWei,
            durationSeconds,
            block.timestamp
        );
    }

    // ─── Purchase Access ──────────────────────────────────────────────────────

    /**
     * @notice Purchases time-limited access to a campaign.
     *
     * @dev Payment flow:
     *      1. Buyer sends ETH equal to campaign price
     *      2. Contract splits: 90% → creator, 10% → treasury
     *      3. Access expiry recorded on-chain
     *      4. Revenue cap checked — campaign marked sold_out if reached
     *
     * @param campaignId The campaign to purchase access for
     */
    function purchaseAccess(string calldata campaignId)
        external
        payable
        campaignExists(campaignId)
    {
        Campaign storage campaign = campaigns[campaignId];

        // ── State checks ──────────────────────────────────────────────────────
        require(campaign.active,   "PrivateStream: campaign is not active");
        require(!campaign.soldOut, "PrivateStream: campaign is sold out");
        require(
            msg.value >= campaign.priceWei,
            "PrivateStream: insufficient payment"
        );

        // ── Refund overpayment ────────────────────────────────────────────────
        uint256 payment = campaign.priceWei;
        uint256 refund  = msg.value - payment;

        // ── Calculate payment split ───────────────────────────────────────────
        uint256 platformFee    = (payment * PLATFORM_FEE_BPS) / 10000;
        uint256 creatorPayment = payment - platformFee;

        // ── Record access expiry ──────────────────────────────────────────────
        bytes32 accessKey = _accessKey(msg.sender, campaignId);
        uint256 newExpiry = block.timestamp + campaign.durationSeconds;

        // Extend access if buyer already has unexpired access
        if (accessExpiry[accessKey] > block.timestamp) {
            newExpiry = accessExpiry[accessKey] + campaign.durationSeconds;
        }
        accessExpiry[accessKey] = newExpiry;

        // ── Update campaign revenue ───────────────────────────────────────────
        campaign.grossRevenueWei += payment;
        campaign.purchaseCount   += 1;
        campaign.updatedAt        = block.timestamp;

        // ── Check revenue cap ─────────────────────────────────────────────────
        uint256 grossRevenueUsdCents = _weiToUsdCents(campaign.grossRevenueWei);
        if (grossRevenueUsdCents >= REVENUE_CAP_USD_CENTS) {
            campaign.soldOut = true;
            campaign.active  = false;
            emit CampaignSoldOut(campaignId, campaign.grossRevenueWei, grossRevenueUsdCents);
        }

        // ── Transfer payments ─────────────────────────────────────────────────
        // Effects before interactions (CEI pattern)
        (bool creatorSent, ) = payable(campaign.creator).call{value: creatorPayment}("");
        require(creatorSent, "PrivateStream: creator payment failed");

        (bool treasurySent, ) = payable(treasury).call{value: platformFee}("");
        require(treasurySent, "PrivateStream: treasury payment failed");

        // ── Refund overpayment ────────────────────────────────────────────────
        if (refund > 0) {
            (bool refundSent, ) = payable(msg.sender).call{value: refund}("");
            require(refundSent, "PrivateStream: refund failed");
        }

        totalPlatformFees += platformFee;

        emit AccessPurchased(
            campaignId,
            msg.sender,
            payment,
            newExpiry,
            creatorPayment,
            platformFee
        );
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    /**
     * @notice Returns full campaign details by ID.
     */
    function getCampaign(string calldata campaignId)
        external
        view
        returns (Campaign memory)
    {
        return campaigns[campaignId];
    }

    /**
     * @notice Returns the campaign created by a specific address.
     *         Returns empty Campaign struct if address has no campaign.
     */
    function getCreatorCampaign(address creator)
        external
        view
        returns (Campaign memory)
    {
        string memory cid = creatorCampaign[creator];
        if (bytes(cid).length == 0) {
            Campaign memory empty;
            return empty;
        }
        return campaigns[cid];
    }

    /**
     * @notice Checks if an address has created a campaign.
     */
    function hasCampaign(address creator) external view returns (bool) {
        return bytes(creatorCampaign[creator]).length > 0;
    }

    /**
     * @notice Returns the access expiry timestamp for a buyer on a campaign.
     *         Returns 0 if no access record exists.
     */
    function getAccessExpiry(address buyer, string calldata campaignId)
        external
        view
        returns (uint256)
    {
        return accessExpiry[_accessKey(buyer, campaignId)];
    }

    /**
     * @notice Checks if a buyer currently has valid (non-expired) access.
     */
    function hasValidAccess(address buyer, string calldata campaignId)
        external
        view
        returns (bool)
    {
        uint256 expiry = accessExpiry[_accessKey(buyer, campaignId)];
        return expiry > block.timestamp;
    }

    /**
     * @notice Returns the gross revenue of a campaign in USD cents.
     *         Uses the stored ETH/USD price for conversion.
     */
    function getCampaignRevenueUsdCents(string calldata campaignId)
        external
        view
        returns (uint256)
    {
        return _weiToUsdCents(campaigns[campaignId].grossRevenueWei);
    }

    /**
     * @notice Returns remaining revenue capacity before sold-out (in USD cents).
     */
    function getRemainingCapUsdCents(string calldata campaignId)
        external
        view
        returns (uint256)
    {
        uint256 earned = _weiToUsdCents(campaigns[campaignId].grossRevenueWei);
        if (earned >= REVENUE_CAP_USD_CENTS) return 0;
        return REVENUE_CAP_USD_CENTS - earned;
    }

    /**
     * @notice Returns contract-level statistics.
     */
    function getStats() external view returns (
        uint256 _totalCampaigns,
        uint256 _totalPlatformFees,
        uint256 _ethUsdCents,
        address _treasury
    ) {
        return (totalCampaigns, totalPlatformFees, ethUsdCents, treasury);
    }

    // ─── Admin Functions ──────────────────────────────────────────────────────

    /**
     * @notice Updates the ETH/USD price used for revenue cap calculations.
     *         In production, this would be called by a Chainlink oracle.
     *
     * @param newPriceCents New ETH price in USD cents (e.g. 300000 = $3000)
     */
    function updateEthPrice(uint256 newPriceCents) external onlyOwner {
        require(newPriceCents > 0, "PrivateStream: price must be positive");
        emit EthPriceUpdated(ethUsdCents, newPriceCents);
        ethUsdCents = newPriceCents;
    }

    /**
     * @notice Updates the platform treasury address.
     *
     * @param newTreasury New treasury address
     */
    function updateTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "PrivateStream: zero address");
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    // ─── Internal Helpers ─────────────────────────────────────────────────────

    /**
     * @dev Generates a unique storage key for buyer+campaign access records.
     */
    function _accessKey(address buyer, string calldata campaignId)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(buyer, campaignId));
    }

    /**
     * @dev Converts wei amount to USD cents using stored ETH price.
     *      Formula: (wei * ethUsdCents) / 1e18
     *
     *      Example: 1 ETH at $3000 = 300000 cents
     *        (1e18 * 300000) / 1e18 = 300000 cents = $3000
     */
    function _weiToUsdCents(uint256 weiAmount) internal view returns (uint256) {
        return (weiAmount * ethUsdCents) / 1 ether;
    }

    // ─── Fallback ─────────────────────────────────────────────────────────────

    /// @dev Reject direct ETH transfers (must use purchaseAccess)
    receive() external payable {
        revert("PrivateStream: use purchaseAccess() to send ETH");
    }

    fallback() external payable {
        revert("PrivateStream: function not found");
    }
}
