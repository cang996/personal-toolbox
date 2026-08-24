import json
import math
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any


CMB_QUOTE_UNIT = 100
CURRENCY_CODE_PATTERN = re.compile(r"(?:^|\s)([A-Z]{3})\s*$")
REQUIRED_RECORD_FIELDS = {
    "ccyNbr",
    "ccyNbrEng",
    "ratDat",
    "ratTim",
    "rtcBid",
    "rtcOfr",
    "rthBid",
    "rthOfr",
}


@dataclass(frozen=True)
class CmbRate:
    currency_name: str
    currency_code: str | None
    spot_buy: float | None
    spot_sell: float | None
    cash_buy: float | None
    cash_sell: float | None
    published_at: str


def parse_cmb_rates(payload: str | dict[str, Any]) -> list[CmbRate]:
    """Parse a CMB /api/v1/fx/rate response into CNY per currency unit."""
    if isinstance(payload, str):
        try:
            parsed_payload = json.loads(payload)
        except json.JSONDecodeError as error:
            raise ValueError("CMB response is not valid JSON.") from error
    else:
        parsed_payload = payload

    if not isinstance(parsed_payload, dict):
        raise ValueError("CMB response must be a JSON object.")

    return_code = parsed_payload.get("returnCode")
    if return_code != "SUC0000":
        raise ValueError(
            "CMB response returnCode must be 'SUC0000', "
            f"received {return_code!r}."
        )

    records = parsed_payload.get("body")
    if not isinstance(records, list):
        raise ValueError("CMB response body must be a list.")
    if not records:
        raise ValueError("CMB response body does not contain any rate records.")

    return [_parse_record(record, index) for index, record in enumerate(records)]


def _parse_record(record: Any, index: int) -> CmbRate:
    if not isinstance(record, dict):
        raise ValueError(f"CMB record at index {index} must be an object.")

    missing_fields = REQUIRED_RECORD_FIELDS - record.keys()
    if missing_fields:
        fields = ", ".join(sorted(missing_fields))
        raise ValueError(f"CMB record at index {index} is missing fields: {fields}.")

    currency_name = _required_text(record["ccyNbr"], "ccyNbr", index)
    currency_label = _required_text(record["ccyNbrEng"], "ccyNbrEng", index)
    code_match = CURRENCY_CODE_PATTERN.search(currency_label)

    return CmbRate(
        currency_name=currency_name,
        currency_code=code_match.group(1) if code_match else None,
        spot_buy=_parse_quote(record["rthBid"], "rthBid", index),
        spot_sell=_parse_quote(record["rthOfr"], "rthOfr", index),
        cash_buy=_parse_quote(record["rtcBid"], "rtcBid", index),
        cash_sell=_parse_quote(record["rtcOfr"], "rtcOfr", index),
        published_at=_parse_published_at(
            record["ratDat"], record["ratTim"], index
        ),
    )


def _required_text(value: Any, field: str, index: int) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"CMB record at index {index} has invalid {field}.")
    return value.strip()


def _parse_quote(value: Any, field: str, index: int) -> float | None:
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    if isinstance(value, bool):
        raise ValueError(f"CMB record at index {index} has invalid {field}: {value!r}.")

    normalized_value = value.replace(",", "") if isinstance(value, str) else value
    try:
        quote = float(normalized_value)
    except (TypeError, ValueError) as error:
        raise ValueError(
            f"CMB record at index {index} has invalid {field}: {value!r}."
        ) from error

    if not math.isfinite(quote) or quote < 0:
        raise ValueError(f"CMB record at index {index} has invalid {field}: {value!r}.")
    return quote / CMB_QUOTE_UNIT


def _parse_published_at(date: Any, time: Any, index: int) -> str:
    published_date = _required_text(date, "ratDat", index)
    published_time = _required_text(time, "ratTim", index)
    value = f"{published_date} {published_time}"
    try:
        published_at = datetime.strptime(value, "%Y年%m月%d日 %H:%M:%S")
    except ValueError as error:
        raise ValueError(
            f"CMB record at index {index} has invalid publication time: {value!r}."
        ) from error
    return published_at.strftime("%Y-%m-%d %H:%M:%S")
