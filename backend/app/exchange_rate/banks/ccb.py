import math
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime


CNY_NUMERIC_CODE = "156"
CURRENCY_METADATA = {
    "840": ("USD", "美元"),
    "124": ("CAD", "加拿大元"),
    "978": ("EUR", "欧元"),
    "826": ("GBP", "英镑"),
    "756": ("CHF", "瑞士法郎"),
    "036": ("AUD", "澳大利亚元"),
    "554": ("NZD", "新西兰元"),
    "392": ("JPY", "日元"),
    "410": ("KRW", "韩元"),
    "344": ("HKD", "港币"),
    "446": ("MOP", "澳门元"),
    "901": ("TWD", "新台币"),
    "702": ("SGD", "新加坡元"),
    "458": ("MYR", "马来西亚林吉特"),
}


@dataclass(frozen=True)
class CcbRate:
    currency_name: str | None
    currency_code: str | None
    currency_numeric_code: str
    spot_buy: float | None
    spot_sell: float | None
    cash_buy: float | None
    cash_sell: float | None
    published_at: str


def parse_ccb_rates(xml: str | bytes) -> list[CcbRate]:
    """Parse CCB exchange-rate XML into CNY per foreign-currency unit."""
    try:
        root = ET.fromstring(xml)
    except (ET.ParseError, TypeError) as error:
        raise ValueError("CCB response is not valid XML.") from error

    if _local_name(root.tag) != "ReferencePriceSettlements":
        raise ValueError(
            "CCB XML root must be ReferencePriceSettlements, "
            f"received {_local_name(root.tag)!r}."
        )

    records = [
        element
        for element in root.iter()
        if _local_name(element.tag) == "ReferencePriceSettlement"
    ]
    if not records:
        raise ValueError("CCB XML does not contain any ReferencePriceSettlement records.")

    return [_parse_record(record, index) for index, record in enumerate(records)]


def _parse_record(record: ET.Element, index: int) -> CcbRate:
    offered_code = _required_text(record, "Ofrd_Ccy_CcyCd", index)
    counter_code = _required_text(record, "Ofr_Ccy_CcyCd", index)
    currency_numeric_code, is_inverse = _currency_pair(
        offered_code, counter_code, index
    )
    currency_metadata = CURRENCY_METADATA.get(currency_numeric_code)
    currency_code = currency_metadata[0] if currency_metadata else None
    currency_name = currency_metadata[1] if currency_metadata else None

    published_date = _required_text(record, "LstPr_Dt", index)
    published_time = _required_text(record, "LstPr_Tm", index)
    raw_spot_buy = _optional_price(record, "BidRateOfCcy", index)
    raw_spot_sell = _optional_price(record, "OfrRateOfCcy", index)
    raw_cash_buy = _optional_price(record, "BidRateOfCash", index)
    raw_cash_sell = _optional_price(record, "OfrRateOfCash", index)

    if is_inverse:
        spot_buy = _reciprocal_price(raw_spot_sell, "OfrRateOfCcy", index)
        spot_sell = _reciprocal_price(raw_spot_buy, "BidRateOfCcy", index)
        cash_buy = _reciprocal_price(raw_cash_sell, "OfrRateOfCash", index)
        cash_sell = _reciprocal_price(raw_cash_buy, "BidRateOfCash", index)
    else:
        spot_buy = raw_spot_buy
        spot_sell = raw_spot_sell
        cash_buy = raw_cash_buy
        cash_sell = raw_cash_sell

    return CcbRate(
        currency_name=currency_name,
        currency_code=currency_code,
        currency_numeric_code=currency_numeric_code,
        spot_buy=spot_buy,
        spot_sell=spot_sell,
        cash_buy=cash_buy,
        cash_sell=cash_sell,
        published_at=_published_at(published_date, published_time, index),
    )


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _child_text(record: ET.Element, field: str) -> str | None:
    for child in record:
        if _local_name(child.tag) == field:
            return child.text.strip() if child.text else ""
    return None


def _required_text(record: ET.Element, field: str, index: int) -> str:
    value = _child_text(record, field)
    if value is None or not value:
        raise ValueError(f"CCB record at index {index} has an empty or missing {field}.")
    return value


def _currency_pair(
    offered_code: str, counter_code: str, index: int
) -> tuple[str, bool]:
    if offered_code == CNY_NUMERIC_CODE and counter_code != CNY_NUMERIC_CODE:
        return counter_code, True
    if counter_code == CNY_NUMERIC_CODE and offered_code != CNY_NUMERIC_CODE:
        return offered_code, False
    raise ValueError(
        f"CCB record at index {index} must contain exactly one CNY currency code 156."
    )


def _optional_price(record: ET.Element, field: str, index: int) -> float | None:
    value = _child_text(record, field)
    if value is None or not value:
        return None

    try:
        price = float(value)
    except ValueError as error:
        raise ValueError(
            f"CCB record at index {index} has invalid {field}: {value!r}."
        ) from error
    if not math.isfinite(price):
        raise ValueError(f"CCB record at index {index} has invalid {field}: {value!r}.")
    return price


def _reciprocal_price(price: float | None, field: str, index: int) -> float | None:
    if price is None:
        return None
    if price <= 0:
        raise ValueError(
            f"CCB record at index {index} cannot invert non-positive {field}: {price!r}."
        )
    return 1 / price


def _published_at(published_date: str, published_time: str, index: int) -> str:
    value = f"{published_date}{published_time}"
    try:
        parsed = datetime.strptime(value, "%Y%m%d%H%M%S")
    except ValueError as error:
        raise ValueError(
            f"CCB record at index {index} has invalid publication time: {value!r}."
        ) from error
    return parsed.strftime("%Y-%m-%d %H:%M:%S")
