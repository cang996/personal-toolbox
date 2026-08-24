from datetime import UTC, datetime, timedelta
from decimal import Decimal

import httpx
import pytest

from backend.app.exchange_rate.currencybeacon import (
    CURRENCYBEACON_LATEST_URL,
    MARKET_REFERENCE_CACHE_TTL,
    CurrencyBeaconCache,
    CurrencyBeaconClient,
    CurrencyBeaconConfigurationError,
)
from backend.app.exchange_rate.models import RateStatus
from backend.app.exchange_rate.policies import PRODUCT_TARGET_CURRENCIES


NOW = datetime(2026, 8, 24, 4, 0, tzinfo=UTC)


def _payload() -> dict:
    rates = {code: str(index + 2) for index, code in enumerate(PRODUCT_TARGET_CURRENCIES)}
    rates["CNY"] = "7.2"
    return {
        "meta": {"code": 200},
        "response": {
            "date": "2026-08-24T03:59:00Z",
            "base": "USD",
            "rates": rates,
        },
    }


def test_currencybeacon_uses_one_bearer_request_and_decimal_cross_rates() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json=_payload(), request=request)

    client = CurrencyBeaconClient(
        api_key="secret", transport=httpx.MockTransport(handler), clock=lambda: NOW
    )

    rates = client.fetch_rates()

    assert len(requests) == 1
    assert str(requests[0].url).startswith(CURRENCYBEACON_LATEST_URL)
    assert requests[0].headers["Authorization"] == "Bearer secret"
    assert requests[0].url.params["base"] == "USD"
    assert len(requests[0].url.params["symbols"].split(",")) == 14
    assert rates["USD"].rate == Decimal("7.2")
    assert rates["AUD"].rate == Decimal("7.2") / Decimal("7")
    assert rates["AUD"].source_code == "currencybeacon"
    assert rates["AUD"].source_name == "CurrencyBeacon"
    assert rates["AUD"].rate_type == "mid_market"
    assert rates["AUD"].status == RateStatus.AVAILABLE
    assert rates["AUD"].published_at.isoformat() == "2026-08-24T03:59:00+00:00"


def test_missing_currencybeacon_api_key_fails_before_network(monkeypatch) -> None:
    monkeypatch.delenv("CURRENCYBEACON_API_KEY", raising=False)
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(500)

    client = CurrencyBeaconClient(transport=httpx.MockTransport(handler))

    with pytest.raises(CurrencyBeaconConfigurationError):
        client.fetch_rates()
    assert calls == 0


class _CountingClient:
    def __init__(self) -> None:
        self.calls = 0

    def fetch_rates(self):
        self.calls += 1
        transport = httpx.MockTransport(
            lambda request: httpx.Response(200, json=_payload(), request=request)
        )
        return CurrencyBeaconClient(
            api_key="secret", transport=transport, clock=lambda: NOW
        ).fetch_rates()


def test_lazy_cache_hits_within_ttl_and_refreshes_at_expiry() -> None:
    current = [NOW]
    client = _CountingClient()
    cache = CurrencyBeaconCache(client, clock=lambda: current[0])

    first = cache.get_rate("AUD")
    current[0] += timedelta(minutes=59)
    second = cache.get_rate("CAD")
    assert client.calls == 1

    current[0] += timedelta(minutes=1)
    third = cache.get_rate("AUD")
    assert client.calls == 2
    assert first == third
    assert second.currency_code == "CAD"
    assert MARKET_REFERENCE_CACHE_TTL == timedelta(hours=1)
