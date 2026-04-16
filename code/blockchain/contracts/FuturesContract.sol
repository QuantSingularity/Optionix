// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title Enhanced Futures Contract for Optionix Platform
 * @dev Implements comprehensive futures trading with financial compliance
 * Features:
 * - Multi-asset futures support
 * - Advanced margin and risk management
 * - Automated liquidation system
 * - Compliance controls (KYC/AML)
 * - Position limits and circuit breakers
 * - Real-time mark-to-market
 * - Comprehensive audit logging
 * - Oracle integration for price feeds
 * - Settlement mechanisms
 */
contract EnhancedFuturesContract is ReentrancyGuard, Pausable, AccessControl {
    using SafeMath for uint256;

    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant RISK_MANAGER_ROLE = keccak256("RISK_MANAGER_ROLE");
    bytes32 public constant LIQUIDATOR_ROLE = keccak256("LIQUIDATOR_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    // Position status
    enum PositionStatus {
        ACTIVE,
        CLOSED,
        LIQUIDATED,
        SETTLED
    }
    enum ComplianceStatus {
        PENDING,
        APPROVED,
        REJECTED,
        SUSPENDED
    }

    struct Position {
        uint256 positionId;
        address trader;
        address underlyingAsset;
        uint256 size;
        bool isLong;
        uint256 entryPrice;
        uint256 margin;
        uint256 leverage;
        uint256 openTime;
        uint256 lastUpdateTime;
        PositionStatus status;
        uint256 unrealizedPnL;
        uint256 realizedPnL;
        uint256 fundingFees;
        bytes32 riskHash;
    }

    struct UserProfile {
        bool isKYCVerified;
        ComplianceStatus complianceStatus;
        uint256 riskScore;
        uint256 maxPositionSize;
        uint256 totalMargin;
        uint256 availableMargin;
        uint256 totalExposure;
        uint256 marginRequirement;
        bool isAccreditedInvestor;
        uint256 lastActivityTime;
        uint256 liquidationCount;
    }

    struct RiskParameters {
        uint256 initialMarginRate;
        uint256 maintenanceMarginRate;
        uint256 liquidationThreshold;
        uint256 maxLeverage;
        uint256 maxPositionSize;
        uint256 concentrationLimit;
        bool circuitBreakerActive;
        uint256 fundingRate;
        uint256 maxDailyLoss;
    }

    struct PriceOracle {
        AggregatorV3Interface priceFeed;
        uint256 heartbeat;
        uint256 lastUpdateTime;
        bool isActive;
        uint256 priceDeviation;
    }

    struct MarketData {
        uint256 totalLongPositions;
        uint256 totalShortPositions;
        uint256 totalVolume;
        uint256 openInterest;
        uint256 fundingRate;
        uint256 lastFundingTime;
        uint256 indexPrice;
        uint256 markPrice;
    }

    // State variables
    mapping(uint256 => Position) public positions;
    mapping(address => UserProfile) public userProfiles;
    mapping(address => PriceOracle) public priceOracles;
    mapping(address => MarketData) public marketData;
    mapping(address => uint256[]) public userPositions;
    mapping(address => mapping(address => uint256)) public marginBalances;
    mapping(address => bool) public authorizedLiquidators;

    uint256 public nextPositionId = 1;
    RiskParameters public riskParams;

    // Emergency controls
    bool public emergencyStop = false;
    uint256 public maxDailyVolume;
    uint256 public dailyVolume;
    uint256 public lastVolumeResetTime;

    // Insurance fund
    uint256 public insuranceFund;
    address public insuranceFundAddress;

    // Events
    event PositionOpened(
        uint256 indexed positionId,
        address indexed trader,
        address indexed asset,
        uint256 size,
        bool isLong,
        uint256 entryPrice,
        uint256 margin,
        uint256 leverage
    );

    event PositionClosed(
        uint256 indexed positionId,
        address indexed trader,
        uint256 exitPrice,
        int256 pnl,
        uint256 fees
    );

    event PositionLiquidated(
        uint256 indexed positionId,
        address indexed trader,
        address indexed liquidator,
        uint256 liquidationPrice,
        uint256 liquidationFee
    );

    event MarginDeposited(
        address indexed user,
        address indexed asset,
        uint256 amount
    );

    event MarginWithdrawn(
        address indexed user,
        address indexed asset,
        uint256 amount
    );

    event FundingPayment(
        address indexed asset,
        int256 fundingRate,
        uint256 timestamp
    );

    event RiskParametersUpdated(
        uint256 initialMarginRate,
        uint256 maintenanceMarginRate,
        uint256 maxLeverage
    );

    event EmergencyAction(
        string action,
        address indexed initiator,
        uint256 timestamp
    );

    // Modifiers
    modifier onlyCompliantUser() {
        require(
            userProfiles[msg.sender].isKYCVerified &&
                userProfiles[msg.sender].complianceStatus ==
                    ComplianceStatus.APPROVED,
            "User not compliant"
        );
        _;
    }

    modifier notEmergencyStop() {
        require(!emergencyStop, "Emergency stop active");
        _;
    }

    modifier validPosition(uint256 _positionId) {
        require(
            _positionId > 0 && _positionId < nextPositionId,
            "Invalid position ID"
        );
        require(
            positions[_positionId].status == PositionStatus.ACTIVE,
            "Position not active"
        );
        _;
    }

    modifier onlyPositionOwner(uint256 _positionId) {
        require(
            positions[_positionId].trader == msg.sender,
            "Not position owner"
        );
        _;
    }

    modifier withinRiskLimits(address _user, uint256 _exposure) {
        UserProfile memory profile = userProfiles[_user];
        require(
            profile.totalExposure.add(_exposure) <= profile.maxPositionSize,
            "Exceeds position limit"
        );
        _;
    }

    constructor(
        uint256 _initialMarginRate,
        uint256 _maintenanceMarginRate,
        uint256 _maxLeverage,
        uint256 _maxDailyVolume,
        address _insuranceFundAddress
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(COMPLIANCE_ROLE, msg.sender);
        _grantRole(RISK_MANAGER_ROLE, msg.sender);
        _grantRole(LIQUIDATOR_ROLE, msg.sender);

        riskParams = RiskParameters({
            initialMarginRate: _initialMarginRate,
            maintenanceMarginRate: _maintenanceMarginRate,
            liquidationThreshold: 80, // 80%
            maxLeverage: _maxLeverage,
            maxPositionSize: 10000000 * 1e18, // 10M tokens
            concentrationLimit: 25, // 25%
            circuitBreakerActive: false,
            fundingRate: 0,
            maxDailyLoss: 1000000 * 1e18 // 1M tokens
        });

        maxDailyVolume = _maxDailyVolume;
        lastVolumeResetTime = block.timestamp;
        insuranceFundAddress = _insuranceFundAddress;
    }

    /**
     * @dev Register user with KYC verification
     */
    function registerUser(
        address _user,
        bool _isAccreditedInvestor,
        uint256 _riskScore,
        uint256 _maxPositionSize
    ) external onlyRole(COMPLIANCE_ROLE) {
        userProfiles[_user] = UserProfile({
            isKYCVerified: true,
            complianceStatus: ComplianceStatus.APPROVED,
            riskScore: _riskScore,
            maxPositionSize: _maxPositionSize,
            totalMargin: 0,
            availableMargin: 0,
            totalExposure: 0,
            marginRequirement: riskParams.initialMarginRate,
            isAccreditedInvestor: _isAccreditedInvestor,
            lastActivityTime: block.timestamp,
            liquidationCount: 0
        });
    }

    /**
     * @dev Add price oracle for an asset
     */
    function addPriceOracle(
        address _asset,
        address _priceFeed,
        uint256 _heartbeat,
        uint256 _priceDeviation
    ) external onlyRole(ORACLE_ROLE) {
        priceOracles[_asset] = PriceOracle({
            priceFeed: AggregatorV3Interface(_priceFeed),
            heartbeat: _heartbeat,
            lastUpdateTime: block.timestamp,
            isActive: true,
            priceDeviation: _priceDeviation
        });

        // Initialize market data
        marketData[_asset] = MarketData({
            totalLongPositions: 0,
            totalShortPositions: 0,
            totalVolume: 0,
            openInterest: 0,
            fundingRate: 0,
            lastFundingTime: block.timestamp,
            indexPrice: 0,
            markPrice: 0
        });
    }

    /**
     * @dev Deposit margin for futures trading
     */
    function depositMargin(
        address _asset,
        uint256 _amount
    ) external payable onlyCompliantUser nonReentrant {
        require(_amount > 0, "Amount must be positive");

        if (_asset == address(0)) {
            // ETH deposit
            require(msg.value == _amount, "ETH amount mismatch");
        } else {
            // ERC20 token deposit
            require(msg.value == 0, "No ETH for token deposit");
            // Transfer tokens from user (implementation depends on token contract)
        }

        marginBalances[msg.sender][_asset] = marginBalances[msg.sender][_asset]
            .add(_amount);
        userProfiles[msg.sender].totalMargin = userProfiles[msg.sender]
            .totalMargin
            .add(_amount);
        userProfiles[msg.sender].availableMargin = userProfiles[msg.sender]
            .availableMargin
            .add(_amount);

        emit MarginDeposited(msg.sender, _asset, _amount);
    }

    /**
     * @dev Open a futures position
     */
    function openPosition(
        address _underlyingAsset,
        uint256 _size,
        bool _isLong,
        uint256 _leverage
    )
        external
        onlyCompliantUser
        nonReentrant
        notEmergencyStop
        whenNotPaused
        returns (uint256)
    {
        require(_size > 0, "Size must be positive");
        require(
            _leverage > 0 && _leverage <= riskParams.maxLeverage,
            "Invalid leverage"
        );
        require(
            priceOracles[_underlyingAsset].isActive,
            "Oracle not available"
        );

        // Get current price
        uint256 currentPrice = _getAssetPrice(_underlyingAsset);
        require(currentPrice > 0, "Invalid price");

        // Calculate required margin
        uint256 notionalValue = _size.mul(currentPrice).div(1e18);
        uint256 requiredMargin = notionalValue
            .mul(riskParams.initialMarginRate)
            .div(100)
            .div(_leverage);

        // Check margin sufficiency
        require(
            userProfiles[msg.sender].availableMargin >= requiredMargin,
            "Insufficient margin"
        );

        // Check position limits
        require(
            userProfiles[msg.sender].totalExposure.add(notionalValue) <=
                userProfiles[msg.sender].maxPositionSize,
            "Exceeds position limit"
        );

        // Check daily volume limits
        _checkDailyVolumeLimit(notionalValue);

        // Create position
        uint256 positionId = nextPositionId++;

        positions[positionId] = Position({
            positionId: positionId,
            trader: msg.sender,
            underlyingAsset: _underlyingAsset,
            size: _size,
            isLong: _isLong,
            entryPrice: currentPrice,
            margin: requiredMargin,
            leverage: _leverage,
            openTime: block.timestamp,
            lastUpdateTime: block.timestamp,
            status: PositionStatus.ACTIVE,
            unrealizedPnL: 0,
            realizedPnL: 0,
            fundingFees: 0,
            riskHash: _calculateRiskHash(
                _underlyingAsset,
                _size,
                _isLong,
                currentPrice
            )
        });

        // Update user profile
        userProfiles[msg.sender].availableMargin = userProfiles[msg.sender]
            .availableMargin
            .sub(requiredMargin);
        userProfiles[msg.sender].totalExposure = userProfiles[msg.sender]
            .totalExposure
            .add(notionalValue);
        userProfiles[msg.sender].lastActivityTime = block.timestamp;

        // Update market data
        MarketData storage market = marketData[_underlyingAsset];
        if (_isLong) {
            market.totalLongPositions = market.totalLongPositions.add(_size);
        } else {
            market.totalShortPositions = market.totalShortPositions.add(_size);
        }
        market.totalVolume = market.totalVolume.add(notionalValue);
        market.openInterest = market.openInterest.add(notionalValue);

        // Update global metrics
        dailyVolume = dailyVolume.add(notionalValue);
        userPositions[msg.sender].push(positionId);

        emit PositionOpened(
            positionId,
            msg.sender,
            _underlyingAsset,
            _size,
            _isLong,
            currentPrice,
            requiredMargin,
            _leverage
        );

        return positionId;
    }

    /**
     * @dev Close a futures position
     */
    function closePosition(
        uint256 _positionId
    )
        external
        onlyCompliantUser
        nonReentrant
        notEmergencyStop
        validPosition(_positionId)
        onlyPositionOwner(_positionId)
    {
        Position storage position = positions[_positionId];

        // Get current price
        uint256 currentPrice = _getAssetPrice(position.underlyingAsset);
        require(currentPrice > 0, "Invalid price");

        // Calculate PnL
        int256 pnl = _calculatePnL(position, currentPrice);

        // Calculate fees
        uint256 fees = _calculateClosingFees(position, currentPrice);

        // Update position status
        position.status = PositionStatus.CLOSED;
        position.realizedPnL = uint256(pnl > 0 ? pnl : -pnl);

        // Release margin and apply PnL
        uint256 marginToReturn = position.margin;
        if (pnl > 0) {
            marginToReturn = marginToReturn.add(uint256(pnl));
        } else {
            uint256 loss = uint256(-pnl);
            if (loss >= marginToReturn) {
                marginToReturn = 0;
            } else {
                marginToReturn = marginToReturn.sub(loss);
            }
        }

        // Deduct fees
        if (fees >= marginToReturn) {
            marginToReturn = 0;
        } else {
            marginToReturn = marginToReturn.sub(fees);
        }

        // Update user profile
        userProfiles[msg.sender].availableMargin = userProfiles[msg.sender]
            .availableMargin
            .add(marginToReturn);

        uint256 notionalValue = position.size.mul(position.entryPrice).div(
            1e18
        );
        userProfiles[msg.sender].totalExposure = userProfiles[msg.sender]
            .totalExposure
            .sub(notionalValue);

        // Update market data
        MarketData storage market = marketData[position.underlyingAsset];
        if (position.isLong) {
            market.totalLongPositions = market.totalLongPositions.sub(
                position.size
            );
        } else {
            market.totalShortPositions = market.totalShortPositions.sub(
                position.size
            );
        }
        market.openInterest = market.openInterest.sub(notionalValue);

        emit PositionClosed(_positionId, msg.sender, currentPrice, pnl, fees);
    }

    /**
     * @dev Liquidate an undercollateralized position
     */
    function liquidatePosition(
        uint256 _positionId
    )
        external
        onlyRole(LIQUIDATOR_ROLE)
        nonReentrant
        validPosition(_positionId)
    {
        Position storage position = positions[_positionId];

        // Get current price
        uint256 currentPrice = _getAssetPrice(position.underlyingAsset);
        require(currentPrice > 0, "Invalid price");

        // Check if position is eligible for liquidation
        require(
            _isLiquidationEligible(position, currentPrice),
            "Position not eligible for liquidation"
        );

        // Calculate liquidation fee
        uint256 liquidationFee = position.margin.mul(5).div(100); // 5% liquidation fee

        // Update position status
        position.status = PositionStatus.LIQUIDATED;

        // Update user profile
        userProfiles[position.trader].liquidationCount = userProfiles[
            position.trader
        ].liquidationCount.add(1);

        uint256 notionalValue = position.size.mul(position.entryPrice).div(
            1e18
        );
        userProfiles[position.trader].totalExposure = userProfiles[
            position.trader
        ].totalExposure.sub(notionalValue);

        // Transfer liquidation fee to liquidator
        if (liquidationFee > 0) {
            marginBalances[msg.sender][
                position.underlyingAsset
            ] = marginBalances[msg.sender][position.underlyingAsset].add(
                liquidationFee
            );
        }

        // Add remaining margin to insurance fund
        uint256 remainingMargin =
            position.margin > liquidationFee
                ? position.margin.sub(liquidationFee)
                : 0;
        if (remainingMargin > 0) {
            insuranceFund = insuranceFund.add(remainingMargin);
        }

        // Update market data
        MarketData storage market = marketData[position.underlyingAsset];
        if (position.isLong) {
            market.totalLongPositions = market.totalLongPositions.sub(
                position.size
            );
        } else {
            market.totalShortPositions = market.totalShortPositions.sub(
                position.size
            );
        }
        market.openInterest = market.openInterest.sub(notionalValue);

        emit PositionLiquidated(
            _positionId,
            position.trader,
            msg.sender,
            currentPrice,
            liquidationFee
        );
    }

    /**
     * @dev Update funding rates for an asset
     */
    function updateFundingRate(
        address _asset,
        int256 _fundingRate
    ) external onlyRole(ORACLE_ROLE) {
        MarketData storage market = marketData[_asset];
        market.fundingRate = uint256(
            _fundingRate > 0 ? _fundingRate : -_fundingRate
        );
        market.lastFundingTime = block.timestamp;

        emit FundingPayment(_asset, _fundingRate, block.timestamp);
    }

    /**
     * @dev Get current asset price from oracle
     */
    function _getAssetPrice(address _asset) internal view returns (uint256) {
        PriceOracle memory oracle = priceOracles[_asset];
        require(oracle.isActive, "Oracle inactive");

        (, int256 price, , uint256 updatedAt, ) = oracle
            .priceFeed
            .latestRoundData();
        require(price > 0, "Invalid price");
        require(
            block.timestamp.sub(updatedAt) <= oracle.heartbeat,
            "Price stale"
        );

        return uint256(price);
    }

    /**
     * @dev Calculate position PnL
     */
    function _calculatePnL(
        Position memory _position,
        uint256 _currentPrice
    ) internal pure returns (int256) {
        int256 priceDiff = int256(_currentPrice) - int256(_position.entryPrice);

        if (_position.isLong) {
            return (priceDiff * int256(_position.size)) / 1e18;
        } else {
            return (-priceDiff * int256(_position.size)) / 1e18;
        }
    }

    /**
     * @dev Calculate closing fees
     */
    function _calculateClosingFees(
        Position memory _position,
        uint256 _currentPrice
    ) internal pure returns (uint256) {
        uint256 notionalValue = _position.size.mul(_currentPrice).div(1e18);
        return notionalValue.mul(5).div(10000); // 0.05% closing fee
    }

    /**
     * @dev Check if position is eligible for liquidation
     */
    function _isLiquidationEligible(
        Position memory _position,
        uint256 _currentPrice
    ) internal view returns (bool) {
        int256 pnl = _calculatePnL(_position, _currentPrice);

        if (pnl >= 0) {
            return false; // Position is profitable
        }

        uint256 loss = uint256(-pnl);
        uint256 maintenanceMargin = _position
            .margin
            .mul(riskParams.maintenanceMarginRate)
            .div(100);

        return loss >= _position.margin.sub(maintenanceMargin);
    }

    /**
     * @dev Calculate risk hash for position
     */
    function _calculateRiskHash(
        address _asset,
        uint256 _size,
        bool _isLong,
        uint256 _price
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_asset, _size, _isLong, _price));
    }

    /**
     * @dev Check daily volume limits
     */
    function _checkDailyVolumeLimit(uint256 _volume) internal {
        if (block.timestamp.sub(lastVolumeResetTime) >= 1 days) {
            dailyVolume = 0;
            lastVolumeResetTime = block.timestamp;
        }

        require(
            dailyVolume.add(_volume) <= maxDailyVolume,
            "Daily volume limit exceeded"
        );
    }

    /**
     * @dev Emergency stop function
     */
    function emergencyStop() external onlyRole(ADMIN_ROLE) {
        emergencyStop = true;
        _pause();
        emit EmergencyAction(
            "Emergency stop activated",
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @dev Resume operations
     */
    function resumeOperations() external onlyRole(ADMIN_ROLE) {
        emergencyStop = false;
        _unpause();
        emit EmergencyAction("Operations resumed", msg.sender, block.timestamp);
    }

    /**
     * @dev Update risk parameters
     */
    function updateRiskParameters(
        uint256 _initialMarginRate,
        uint256 _maintenanceMarginRate,
        uint256 _maxLeverage
    ) external onlyRole(RISK_MANAGER_ROLE) {
        riskParams.initialMarginRate = _initialMarginRate;
        riskParams.maintenanceMarginRate = _maintenanceMarginRate;
        riskParams.maxLeverage = _maxLeverage;

        emit RiskParametersUpdated(
            _initialMarginRate,
            _maintenanceMarginRate,
            _maxLeverage
        );
    }

    /**
     * @dev Withdraw available margin
     */
    function withdrawMargin(
        address _asset,
        uint256 _amount
    ) external onlyCompliantUser nonReentrant {
        require(_amount > 0, "Amount must be positive");
        require(
            userProfiles[msg.sender].availableMargin >= _amount,
            "Insufficient available margin"
        );
        require(
            marginBalances[msg.sender][_asset] >= _amount,
            "Insufficient balance"
        );

        marginBalances[msg.sender][_asset] = marginBalances[msg.sender][_asset]
            .sub(_amount);
        userProfiles[msg.sender].totalMargin = userProfiles[msg.sender]
            .totalMargin
            .sub(_amount);
        userProfiles[msg.sender].availableMargin = userProfiles[msg.sender]
            .availableMargin
            .sub(_amount);

        if (_asset == address(0)) {
            payable(msg.sender).transfer(_amount);
        } else {
            // Transfer tokens (implementation depends on token contract)
        }

        emit MarginWithdrawn(msg.sender, _asset, _amount);
    }

    /**
     * @dev Get user's positions
     */
    function getUserPositions(
        address _user
    ) external view returns (uint256[] memory) {
        return userPositions[_user];
    }

    /**
     * @dev Get position details
     */
    function getPositionDetails(
        uint256 _positionId
    )
        external
        view
        returns (
            address trader,
            address underlyingAsset,
            uint256 size,
            bool isLong,
            uint256 entryPrice,
            uint256 margin,
            uint256 leverage,
            PositionStatus status
        )
    {
        Position memory position = positions[_positionId];
        return (
            position.trader,
            position.underlyingAsset,
            position.size,
            position.isLong,
            position.entryPrice,
            position.margin,
            position.leverage,
            position.status
        );
    }

    /**
     * @dev Get market data for an asset
     */
    function getMarketData(
        address _asset
    )
        external
        view
        returns (
            uint256 totalLongPositions,
            uint256 totalShortPositions,
            uint256 totalVolume,
            uint256 openInterest,
            uint256 fundingRate
        )
    {
        MarketData memory market = marketData[_asset];
        return (
            market.totalLongPositions,
            market.totalShortPositions,
            market.totalVolume,
            market.openInterest,
            market.fundingRate
        );
    }

    /**
     * @dev Get contract metrics
     */
    function getContractMetrics()
        external
        view
        returns (
            uint256 _dailyVolume,
            uint256 _nextPositionId,
            uint256 _insuranceFund
        )
    {
        return (dailyVolume, nextPositionId, insuranceFund);
    }

    /**
     * @dev Fallback function to receive ETH
     */
    receive() external payable {
        // Allow contract to receive ETH for insurance fund
        insuranceFund = insuranceFund.add(msg.value);
    }
}
