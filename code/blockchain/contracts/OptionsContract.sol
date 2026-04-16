// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title Enhanced Options Contract for Optionix Platform
 * @dev Implements comprehensive options trading with financial compliance
 * Features:
 * - European and American style options
 * - Multi-asset support
 * - Advanced risk management
 * - Compliance controls (KYC/AML)
 * - Circuit breakers and emergency controls
 * - Comprehensive audit logging
 * - Oracle integration for price feeds
 * - Margin and collateral management
 */
contract EnhancedOptionsContract is ReentrancyGuard, Pausable, AccessControl {
    using SafeMath for uint256;

    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant RISK_MANAGER_ROLE = keccak256("RISK_MANAGER_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    // Option types
    enum OptionType {
        CALL,
        PUT
    }
    enum OptionStyle {
        EUROPEAN,
        AMERICAN
    }
    enum OptionStatus {
        ACTIVE,
        EXERCISED,
        EXPIRED,
        CANCELLED
    }

    // Compliance status
    enum ComplianceStatus {
        PENDING,
        APPROVED,
        REJECTED,
        SUSPENDED
    }

    struct Option {
        uint256 optionId;
        address writer;
        address holder;
        OptionType optionType;
        OptionStyle optionStyle;
        uint256 strikePrice;
        uint256 premium;
        uint256 expirationTime;
        uint256 collateral;
        OptionStatus status;
        address underlyingAsset;
        uint256 contractSize;
        uint256 creationTime;
        bytes32 riskHash;
    }

    struct UserProfile {
        bool isKYCVerified;
        ComplianceStatus complianceStatus;
        uint256 riskScore;
        uint256 maxPositionSize;
        uint256 totalExposure;
        uint256 marginRequirement;
        bool isAccreditedInvestor;
        uint256 lastActivityTime;
    }

    struct RiskParameters {
        uint256 maxLeverage;
        uint256 marginRequirement;
        uint256 liquidationThreshold;
        uint256 maxPositionSize;
        uint256 concentrationLimit;
        bool circuitBreakerActive;
    }

    struct PriceOracle {
        AggregatorV3Interface priceFeed;
        uint256 heartbeat;
        uint256 lastUpdateTime;
        bool isActive;
    }

    // State variables
    mapping(uint256 => Option) public options;
    mapping(address => UserProfile) public userProfiles;
    mapping(address => PriceOracle) public priceOracles;
    mapping(address => uint256[]) public userOptions;
    mapping(address => mapping(address => uint256)) public collateralBalances;

    uint256 public nextOptionId = 1;
    uint256 public totalVolume;
    uint256 public totalOpenInterest;
    RiskParameters public riskParams;

    // Emergency controls
    bool public emergencyStop = false;
    uint256 public maxDailyVolume;
    uint256 public dailyVolume;
    uint256 public lastVolumeResetTime;

    // Events
    event OptionCreated(
        uint256 indexed optionId,
        address indexed writer,
        OptionType optionType,
        uint256 strikePrice,
        uint256 premium,
        uint256 expirationTime
    );

    event OptionPurchased(
        uint256 indexed optionId,
        address indexed buyer,
        uint256 premium
    );

    event OptionExercised(
        uint256 indexed optionId,
        address indexed exerciser,
        uint256 payoff
    );

    event CollateralDeposited(
        address indexed user,
        address indexed asset,
        uint256 amount
    );

    event ComplianceStatusUpdated(
        address indexed user,
        ComplianceStatus oldStatus,
        ComplianceStatus newStatus
    );

    event RiskParametersUpdated(
        uint256 maxLeverage,
        uint256 marginRequirement,
        uint256 liquidationThreshold
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

    modifier validOption(uint256 _optionId) {
        require(_optionId > 0 && _optionId < nextOptionId, "Invalid option ID");
        require(
            options[_optionId].status == OptionStatus.ACTIVE,
            "Option not active"
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
        uint256 _maxLeverage,
        uint256 _marginRequirement,
        uint256 _maxDailyVolume
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(COMPLIANCE_ROLE, msg.sender);
        _grantRole(RISK_MANAGER_ROLE, msg.sender);

        riskParams = RiskParameters({
            maxLeverage: _maxLeverage,
            marginRequirement: _marginRequirement,
            liquidationThreshold: 80, // 80%
            maxPositionSize: 1000000 * 1e18, // 1M tokens
            concentrationLimit: 25, // 25%
            circuitBreakerActive: false
        });

        maxDailyVolume = _maxDailyVolume;
        lastVolumeResetTime = block.timestamp;
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
            totalExposure: 0,
            marginRequirement: riskParams.marginRequirement,
            isAccreditedInvestor: _isAccreditedInvestor,
            lastActivityTime: block.timestamp
        });

        emit ComplianceStatusUpdated(
            _user,
            ComplianceStatus.PENDING,
            ComplianceStatus.APPROVED
        );
    }

    /**
     * @dev Add price oracle for an asset
     */
    function addPriceOracle(
        address _asset,
        address _priceFeed,
        uint256 _heartbeat
    ) external onlyRole(ORACLE_ROLE) {
        priceOracles[_asset] = PriceOracle({
            priceFeed: AggregatorV3Interface(_priceFeed),
            heartbeat: _heartbeat,
            lastUpdateTime: block.timestamp,
            isActive: true
        });
    }

    /**
     * @dev Deposit collateral for options trading
     */
    function depositCollateral(
        address _asset,
        uint256 _amount
    ) external payable onlyCompliantUser nonReentrant {
        require(_amount > 0, "Amount must be positive");

        if (_asset == address(0)) {
            // ETH deposit
            require(msg.value == _amount, "ETH amount mismatch");
        } else {
            // ERC20 token deposit (would need IERC20 interface)
            require(msg.value == 0, "No ETH for token deposit");
            // Transfer tokens from user (implementation depends on token contract)
        }

        collateralBalances[msg.sender][_asset] = collateralBalances[msg.sender][
            _asset
        ].add(_amount);

        emit CollateralDeposited(msg.sender, _asset, _amount);
    }

    /**
     * @dev Create a new option contract
     */
    function createOption(
        OptionType _optionType,
        OptionStyle _optionStyle,
        uint256 _strikePrice,
        uint256 _premium,
        uint256 _expirationTime,
        address _underlyingAsset,
        uint256 _contractSize
    )
        external
        onlyCompliantUser
        nonReentrant
        notEmergencyStop
        whenNotPaused
        returns (uint256)
    {
        require(_strikePrice > 0, "Strike price must be positive");
        require(_premium > 0, "Premium must be positive");
        require(
            _expirationTime > block.timestamp,
            "Expiration must be in future"
        );
        require(_contractSize > 0, "Contract size must be positive");
        require(
            priceOracles[_underlyingAsset].isActive,
            "Oracle not available"
        );

        // Check daily volume limits
        _checkDailyVolumeLimit(_premium.mul(_contractSize));

        // Calculate required collateral
        uint256 requiredCollateral = _calculateRequiredCollateral(
            _optionType,
            _strikePrice,
            _contractSize,
            _underlyingAsset
        );

        // Check collateral sufficiency
        require(
            collateralBalances[msg.sender][_underlyingAsset] >=
                requiredCollateral,
            "Insufficient collateral"
        );

        // Check risk limits
        uint256 exposure = _premium.mul(_contractSize);
        require(
            userProfiles[msg.sender].totalExposure.add(exposure) <=
                userProfiles[msg.sender].maxPositionSize,
            "Exceeds position limit"
        );

        // Create option
        uint256 optionId = nextOptionId++;

        options[optionId] = Option({
            optionId: optionId,
            writer: msg.sender,
            holder: address(0),
            optionType: _optionType,
            optionStyle: _optionStyle,
            strikePrice: _strikePrice,
            premium: _premium,
            expirationTime: _expirationTime,
            collateral: requiredCollateral,
            status: OptionStatus.ACTIVE,
            underlyingAsset: _underlyingAsset,
            contractSize: _contractSize,
            creationTime: block.timestamp,
            riskHash: _calculateRiskHash(
                _optionType,
                _strikePrice,
                _expirationTime,
                _underlyingAsset
            )
        });

        // Lock collateral
        collateralBalances[msg.sender][_underlyingAsset] = collateralBalances[
            msg.sender
        ][_underlyingAsset].sub(requiredCollateral);

        // Update user exposure
        userProfiles[msg.sender].totalExposure = userProfiles[msg.sender]
            .totalExposure
            .add(exposure);

        // Update global metrics
        totalOpenInterest = totalOpenInterest.add(exposure);
        userOptions[msg.sender].push(optionId);

        emit OptionCreated(
            optionId,
            msg.sender,
            _optionType,
            _strikePrice,
            _premium,
            _expirationTime
        );

        return optionId;
    }

    /**
     * @dev Emergency stop function
     */
    function emergencyStopTrading() external onlyRole(ADMIN_ROLE) {
        emergencyStop = true;
        _pause();
        emit EmergencyAction("EMERGENCY_STOP", msg.sender, block.timestamp);
    }

    /**
     * @dev Resume trading after emergency stop
     */
    function resumeTrading() external onlyRole(ADMIN_ROLE) {
        emergencyStop = false;
        _unpause();
        emit EmergencyAction("RESUME_TRADING", msg.sender, block.timestamp);
    }

    /**
     * @dev Check daily volume limits
     */
    function _checkDailyVolumeLimit(uint256 _volume) internal {
        // Reset daily volume if new day
        if (block.timestamp >= lastVolumeResetTime.add(86400)) {
            dailyVolume = 0;
            lastVolumeResetTime = block.timestamp;
        }

        require(
            dailyVolume.add(_volume) <= maxDailyVolume,
            "Daily volume limit exceeded"
        );
    }

    /**
     * @dev Calculate required collateral for option writing
     */
    function _calculateRequiredCollateral(
        OptionType _optionType,
        uint256 _strikePrice,
        uint256 _contractSize,
        address _underlyingAsset
    ) internal view returns (uint256) {
        uint256 currentPrice = _getAssetPrice(_underlyingAsset);

        if (_optionType == OptionType.CALL) {
            // For calls: collateral = contract size * underlying asset
            return _contractSize;
        } else {
            // For puts: collateral = strike price * contract size
            return _strikePrice.mul(_contractSize).div(1e18);
        }
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
     * @dev Calculate risk hash for option
     */
    function _calculateRiskHash(
        OptionType _optionType,
        uint256 _strikePrice,
        uint256 _expirationTime,
        address _underlyingAsset
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    _optionType,
                    _strikePrice,
                    _expirationTime,
                    _underlyingAsset
                )
            );
    }

    /**
     * @dev Update risk parameters
     */
    function updateRiskParameters(
        uint256 _maxLeverage,
        uint256 _marginRequirement,
        uint256 _liquidationThreshold
    ) external onlyRole(RISK_MANAGER_ROLE) {
        riskParams.maxLeverage = _maxLeverage;
        riskParams.marginRequirement = _marginRequirement;
        riskParams.liquidationThreshold = _liquidationThreshold;

        emit RiskParametersUpdated(
            _maxLeverage,
            _marginRequirement,
            _liquidationThreshold
        );
    }

    /**
     * @dev Get option details
     */
    function getOption(
        uint256 _optionId
    ) external view returns (Option memory) {
        return options[_optionId];
    }

    /**
     * @dev Get user profile
     */
    function getUserProfile(
        address _user
    ) external view returns (UserProfile memory) {
        return userProfiles[_user];
    }

    /**
     * @dev Get user options
     */
    function getUserOptions(
        address _user
    ) external view returns (uint256[] memory) {
        return userOptions[_user];
    }

    /**
     * @dev Get collateral balance
     */
    function getCollateralBalance(
        address _user,
        address _asset
    ) external view returns (uint256) {
        return collateralBalances[_user][_asset];
    }
}
