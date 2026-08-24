import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from backend.app.exchange_rate.bank_cache import BankSnapshotCache
from backend.app.exchange_rate.market_reference import MarketReferenceRate
from backend.app.exchange_rate.models import BankExchangeRate, RateStatus
from backend.app.exchange_rate.service import ExchangeRateService


NOW = datetime(2026, 8, 24, 6, 0, tzinfo=UTC)
CURRENCIES = ("AUD", "USD", "JPY", "EUR")


def _rate(
    bank_code: str,
    currency_code: str,
    *,
    price: str = "4.8",
    published_at: datetime = NOW,
) -> BankExchangeRate:
    return BankExchangeRate(
        bank_code=bank_code,
        bank_name=f"{bank_code} Bank",
        currency_code=currency_code,
        currency_name=currency_code,
        spot_buy=Decimal(price),
        spot_sell=Decimal(price),
        cash_buy=Decimal(price),
        cash_sell=Decimal(price),
        published_at=published_at,
        status=RateStatus.AVAILABLE,
    )


def _full_snapshot(bank_code: str, *, price: str = "4.8") -> list[BankExchangeRate]:
    return [_rate(bank_code, currency, price=price) for currency in CURRENCIES]


class _SequenceClient:
    def __init__(self, bank_code: str, responses: list[object]) -> None:
        self.bank_code = bank_code
        self.bank_name = f"{bank_code} Bank"
        self._responses = responses
        self.calls = 0
        self._lock = threading.Lock()

    def fetch_rates(self) -> list[BankExchangeRate]:
        with self._lock:
            index = self.calls
            self.calls += 1
        response = self._responses[min(index, len(self._responses) - 1)]
        if isinstance(response, Exception):
            raise response
        return list(response)  # type: ignore[arg-type]


class _MarketProvider:
    def get_rate(self, currency_code: str) -> MarketReferenceRate:
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


def test_first_request_fetches_five_complete_snapshots_concurrently() -> None:
    barrier = threading.Barrier(5)
    state_lock = threading.Lock()
    active = 0
    max_active = 0

    class ConcurrentClient(_SequenceClient):
        def fetch_rates(self) -> list[BankExchangeRate]:
            nonlocal active, max_active
            with state_lock:
                active += 1
                max_active = max(max_active, active)
            try:
                barrier.wait(timeout=2)
                return super().fetch_rates()
            finally:
                with state_lock:
                    active -= 1

    clients = [
        ConcurrentClient(code, [_full_snapshot(code)])
        for code in ("BOC", "ICBC", "CCB", "ABC", "CMB")
    ]
    service = ExchangeRateService(clients, _MarketProvider(), clock=lambda: NOW)

    result = service.get_comparison("AUD")

    assert max_active == 5
    assert [client.calls for client in clients] == [1, 1, 1, 1, 1]
    assert [bank.status for bank in result.banks] == [RateStatus.AVAILABLE] * 5


def test_currency_switches_reuse_each_complete_snapshot_with_zero_refetches() -> None:
    clients = [
        _SequenceClient(code, [_full_snapshot(code)])
        for code in ("BOC", "ICBC", "CCB", "ABC", "CMB")
    ]
    current = [NOW]
    service = ExchangeRateService(
        clients, _MarketProvider(), clock=lambda: current[0]
    )

    for minute, currency in enumerate(CURRENCIES):
        current[0] = NOW + timedelta(minutes=minute)
        result = service.get_comparison(currency)
        assert result.currency_code == currency
        assert [bank.currency_code for bank in result.banks] == [currency] * 5

    assert [client.calls for client in clients] == [1, 1, 1, 1, 1]


def test_cache_hit_before_five_minutes_and_refresh_at_boundary() -> None:
    current = [NOW]
    client = _SequenceClient("BOC", [_full_snapshot("BOC")])
    cache = BankSnapshotCache(client, clock=lambda: current[0])

    first = cache.get_snapshot()
    current[0] = NOW + timedelta(minutes=4, seconds=59)
    assert cache.get_snapshot() is first
    assert client.calls == 1

    current[0] = NOW + timedelta(minutes=5)
    refreshed = cache.get_snapshot()
    assert refreshed is not first
    assert refreshed.retrieved_at == current[0]
    assert client.calls == 2


