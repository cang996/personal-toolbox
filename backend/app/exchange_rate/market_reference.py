from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from .models import RateStatus


@dataclass(frozen=True)
class MarketReferenceRate:
    currency_code: str
    rate: Decimal | None
    source_code: str
    source_name: str
    source_url: str
    rate_type: str
    published_at: datetime | None
    retrieved_at: datetime
    status: RateStatus

    def __post_init__(self) -> None:
        if self.published_at is not None and (
            self.published_at.tzinfo is None
            or self.published_at.utcoffset() is None
        ):
            raise ValueError("MarketReferenceRate published_at must be timezone-aware.")
        if self.retrieved_at.tzinfo is None or self.retrieved_at.utcoffset() is None:
            raise ValueError("MarketReferenceRate retrieved_at must be timezone-aware.")
