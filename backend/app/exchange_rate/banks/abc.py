import json
import math
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any


ABC_QUOTE_UNIT = 100
CURRENCY_CODE_PATTERN = re.compile(r"\(([A-Z]{3})\)\s*$")
REQUIRED_RECORD_FIELDS = {
    "BenchMarkPrice",
    "BuyingPrice",
    "CashBuyingPrice",
    "CurrId",
    "CurrName",
    "PublishTime",
    "SellPrice",
}


@dataclass(frozen=True)
class AbcRate:
    currency_name: str
    currency_code: str | None
    currency_id: str
    abc_benchmark_rate: float | None
    spot_buy: float | None
    spot_sell: float | None
    cash_buy: float | None
    published_at: str


def parse_abc_rates(payload: str | dict[str, Any]) -> list[AbcRate]:
    """Parse an ABC ExchangeRateV2 response into CNY per foreign-currency unit."""
    if isinstance(payload, str):
        try:
            parsed_payload = json.loads(payload)
        except json.JSONDecodeError as error:
            raise ValueError("ABC response is not valid JSON.") from error
    else:
        parsed_payload = payload

    if not isinstance(parsed_payload, dict):
        raise ValueError("ABC response must be a JSON object.")

    error_code = parsed_payload.get("ErrorCode")
    if error_code != "0":
        raise ValueError(f"ABC response ErrorCode must be '0', received {error_code!r}.")

    data = parsed_payload.get("Data")
    if not isinstance(data, dict):
        raise ValueError("ABC response Data must be an object.")

    table = data.get("Table")
    if not isinstance(table, list):
        raise ValueError("ABC response Data.Table must be a list.")
    if not table:
        raise ValueError("ABC response Data.Table does not contain any rate records.")

    return [_parse_record(record, index) for index, record in enumerate(table)]


def _parse_record(record: Any, index: int) -> AbcRate:
    if not isinstance(record, dict):
        raise ValueError(f"ABC record at index {index} must be an object.")

    missing_fields = REQUIRED_RECORD_FIELDS - record.keys()
    if missing_fields:
        fields = ", ".join(sorted(missing_fields))
        raise ValueError(f"ABC record at index {index} is missing fields: {fields}.")

    currency_name = _required_text(record["CurrName"], "CurrName", index)
    currency_id = _required_text(record["CurrId"], "CurrId", index)
    code_match = CURRENCY_CODE_PATTERN.search(currency_name)

    return AbcRate(
        currency_name=currency_name,
        currency_code=code_match.group(1) if code_match else None,
        currency_id=currency_id,
        abc_benchmark_rate=_parse_quote(
            record["BenchMarkPrice"], "BenchMarkPrice", index
        ),
        spot_buy=_parse_quote(record["BuyingPrice"], "BuyingPrice", index),
        spot_sell=_parse_quote(record["SellPrice"], "SellPrice", index),
        cash_buy=_parse_quote(record["CashBuyingPrice"], "CashBuyingPrice", index),
        published_at=_parse_published_at(record["PublishTime"], index),
    )


def _required_text(value: Any, field: str, index: int) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"ABC record at index {index} has invalid {field}.")
    return value.strip()


def _parse_quote(value: Any, field: str, index: int) -> float | None:
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    if isinstance(value, bool):
        raise ValueError(f"ABC record at index {index} has invalid {field}: {value!r}.")

    normalized_value = value.replace(",", "") if isinstance(value, str) else value
    try:
        quote = float(normalized_value)
    except (TypeError, ValueError) as error:
        raise ValueError(
            f"ABC record at index {index} has invalid {field}: {value!r}."
        ) from error

    if not math.isfinite(quote) or quote < 0:
        raise ValueError(f"ABC record at index {index} has invalid {field}: {value!r}.")
    return quote / ABC_QUOTE_UNIT


def _parse_published_at(value: Any, index: int) -> str:
    published_time = _required_text(value, "PublishTime", index)
    try:
        published_at = datetime.fromisoformat(published_time)
    except ValueError as error:
        raise ValueError(
            f"ABC record at index {index} has invalid PublishTime: {value!r}."
        ) from error

    if published_at.utcoffset() is None:
        raise ValueError(
            f"ABC record at index {index} has invalid PublishTime: {value!r}."
        )
    return published_at.isoformat(sep=" ", timespec="seconds")