def test_banks_refresh_independently_when_only_one_snapshot_is_expired() -> None:
    current = [NOW]
    expired_client = _SequenceClient("BOC", [_full_snapshot("BOC")])
    valid_client = _SequenceClient("ICBC", [_full_snapshot("ICBC")])
    expired_cache = BankSnapshotCache(expired_client, clock=lambda: current[0])
    valid_cache = BankSnapshotCache(valid_client, clock=lambda: current[0])

    expired_cache.get_snapshot()
    current[0] = NOW + timedelta(minutes=2)
    valid_cache.get_snapshot()
    current[0] = NOW + timedelta(minutes=5)

    expired_cache.get_snapshot()
    valid_cache.get_snapshot()
    assert expired_client.calls == 2
    assert valid_client.calls == 1


def test_successful_refresh_replaces_the_full_snapshot() -> None:
    current = [NOW]
    client = _SequenceClient(
        "BOC",
        [_full_snapshot("BOC", price="4.8"), _full_snapshot("BOC", price="4.9")],
    )
    cache = BankSnapshotCache(client, clock=lambda: current[0])

    first = cache.get_snapshot()
    current[0] += timedelta(minutes=5)
    second = cache.get_snapshot()

    assert len(first.rates) == len(CURRENCIES)
    assert len(second.rates) == len(CURRENCIES)
    assert first.rates[0].spot_buy == Decimal("4.8")
    assert second.rates[0].spot_buy == Decimal("4.9")


def test_failed_refresh_retains_last_known_good_and_quote_freshness_is_independent() -> None:
    current = [NOW]
    client = _SequenceClient(
        "BOC", [_full_snapshot("BOC"), RuntimeError("temporary upstream failure")]
    )
    service = ExchangeRateService(
        [client], _MarketProvider(), clock=lambda: current[0]
    )

    first = service.get_comparison("AUD")
    current[0] = NOW + timedelta(minutes=6)
    recent_fallback = service.get_comparison("AUD")
    current[0] = NOW + timedelta(days=8)
    old_quote_fallback = service.get_comparison("AUD")

    assert client.calls == 3
    assert first.banks[0].status == RateStatus.AVAILABLE
    assert recent_fallback.banks[0].status == RateStatus.AVAILABLE
    assert old_quote_fallback.banks[0].spot_buy == first.banks[0].spot_buy
    assert old_quote_fallback.banks[0].published_at == NOW
    assert old_quote_fallback.banks[0].status == RateStatus.STALE


def test_initial_bank_failure_without_snapshot_remains_partial() -> None:
    failed = _SequenceClient("BOC", [RuntimeError("first fetch failed")])
    healthy = _SequenceClient("ICBC", [_full_snapshot("ICBC")])
    service = ExchangeRateService(
        [failed, healthy], _MarketProvider(), clock=lambda: NOW
    )

    result = service.get_comparison("AUD")

    assert [bank.status for bank in result.banks] == [
        RateStatus.UNAVAILABLE,
        RateStatus.AVAILABLE,
    ]


def test_concurrent_expiry_requests_share_one_same_bank_refresh() -> None:
    current = [NOW]

    class SlowRefreshClient(_SequenceClient):
        def fetch_rates(self) -> list[BankExchangeRate]:
            if self.calls >= 1:
                time.sleep(0.05)
            return super().fetch_rates()

    client = SlowRefreshClient(
        "BOC",
        [_full_snapshot("BOC", price="4.8"), _full_snapshot("BOC", price="4.9")],
    )
    cache = BankSnapshotCache(client, clock=lambda: current[0])
    cache.get_snapshot()
    current[0] += timedelta(minutes=5)
    start = threading.Barrier(8)

    def get_after_barrier():
        start.wait(timeout=2)
        return cache.get_snapshot()

    with ThreadPoolExecutor(max_workers=8) as executor:
        snapshots = list(executor.map(lambda _: get_after_barrier(), range(8)))

    assert client.calls == 2
    assert {snapshot.rates[0].spot_buy for snapshot in snapshots} == {Decimal("4.9")}
