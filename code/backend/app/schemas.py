"""
Pydantic schemas for Optionix platform.
Includes schemas for security, compliance, and financial standards features.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserRole(str, Enum):
    ADMIN = "admin"
    TRADER = "trader"
    VIEWER = "viewer"
    COMPLIANCE_OFFICER = "compliance_officer"
    RISK_MANAGER = "risk_manager"
    API_USER = "api_user"


class KYCStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    UNDER_REVIEW = "under_review"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ComplianceStatus(str, Enum):
    COMPLIANT = "compliant"
    NON_COMPLIANT = "non_compliant"
    UNDER_REVIEW = "under_review"
    PENDING = "pending"


class BaseResponse(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    request_id: Optional[str] = None


class ErrorResponse(BaseResponse):
    error: str
    message: str
    details: Optional[Dict[str, Any]] = None


class HealthCheckResponse(BaseResponse):
    status: str
    version: str
    services: Dict[str, str]
    security_features: Optional[Dict[str, bool]] = None


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=255)
    data_retention_consent: bool = False
    marketing_consent: bool = False
    data_processing_consent: bool = True

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        stripped = v.strip()
        if (
            not stripped.replace(" ", "")
            .replace("-", "")
            .replace("'", "")
            .replace(".", "")
            .isalpha()
        ):
            raise ValueError(
                "Full name must contain only letters, spaces, hyphens, apostrophes, and periods"
            )
        return stripped

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    mfa_token: Optional[str] = Field(None, min_length=6, max_length=6)
    remember_me: bool = False


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    is_verified: bool
    kyc_status: str
    mfa_enabled: bool
    risk_score: int
    created_at: datetime
    last_login: Optional[datetime] = None


class TokenResponse(BaseResponse):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    session_id: Optional[str] = None


class MFASetupResponse(BaseResponse):
    secret: str
    qr_code: str
    backup_codes: List[str]


class MFAVerifyRequest(BaseModel):
    token: str = Field(..., min_length=6, max_length=6)


class AddressData(BaseModel):
    street: str = Field(..., min_length=5, max_length=255)
    city: str = Field(..., min_length=2, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: str = Field(..., min_length=3, max_length=20)
    country: str = Field(..., min_length=2, max_length=3)


class KYCDataRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    date_of_birth: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    nationality: str = Field(..., min_length=2, max_length=3)
    address: AddressData
    document_type: str = Field(..., pattern=r"^(passport|national_id|drivers_license)$")
    document_number: str = Field(..., min_length=5, max_length=50)
    document_country: str = Field(..., min_length=2, max_length=3)
    document_expiry: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")

    @field_validator("date_of_birth")
    @classmethod
    def validate_date_of_birth(cls, v: str) -> str:
        try:
            birth_date = datetime.strptime(v, "%Y-%m-%d")
            age = (datetime.now() - birth_date).days / 365.25
            if age < 18:
                raise ValueError("Must be at least 18 years old")
            if age > 120:
                raise ValueError("Invalid date of birth")
        except ValueError as e:
            if "Invalid date of birth" in str(e) or "Must be at least" in str(e):
                raise
            raise ValueError("Invalid date format. Use YYYY-MM-DD")
        return v


class AccountCreate(BaseModel):
    ethereum_address: str = Field(..., pattern=r"^0x[a-fA-F0-9]{40}$")
    account_type: str = Field(
        default="standard", pattern=r"^(standard|premium|institutional|demo)$"
    )
    initial_deposit: Optional[Decimal] = Field(None, ge=0, le=1000000)


class AccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: str
    ethereum_address: str
    account_type: str
    account_status: str
    balance_usd: Decimal
    margin_available: Decimal
    margin_used: Decimal
    risk_limit: Decimal
    created_at: datetime


class TradeRequest(BaseModel):
    account_id: int
    symbol: str = Field(..., min_length=3, max_length=20)
    trade_type: str = Field(..., pattern=r"^(buy|sell)$")
    order_type: str = Field(..., pattern=r"^(market|limit|stop|stop_limit)$")
    quantity: Decimal = Field(..., gt=0, le=1000000)
    price: Optional[Decimal] = Field(None, gt=0, le=1000000)
    stop_loss: Optional[Decimal] = Field(None, gt=0)
    take_profit: Optional[Decimal] = Field(None, gt=0)
    client_order_id: Optional[str] = Field(None, max_length=100)

    @field_validator("price")
    @classmethod
    def validate_price_for_limit_orders(
        cls, v: Optional[Decimal], info: Any
    ) -> Optional[Decimal]:
        order_type = info.data.get("order_type") if info.data else None
        if order_type in ["limit", "stop_limit"] and v is None:
            raise ValueError("Price is required for limit and stop-limit orders")
        return v


class TradeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    trade_id: str
    symbol: str
    trade_type: str
    order_type: str
    quantity: Decimal
    price: Decimal
    executed_price: Optional[Decimal]
    total_value: Decimal
    fees: Decimal
    status: str
    compliance_status: str
    risk_score: int
    created_at: datetime
    executed_at: Optional[datetime]


class PositionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    position_id: str
    symbol: str
    position_type: str
    size: Decimal
    entry_price: Decimal
    current_price: Optional[Decimal]
    liquidation_price: Optional[Decimal]
    unrealized_pnl: Decimal
    margin_requirement: Decimal
    status: str
    created_at: datetime
    delta: Optional[Decimal] = None
    gamma: Optional[Decimal] = None
    theta: Optional[Decimal] = None
    vega: Optional[Decimal] = None
    rho: Optional[Decimal] = None


class PositionHealthResponse(BaseModel):
    position_id: str
    health_score: Decimal
    margin_ratio: Decimal
    liquidation_risk: RiskLevel
    time_to_liquidation: Optional[int]
    recommended_actions: List[str]
    risk_metrics: Dict[str, Decimal]


class BlockchainStatusResponse(BaseModel):
    web3_installed: bool
    rpc_connected: bool
    futures_contract_configured: bool
    options_contract_configured: bool


class WalletBalanceResponse(BaseModel):
    address: str
    balance_eth: Decimal


class OnChainPositionSummary(BaseModel):
    position_id: int
    underlying_asset: str
    position_type: str
    size: Decimal
    entry_price: Decimal
    margin: Decimal
    leverage: int
    liquidation_price: Decimal
    status: str


class OnChainPositionHealthResponse(BaseModel):
    address: str
    positions: List[OnChainPositionSummary]
    total_margin_used: Decimal
    total_margin_available: Decimal
    health_ratio: float
    liquidation_risk: str


class OnChainOptionResponse(BaseModel):
    option_id: int
    writer: str
    holder: str
    option_type: str
    option_style: str
    strike_price: Decimal
    premium: Decimal
    expiration_time: int
    collateral: Decimal
    status: str
    underlying_asset: str
    contract_size: Decimal
    creation_time: int


class MarginTxRequest(BaseModel):
    user_address: str = Field(..., pattern=r"^0x[a-fA-F0-9]{40}$")
    amount: Decimal = Field(..., gt=0)
    asset_address: Optional[str] = Field(
        None,
        pattern=r"^0x[a-fA-F0-9]{40}$",
        description="ERC-20 token address, or omit for native ETH",
    )


class OptionTxRequest(BaseModel):
    wallet_address: str = Field(..., pattern=r"^0x[a-fA-F0-9]{40}$")
    option_id: int = Field(..., ge=0)


class UnsignedTransactionResponse(BaseModel):
    """
    An unsigned transaction ready for the caller's own wallet to sign and
    submit. The backend never sees or handles a private key.
    """

    transaction: Dict[str, Any]


class TransactionStatusResponse(BaseModel):
    hash: str
    status: str
    block_number: Optional[int] = None
    gas_used: Optional[int] = None
    confirmations: Optional[int] = None
    error: Optional[str] = None


class MarketDataRequest(BaseModel):
    """Market data request schema for volatility prediction"""

    symbol: str = Field(..., min_length=1, max_length=20)
    open: Decimal = Field(..., gt=0)
    high: Decimal = Field(..., gt=0)
    low: Decimal = Field(..., gt=0)
    close: Optional[Decimal] = Field(None, gt=0)
    volume: Decimal = Field(..., ge=0)
    timeframe: str = Field(default="1h", pattern=r"^(1m|5m|15m|1h|4h|1d)$")
    limit: int = Field(default=100, ge=1, le=1000)


class VolatilityResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    symbol: str
    volatility: Decimal
    confidence: Optional[Decimal]
    model_version: Optional[str]
    prediction_horizon: str
    timestamp: datetime


class ComplianceCheckResponse(BaseResponse):
    status: ComplianceStatus
    risk_level: RiskLevel
    checks_performed: List[str]
    issues_found: List[str]
    recommendations: List[str]
    next_review_date: Optional[datetime] = None


class RiskMetricsResponse(BaseResponse):
    user_id: str
    risk_metrics: Dict[str, Dict[str, Any]]
    overall_risk_score: int
    last_updated: str


class TransactionMonitoringAlert(BaseModel):
    alert_id: str
    alert_type: str
    alert_category: str
    description: str
    risk_score: int
    risk_level: RiskLevel
    status: str
    created_at: datetime


class SanctionsCheckResponse(BaseModel):
    check_id: str
    matches_found: bool
    match_details: List[Dict[str, Any]]
    lists_checked: List[str]
    risk_score: int
    checked_at: datetime


class APIKeyCreate(BaseModel):
    key_name: str = Field(..., min_length=3, max_length=100)
    permissions: List[str]
    ip_whitelist: Optional[List[str]] = None
    expires_in_days: Optional[int] = Field(None, ge=1, le=365)


class APIKeyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key_id: str
    key_name: str
    key_prefix: str
    permissions: List[str]
    is_active: bool
    created_at: datetime
    expires_at: Optional[datetime]
    last_used_at: Optional[datetime]


class APIKeyCreateResponse(APIKeyResponse):
    api_key: str


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    log_id: str
    action: str
    action_category: str
    resource_type: Optional[str]
    resource_id: Optional[str]
    status: str
    ip_address: Optional[str]
    timestamp: datetime
    compliance_impact: str


class AuditLogQuery(BaseModel):
    user_id: Optional[int] = None
    action_category: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    limit: int = Field(default=100, ge=1, le=1000)
    offset: int = Field(default=0, ge=0)


class FinancialReportRequest(BaseModel):
    report_type: str = Field(..., pattern=r"^(daily|weekly|monthly|quarterly|annual)$")
    regulation_type: str = Field(
        ..., pattern=r"^(sox|mifid_ii|dodd_frank|basel_iii|cftc)$"
    )
    period_start: datetime
    period_end: datetime
    include_details: bool = False


class FinancialReportResponse(BaseResponse):
    report_id: str
    report_type: str
    regulation_type: str
    period_start: datetime
    period_end: datetime
    status: str
    generated_at: datetime
    data_summary: Dict[str, Any]


class DataSubjectRequest(BaseModel):
    request_type: str = Field(
        ..., pattern=r"^(access|rectification|erasure|portability|restriction)$"
    )
    description: Optional[str] = Field(None, max_length=1000)
    verification_method: Optional[str] = Field(
        None, pattern=r"^(email|phone|document)$"
    )


class DataSubjectRequestResponse(BaseResponse):
    request_id: str
    request_type: str
    status: str
    estimated_completion: Optional[datetime]
    verification_required: bool


class DataExportResponse(BaseResponse):
    export_id: str
    file_path: str
    file_size: int
    expires_at: datetime


class ReconciliationRequest(BaseModel):
    reconciliation_type: str = Field(..., pattern=r"^(daily|monthly|trade|position)$")
    business_date: datetime
    tolerance_threshold: Optional[Decimal] = Field(Decimal("0.01"), ge=0)


class ReconciliationResponse(BaseResponse):
    reconciliation_id: str
    reconciliation_type: str
    status: str
    internal_balance: Decimal
    external_balance: Decimal
    difference: Decimal
    within_tolerance: bool
    business_date: datetime


class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    size: int
    pages: int
    has_next: bool
    has_prev: bool


class BulkOperationRequest(BaseModel):
    operation_type: str
    items: List[Dict[str, Any]]
    batch_size: int = Field(default=100, ge=1, le=1000)


class BulkOperationResponse(BaseResponse):
    operation_id: str
    total_items: int
    processed_items: int
    failed_items: int
    status: str
    errors: List[Dict[str, Any]]


class NotificationPreferences(BaseModel):
    email_enabled: bool = True
    sms_enabled: bool = False
    push_enabled: bool = True
    trade_notifications: bool = True
    compliance_notifications: bool = True
    security_notifications: bool = True
    marketing_notifications: bool = False


class NotificationResponse(BaseModel):
    notification_id: str
    type: str
    title: str
    message: str
    priority: str
    read: bool
    created_at: datetime


class SystemConfigResponse(BaseModel):
    trading_enabled: bool
    maintenance_mode: bool
    api_version: str
    supported_symbols: List[str]
    trading_hours: Dict[str, str]
    fee_structure: Dict[str, Decimal]
    risk_limits: Dict[str, Decimal]
