// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

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
 *
 * NOTE: This is a reference/demo implementation. Solidity >=0.8 has
 * built-in overflow/underflow checks, so SafeMath is not used. Collateral
 * and premiums for a given underlying asset are pooled per-asset; this
 * contract assumes a single fungible collateral unit per `underlyingAsset`
 * key (e.g. all participants trading a given underlying post collateral in
 * the same ERC20/ETH). It is not a production-audited settlement engine.
 */
contract EnhancedOptionsContract is ReentrancyGuard, Pausable, AccessControl {
    using SafeERC20 for IERC20;

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
    bool public emergencyStopActive = false;
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

    event OptionSettled(uint256 indexed optionId, address indexed writer);

    event CollateralDeposited(
        address indexed user,
        address indexed asset,
        uint256 amount
    );

    event CollateralWithdrawn(
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
        require(!emergencyStopActive, "Emergency stop active");
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

    constructor(
        uint256 _maxLeverage,
        uint256 _marginRequirement,
        uint256 _maxDailyVolume
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(COMPLIANCE_ROLE, msg.sender);
        _grantRole(RISK_MANAGER_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);

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
            require(msg.value == 0, "No ETH for token deposit");
            IERC20(_asset).safeTransferFrom(msg.sender, address(this), _amount);
        }

        collateralBalances[msg.sender][_asset] += _amount;

        emit CollateralDeposited(msg.sender, _asset, _amount);
    }

    /**
     * @dev Withdraw unlocked collateral
     */
    function withdrawCollateral(
        address _asset,
        uint256 _amount
    ) external onlyCompliantUser nonReentrant {
        require(_amount > 0, "Amount must be positive");
        require(
            collateralBalances[msg.sender][_asset] >= _amount,
            "Insufficient collateral"
        );

        collateralBalances[msg.sender][_asset] -= _amount;

        if (_asset == address(0)) {
            (bool success, ) = payable(msg.sender).call{value: _amount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(_asset).safeTransfer(msg.sender, _amount);
        }

        emit CollateralWithdrawn(msg.sender, _asset, _amount);
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

        uint256 exposure = (_premium * _contractSize) / 1e18;

        // Check daily volume limits
        _checkDailyVolumeLimit(exposure);

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
        require(
            userProfiles[msg.sender].totalExposure + exposure <=
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
        collateralBalances[msg.sender][_underlyingAsset] -= requiredCollateral;

        // Update user exposure
        userProfiles[msg.sender].totalExposure += exposure;
        userProfiles[msg.sender].lastActivityTime = block.timestamp;

        // Update global metrics
        totalOpenInterest += exposure;
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
     * @dev Purchase an active, unheld option by paying its premium to the writer
     */
    function purchaseOption(
        uint256 _optionId
    )
        external
        payable
        onlyCompliantUser
        nonReentrant
        notEmergencyStop
        whenNotPaused
        validOption(_optionId)
    {
        Option storage option = options[_optionId];
        require(option.holder == address(0), "Option already purchased");
        require(msg.sender != option.writer, "Writer cannot buy own option");
        require(block.timestamp < option.expirationTime, "Option expired");

        if (option.underlyingAsset == address(0)) {
            require(msg.value == option.premium, "Incorrect premium sent");
            (bool success, ) = payable(option.writer).call{
                value: option.premium
            }("");
            require(success, "Premium transfer failed");
        } else {
            require(msg.value == 0, "No ETH expected");
            IERC20(option.underlyingAsset).safeTransferFrom(
                msg.sender,
                option.writer,
                option.premium
            );
        }

        option.holder = msg.sender;
        userOptions[msg.sender].push(_optionId);
        userProfiles[msg.sender].lastActivityTime = block.timestamp;
        totalVolume += option.premium;

        emit OptionPurchased(_optionId, msg.sender, option.premium);
    }

    /**
     * @dev Exercise an option held by the caller. European options may only
     * be exercised at/after expiration; American options may be exercised
     * any time before expiration.
     */
    function exerciseOption(
        uint256 _optionId
    )
        external
        nonReentrant
        notEmergencyStop
        whenNotPaused
        validOption(_optionId)
    {
        Option storage option = options[_optionId];
        require(option.holder == msg.sender, "Only holder can exercise");

        if (option.optionStyle == OptionStyle.EUROPEAN) {
            require(
                block.timestamp >= option.expirationTime,
                "European option not yet expiration"
            );
        } else {
            require(
                block.timestamp < option.expirationTime,
                "American option expired"
            );
        }

        uint256 currentPrice = _getAssetPrice(option.underlyingAsset);
        uint256 payoff = _calculatePayoff(option, currentPrice);

        option.status = OptionStatus.EXERCISED;

        uint256 settlement =
            payoff > option.collateral ? option.collateral : payoff;
        uint256 remainder = option.collateral - settlement;

        if (settlement > 0) {
            collateralBalances[msg.sender][option.underlyingAsset] +=
                settlement;
        }
        if (remainder > 0) {
            collateralBalances[option.writer][option.underlyingAsset] +=
                remainder;
        }

        uint256 exposure = (option.premium * option.contractSize) / 1e18;
        userProfiles[option.writer].totalExposure -= exposure;
        totalOpenInterest -= exposure;

        emit OptionExercised(_optionId, msg.sender, settlement);
    }

    /**
     * @dev Settle an expired option: returns any remaining locked collateral
     * to the writer if the option was never exercised.
     */
    function settleExpiredOption(uint256 _optionId) external nonReentrant {
        require(_optionId > 0 && _optionId < nextOptionId, "Invalid option ID");
        Option storage option = options[_optionId];
        require(option.status == OptionStatus.ACTIVE, "Option not active");
        require(
            block.timestamp >= option.expirationTime,
            "Option not yet expired"
        );

        option.status = OptionStatus.EXPIRED;
        collateralBalances[option.writer][option.underlyingAsset] += option
            .collateral;

        uint256 exposure = (option.premium * option.contractSize) / 1e18;
        userProfiles[option.writer].totalExposure -= exposure;
        totalOpenInterest -= exposure;

        emit OptionSettled(_optionId, option.writer);
    }

    /**
     * @dev Emergency stop function
     */
    function triggerEmergencyStop() external onlyRole(ADMIN_ROLE) {
        emergencyStopActive = true;
        _pause();
        emit EmergencyAction("EMERGENCY_STOP", msg.sender, block.timestamp);
    }

    /**
     * @dev Resume trading after emergency stop
     */
    function resumeTrading() external onlyRole(ADMIN_ROLE) {
        emergencyStopActive = false;
        _unpause();
        emit EmergencyAction("RESUME_TRADING", msg.sender, block.timestamp);
    }

    /**
     * @dev Check daily volume limits
     */
    function _checkDailyVolumeLimit(uint256 _volume) internal {
        // Reset daily volume if new day
        if (block.timestamp >= lastVolumeResetTime + 86400) {
            dailyVolume = 0;
            lastVolumeResetTime = block.timestamp;
        }

        require(
            dailyVolume + _volume <= maxDailyVolume,
            "Daily volume limit exceeded"
        );

        dailyVolume += _volume;
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
        // Referenced for interface completeness / future price-aware margining.
        _getAssetPrice(_underlyingAsset);

        if (_optionType == OptionType.CALL) {
            // For calls: collateral = contract size of the underlying asset
            return _contractSize;
        } else {
            // For puts: collateral = strike price * contract size
            return (_strikePrice * _contractSize) / 1e18;
        }
    }

    /**
     * @dev Calculate the intrinsic payoff of an option at the current price
     */
    function _calculatePayoff(
        Option memory _option,
        uint256 _currentPrice
    ) internal pure returns (uint256) {
        if (_option.optionType == OptionType.CALL) {
            if (_currentPrice <= _option.strikePrice) {
                return 0;
            }
            return
                ((_currentPrice - _option.strikePrice) * _option.contractSize) /
                1e18;
        } else {
            if (_currentPrice >= _option.strikePrice) {
                return 0;
            }
            return
                ((_option.strikePrice - _currentPrice) * _option.contractSize) /
                1e18;
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
        require(block.timestamp - updatedAt <= oracle.heartbeat, "Price stale");

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
