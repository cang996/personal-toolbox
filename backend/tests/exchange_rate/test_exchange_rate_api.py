from datetime import datetime, timedelta

from fastapi.testclient import TestClient

from backend.app.exchange_rate.api import create_app
from backend.app.exchange_rate.service import ExchangeRateService
from backend.tests.exchange_rate.test_exchange_rate_service import (
    NOW,
    _BankClient,
    _MarketProvider,
    _bank_rate,
)


def _client(*, failed_bank: bool = False) -> TestClient:
    bank_clients = [
        _BankClient("OK", [_bank_rate(age=timedelta())]),
        _BankClient(
            "FAIL",
            error=RuntimeError("upstream secret") if failed_bank else None,
            rates=[] if failed_bank else [_bank_rate(age=timedelta())],
        ),
    ]
    service = ExchangeRateService(
        bank_clients, _MarketProvider(), clock=lambda: NOW
    )
    return TestClient(create_app(service))


def test_supported_currency_normalizes_and_serializes_financial_values() -> None:
    response = _client().get("/api/exchange-rates/aud")

    assert response.status_code == 200
    body = response.json()
    assert body["currency_code"] == "AUD"
    assert body["market_reference"]["rate"] == "4.75"
    assert body["market_reference"]["source_name"] == "CurrencyBeacon"
    assert datetime.fromisoformat(
        body["market_reference"]["published_at"]
    ).utcoffset() is not None
    assert body["banks"][0]["spot_buy"] == "4.5001"
    assert datetime.fromisoformat(body["banks"][0]["published_at"]).utcoffset() is not None


def test_invalid_product_currency_is_explicit_4xx() -> None:
    response = _client().get("/api/exchange-rates/CNY")

    assert response.status_code == 400
    assert "Unsupported product currency" in response.json()["detail"]


def test_partial_bank_failure_endpoint_still_succeeds_without_error_leak() -> None:
    response = _client(failed_bank=True).get("/api/exchange-rates/AUD")

    assert response.status_code == 200
    body = response.json()
    assert [bank["status"] for bank in body["banks"]] == ["available", "unavailable"]
    assert body["banks"][1]["published_at"] is None
    assert "upstream secret" not in response.text


def test_cors_allows_only_configured_development_origin() -> None:
    allowed = _client().options(
        "/api/exchange-rates/AUD",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    denied = _client().options(
        "/api/exchange-rates/AUD",
        headers={
            "Origin": "https://untrusted.example",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-origin" not in denied.headers
