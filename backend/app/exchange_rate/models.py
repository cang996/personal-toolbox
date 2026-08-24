from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from enum import Enum


class RateStatus(str, Enum):
    AVAILABLE = "available"
    STALE = "stale"
    UNAVAILABLE = "unavailable"
    UNSUPPORTED = "unsupported"


@dataclass(frozen=True)
class BankExchangeRate:
    bank_code: str
    bank_name: str
    currency_code: str | None
    currency_name: str | None
    spot_buy: Decimal | None
    spot_sell: Decimal | None
    cash_buy: Decimal | None
    cash_sell: Decimal | None
    published_at: datetime
    status: RateStatus
    derived_fields: frozenset[str] = field(default_factory=frozenset)

    def __post_init__(self) -> None:
        if self.published_at.tzinfo is None or self.published_at.utcoffset() is None:
            raise ValueError("BankExchangeRate published_at must be timezone-aware.")
