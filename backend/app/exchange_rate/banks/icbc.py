import json
import math
from dataclasses import dataclass
from datetime import datetime
from typing import Any


ICBC_QUOTE_UNIT = 100
REQUIRED_RECORD_FIELDS = {
    "currencyCHName",
    "currencyENName",
    "reference",
    "foreignBuy",
    "foreignSell",
    "cashBuy",
    "cashSell",
    "publishDate",
    "publishTime",
}


@dataclass(frozen=True)
class IcbcRate:
    currency_name: str
    currency_code: str
    reference_rate: float | None
    spot_buy: float | None
    spot_sell: float | None
    cash_buy: float | None
    cash_sell: float | None
    published_at: str


def parse_icbc_rates(payload: str | dict[str, Any]) -> list[IcbcRate]:
    """Parse an ICBC exchange-rate response without performing network requests."""
    if isinstance(payload, str):
        try:
            parsed_payload = json.loads(payload)
        except json.JSONDecodeError as error:
            raise ValueError("ICBC response is not valid JSON.") from error
    else:
        parsed_payload = payload

    if not isinstance(parsed_payload, dict):
        raise ValueError("ICBC response must be a JSON object.")

    code = parsed_payload.get("code")
    if code != 0:
        raise ValueError(f"ICBC response code must be 0, received {code!r}.")

    data = parsed_payload.get("data")
    if not isinstance(data, list):
        raise ValueError("ICBC response data must be a list.")

    return [_parse_record(record, index) for index, record in enumerate(data)]


def _parse_record(record: Any, index: int) -> IcbcRate:
    if not isinstance(record, dict):
        raise ValueError(f"ICBC record at index {index} must be an object.")

    missing_fields = REQUIRED_RECORD_FIELDS - record.keys()
    if missing_fields:
        fields = ", ".join(sorted(missing_fields))
        raise ValueError(f"ICBC record at index {index} is missing fields: {fields}.")

    currency_name = _required_text(record["currencyCHName"], "currencyCHName", index)
    currency_code = _required_text(record["currencyENName"], "currencyENName", index)
    published_date = _required_text(record["publishDate"], "publishDate", index)
    published_time = _required_text(record["publishTime"], "publishTime", index)
    published_at = _parse_published_at(published_date, published_time, index)

    return IcbcRate(
        currency_name=currency_name,
        currency_code=currency_code,
        reference_rate=_parse_rate(record["reference"], "reference", index),
        spot_buy=_parse_rate(record["foreignBuy"], "foreignBuy", index),
        spot_sell=_parse_rate(record["foreignSell"], "foreignSell", index),
        cash_buy=_parse_rate(record["cashBuy"], "cashBuy", index),
        cash_sell=_parse_rate(record["cashSell"], "cashSell", index),
        published_at=published_at,
    )


def _required_text(value: Any, field: str, index: int) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"ICBC record at index {index} has invalid {field}.")
    return value.strip()


def _parse_rate(value: Any, field: str, index: int) -> float | None:
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    if isinstance(value, bool):
        raise ValueError(f"ICBC record at index {index} has invalid {field}: {value!r}.")

    normalized_value = value.replace(",", "") if isinstance(value, str) else value
    try:
        rate = float(normalized_value)
    except (TypeError, ValueError) as error:
        raise ValueError(
            f"ICBC record at index {index} has invalid {field}: {value!r}."
        ) from error

    if not math.isfinite(rate):
        raise ValueError(f"ICBC record at index {index} has invalid {field}: {value!r}.")
    return rate / ICBC_QUOTE_UNIT


def _parse_published_at(published_date: str, published_time: str, index: int) -> str:
    value = f"{published_date} {published_time}"
    try:
        published_at = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
    except ValueError as error:
        raise ValueError(
            f"ICBC record at index {index} has invalid publication time: {value!r}."
        ) from error
    return published_at.strftime("%Y-%m-%d %H:%M:%S")
