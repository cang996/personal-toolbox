import logging
from collections.abc import Callable, Sequence
from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Protocol

from backend.app.exchange_rate.currencybeacon import unavailable_market_reference
from backend.app.exchange_rate.market_reference import MarketReferenceRate
from backend.app.exchange_rate.models import BankExchangeRate, RateStatus
from backend.app.exchange_rate.policies import (
    BANK_QUOTE_STALE_AFTER,
    PRODUCT_TARGET_CURRENCIES,
)


LOGGER = logging.getLogger(__name__)


class BankRateClient(Protocol):
    bank_code: str
    bank_name: str

    def fetch_rates(self) -> list[BankExchangeRate]: ...


class MarketRateProvider(Protocol):
    def get_rate(self, currency_code: str) -> MarketReferenceRate: ...


@dataclass(frozen=True)
class BankQuoteResult:
    bank_code: str
    bank_name: str
    currency_code: str
    currency_name: str | None
    spot_buy: Decimal | None
    spot_sell: Decimal | None
    cash_buy: Decimal | None
    cash_sell: Decimal | None
    published_at: datetime | None
    status: RateStatus


@dataclass(frozen=True)
class ExchangeRateComparison:
    currency_code: str
    market_reference: MarketReferenceRate
    banks: tuple[BankQuoteResult, ...]


class ExchangeRateService:
    def __init__(
        self,
        bank_clients: Sequence[BankRateClient],
        market_provider: MarketRateProvider,
        *,
        stale_after: timedelta = BANK_QUOTE_STALE_AFTER,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self._bank_clients = tuple(bank_clients)
        self._market_provider = market_provider
        self._stale_after = stale_after
        self._clock = clock or (lambda: datetime.now(UTC))

    def get_comparison(self, currency_code: str) -> ExchangeRateComparison:
        normalized_code = currency_code.upper()
        if normalized_code not in PRODUCT_TARGET_CURRENCIES:
            raise ValueError(f"Unsupported product currency: {currency_code}")

        now = self._clock()
        _require_aware(now)
        bank_results = tuple(
            self._get_bank_quote(client, normalized_code, now)
            for client in self._bank_clients
        )
        try:
            market_reference = self._market_provider.get_rate(normalized_code)
        except Exception:
            LOGGER.exception(
                "Market reference retrieval failed for %s", normalized_code
            )
            market_reference = unavailable_market_reference(
                normalized_code, retrieved_at=now
            )
        return ExchangeRateComparison(
            currency_code=normalized_code,
            market_reference=market_reference,
            banks=bank_results,
        )

    def _get_bank_quote(
        self, client: BankRateClient, currency_code: str, now: datetime
    ) -> BankQuoteResult:
        try:
            rates = client.fetch_rates()
            matching = next(
                (rate for rate in rates if rate.currency_code == currency_code), None
            )
            if matching is None:
                return _unavailable_bank_quote(client, currency_code)
            current = apply_freshness(
                matching, now=now, stale_after=self._stale_after
            )
            return BankQuoteResult(
                bank_code=current.bank_code,
                bank_name=current.bank_name,
                currency_code=currency_code,
                currency_name=current.currency_name,
                spot_buy=current.spot_buy,
                spot_sell=current.spot_sell,
                cash_buy=current.cash_buy,
                cash_sell=current.cash_sell,
                published_at=current.published_at,
                status=current.status,
            )
        except Exception:
            LOGGER.exception(
                "Bank rate retrieval failed for %s (%s)",
                client.bank_code,
                currency_code,
            )
            return _unavailable_bank_quote(client, currency_code)


def apply_freshness(
    rate: BankExchangeRate,
    *,
    now: datetime,
    stale_after: timedelta = BANK_QUOTE_STALE_AFTER,
) -> BankExchangeRate:
    _require_aware(now)
    has_quote = any(
        value is not None
        for value in (rate.spot_buy, rate.spot_sell, rate.cash_buy, rate.cash_sell)
    )
    if not has_quote:
        status = RateStatus.UNAVAILABLE
    elif rate.status == RateStatus.UNSUPPORTED:
        status = RateStatus.UNSUPPORTED
    elif now - rate.published_at > stale_after:
        status = RateStatus.STALE
    else:
        status = RateStatus.AVAILABLE
    return replace(rate, status=status)


def _unavailable_bank_quote(
    client: BankRateClient, currency_code: str
) -> BankQuoteResult:
    return BankQuoteResult(
        bank_code=client.bank_code,
        bank_name=client.bank_name,
        currency_code=currency_code,
        currency_name=None,
        spot_buy=None,
        spot_sell=None,
        cash_buy=None,
        cash_sell=None,
        published_at=None,
        status=RateStatus.UNAVAILABLE,
    )


def _require_aware(value: datetime) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Service clock must return a timezone-aware datetime.")
