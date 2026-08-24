from datetime import UTC, datetime, timedelta
from decimal import Decimal

from backend.app.exchange_rate.market_reference import MarketReferenceRate
from backend.app.exchange_rate.models import BankExchangeRate, RateStatus
from backend.app.exchange_rate.service import ExchangeRateService, apply_freshness


NOW = datetime(2026, 8, 24, 12, 0, tzinfo=UTC)


def _bank_rate(*, age: timedelta, prices: bool = True) -> BankExchangeRate:
    return BankExchangeRate(
        bank_code="OK",
        bank_name="Test Bank",
        currency_code="AUD",
        currency_name="Australian Dollar",
        spot_buy=Decimal("4.5001") if prices else None,
        spot_sell=Decimal("4.6002") if prices else None,
        cash_buy=None,
        cash_sell=None,
        published_at=NOW - age,
        status=RateStatus.AVAILABLE,
    )


class _BankClient:
    def __init__(self, code: str, rates=None, error: Exception | None = None) -> None:
        self.bank_code = code
        self.bank_name = f"{code} Bank"
        self.rates = rates or []
        self.error = error

    def fetch_rates(self):
        if self.error:
            raise self.error
        return self.rates


class _MarketProvider:
    def __init__(self, error: Exception | None = None) -> None:
        self.error = error

    def get_rate(self, currency_code: str) -> MarketReferenceRate:
        if self.error:
            raise self.error
        return MarketReferenceRate(
            currency_code=currency_code,
            rate=Decimal("4.75"),
            source_code="currencybeacon",
            source_name="CurrencyBeacon",
            source_url="https://currencybeacon.com/",
            rate_type="mid_market",
            published_at=NOW,
            retrieved_at=NOW,
            status=RateStatus.AVAILABLE,
        )


def test_freshness_boundary_is_available_and_after_boundary_is_stale() -> None:
    assert apply_freshness(_bank_rate(age=timedelta(days=7)), now=NOW).status == RateStatus.AVAILABLE
    assert apply_freshness(
        _bank_rate(age=timedelta(days=7, microseconds=1)), now=NOW
    ).status == RateStatus.STALE


def test_no_prices_is_unavailable_not_unsupported() -> None:
    result = apply_freshness(_bank_rate(age=timedelta(), prices=False), now=NOW)
    assert result.status == RateStatus.UNAVAILABLE


def test_bank_failure_and_missing_currency_are_independent_unavailable_results() -> None:
    service = ExchangeRateService(
        [
            _BankClient("OK", [_bank_rate(age=timedelta())]),
            _BankClient("FAIL", error=RuntimeError("private upstream detail")),
            _BankClient("MISSING", []),
        ],
        _MarketProvider(),
        clock=lambda: NOW,
    )
    comparison = service.get_comparison("aud")

    assert comparison.currency_code == "AUD"
    assert comparison.banks[0].spot_buy == Decimal("4.5001")
    assert comparison.banks[1].status == RateStatus.UNAVAILABLE
    assert comparison.banks[1].published_at is None
    assert comparison.banks[2].status == RateStatus.UNAVAILABLE


def test_provider_failure_keeps_bank_results_and_clear_unavailable_reference() -> None:
    service = ExchangeRateService(
        [_BankClient("OK", [_bank_rate(age=timedelta())])],
        _MarketProvider(error=RuntimeError("provider detail")),
        clock=lambda: NOW,
    )

    comparison = service.get_comparison("AUD")

    assert comparison.banks[0].status == RateStatus.AVAILABLE
    assert comparison.market_reference.status == RateStatus.UNAVAILABLE
    assert comparison.market_reference.rate is None
    assert comparison.market_reference.source_code == "currencybeacon"
