import json
import os
import threading
from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any

import httpx

from .market_reference import MarketReferenceRate
from .models import RateStatus
from .policies import PRODUCT_TARGET_CURRENCIES


CURRENCYBEACON_LATEST_URL = "https://api.currencybeacon.com/v1/latest"
CURRENCYBEACON_SITE_URL = "https://currencybeacon.com/"
MARKET_REFERENCE_CACHE_TTL = timedelta(hours=1)


class CurrencyBeaconConfigurationError(RuntimeError):
    pass


class CurrencyBeaconResponseError(RuntimeError):
    pass


class CurrencyBeaconClient:
    def __init__(
        self,
        *,
        api_key: str | None = None,
        transport: httpx.BaseTransport | None = None,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self._api_key = api_key
        self._transport = transport
        self._clock = clock or (lambda: datetime.now(UTC))

    def fetch_rates(self) -> dict[str, MarketReferenceRate]:
        api_key = self._api_key or os.environ.get("CURRENCYBEACON_API_KEY")
        if not api_key:
            raise CurrencyBeaconConfigurationError(
                "CURRENCYBEACON_API_KEY is not configured."
            )

        symbols = ("CNY",) + tuple(
            code for code in PRODUCT_TARGET_CURRENCIES if code != "USD"
        )
        with httpx.Client(transport=self._transport, timeout=15.0) as client:
            response = client.get(
                CURRENCYBEACON_LATEST_URL,
                params={"base": "USD", "symbols": ",".join(symbols)},
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Accept": "application/json",
                },
            )
            response.raise_for_status()

        try:
            payload = json.loads(
                response.text, parse_float=Decimal, parse_int=Decimal
            )
            response_data = payload["response"]
            rates = response_data["rates"]
            if payload.get("meta", {}).get("code") != Decimal("200"):
                raise CurrencyBeaconResponseError("CurrencyBeacon reported an error.")
            if response_data.get("base") != "USD" or not isinstance(rates, dict):
                raise CurrencyBeaconResponseError(
                    "CurrencyBeacon latest response has an unexpected structure."
                )
            usd_to_cny = _positive_decimal(rates["CNY"], "CNY")
            published_at = _parse_provider_datetime(response_data["date"])
            denominators = {
                currency_code: (
                    Decimal("1")
                    if currency_code == "USD"
                    else _positive_decimal(rates[currency_code], currency_code)
                )
                for currency_code in PRODUCT_TARGET_CURRENCIES
            }
        except (KeyError, TypeError, ValueError, InvalidOperation) as error:
            raise CurrencyBeaconResponseError(
                "CurrencyBeacon latest response has an unexpected structure."
            ) from error

        retrieved_at = self._clock()
        _require_aware(retrieved_at, "clock")
        result: dict[str, MarketReferenceRate] = {}
        for currency_code in PRODUCT_TARGET_CURRENCIES:
            result[currency_code] = MarketReferenceRate(
                currency_code=currency_code,
                rate=usd_to_cny / denominators[currency_code],
                source_code="currencybeacon",
                source_name="CurrencyBeacon",
                source_url=CURRENCYBEACON_SITE_URL,
                rate_type="mid_market",
                published_at=published_at,
                retrieved_at=retrieved_at,
                status=RateStatus.AVAILABLE,
            )
        return result


class CurrencyBeaconCache:
    def __init__(
        self,
        client: CurrencyBeaconClient,
        *,
        ttl: timedelta = MARKET_REFERENCE_CACHE_TTL,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self._client = client
        self._ttl = ttl
        self._clock = clock or (lambda: datetime.now(UTC))
        self._lock = threading.Lock()
        self._rates: dict[str, MarketReferenceRate] | None = None
        self._cached_at: datetime | None = None

    def get_rate(self, currency_code: str) -> MarketReferenceRate:
        now = self._clock()
        _require_aware(now, "cache clock")
        with self._lock:
            if (
                self._rates is None
                or self._cached_at is None
                or now - self._cached_at >= self._ttl
            ):
                rates = self._client.fetch_rates()
                self._rates = dict(rates)
                self._cached_at = now
            return self._rates[currency_code]


def unavailable_market_reference(
    currency_code: str, *, retrieved_at: datetime
) -> MarketReferenceRate:
    return MarketReferenceRate(
        currency_code=currency_code,
        rate=None,
        source_code="currencybeacon",
        source_name="CurrencyBeacon",
        source_url=CURRENCYBEACON_SITE_URL,
        rate_type="mid_market",
        published_at=None,
        retrieved_at=retrieved_at,
        status=RateStatus.UNAVAILABLE,
    )


def _positive_decimal(value: Any, currency_code: str) -> Decimal:
    decimal_value = value if isinstance(value, Decimal) else Decimal(str(value))
    if decimal_value <= 0:
        raise CurrencyBeaconResponseError(
            f"CurrencyBeacon returned a non-positive rate for {currency_code}."
        )
    return decimal_value


def _parse_provider_datetime(value: Any) -> datetime:
    if not isinstance(value, str):
        raise CurrencyBeaconResponseError("CurrencyBeacon date must be a string.")
    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        parsed_date = date.fromisoformat(value)
        parsed = datetime.combine(parsed_date, datetime.min.time(), tzinfo=UTC)
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed


def _require_aware(value: datetime, label: str) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{label} must return a timezone-aware datetime.")
