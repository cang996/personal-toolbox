from dataclasses import dataclass

from bs4 import BeautifulSoup


BOC_QUOTE_UNIT = 100

CURRENCY_CODES = {
    "澳大利亚元": "AUD",
    "美元": "USD",
    "欧元": "EUR",
    "英镑": "GBP",
    "日元": "JPY",
    "港币": "HKD",
    "加拿大元": "CAD",
    "新加坡元": "SGD",
    "瑞士法郎": "CHF",
    "新西兰元": "NZD",
}

REQUIRED_HEADERS = {
    "货币名称",
    "现汇买入价",
    "现钞买入价",
    "现汇卖出价",
    "现钞卖出价",
    "中行折算价",
    "发布日期",
    "发布时间",
}


@dataclass(frozen=True)
class BocRate:
    currency_name: str
    currency_code: str | None
    spot_buy: float | None
    cash_buy: float | None
    spot_sell: float | None
    cash_sell: float | None
    boc_conversion_rate: float | None
    published_at: str


def parse_boc_rates(html: str) -> list[BocRate]:
    """Parse a China Bank of China exchange-rate HTML response without networking."""
    if not html or not html.strip():
        raise ValueError("BOC response HTML is empty.")

    soup = BeautifulSoup(html, "html.parser")
    table = soup.select_one("#priceTable")
    if table is None:
        raise ValueError("BOC response does not contain the expected #priceTable table.")

    header_row = table.find("tr")
    if header_row is None:
        raise ValueError("BOC rate table does not contain a header row.")

    headers = [cell.get_text(" ", strip=True) for cell in header_row.find_all("th")]
    header_indexes = {header: index for index, header in enumerate(headers)}
    missing_headers = REQUIRED_HEADERS - header_indexes.keys()
    if missing_headers:
        formatted_headers = ", ".join(sorted(missing_headers))
        raise ValueError(f"BOC rate table is missing required headers: {formatted_headers}.")

    rates: list[BocRate] = []
    required_last_index = max(header_indexes[header] for header in REQUIRED_HEADERS)
    for row in table.find_all("tr"):
        cells = row.find_all("td", recursive=False)
        if not cells:
            continue
        if len(cells) <= required_last_index:
            raise ValueError("BOC rate row does not contain all required columns.")

        values = [cell.get_text(" ", strip=True) for cell in cells]
        currency_name = values[header_indexes["货币名称"]]
        published_date = values[header_indexes["发布日期"]].split(maxsplit=1)[0]
        published_time = values[header_indexes["发布时间"]]
        published_at = f"{published_date} {published_time}".strip()
        if not currency_name or not published_date or not published_time:
            raise ValueError("BOC rate row has an empty currency name or publication time.")

        rates.append(
            BocRate(
                currency_name=currency_name,
                currency_code=CURRENCY_CODES.get(currency_name),
                spot_buy=_parse_quote(values[header_indexes["现汇买入价"]]),
                cash_buy=_parse_quote(values[header_indexes["现钞买入价"]]),
                spot_sell=_parse_quote(values[header_indexes["现汇卖出价"]]),
                cash_sell=_parse_quote(values[header_indexes["现钞卖出价"]]),
                boc_conversion_rate=_parse_quote(values[header_indexes["中行折算价"]]),
                published_at=published_at,
            )
        )

    if not rates:
        raise ValueError("BOC rate table does not contain any rate rows.")

    return rates


def _parse_quote(value: str) -> float | None:
    if not value:
        return None

    try:
        return float(value.replace(",", "")) / BOC_QUOTE_UNIT
    except ValueError as error:
        raise ValueError(f"Invalid BOC quote value: {value!r}.") from error
