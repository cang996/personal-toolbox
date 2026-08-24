from datetime import timedelta
from zoneinfo import ZoneInfo


PRODUCT_TARGET_CURRENCIES = (
    "USD",
    "CAD",
    "EUR",
    "GBP",
    "CHF",
    "AUD",
    "NZD",
    "JPY",
    "KRW",
    "HKD",
    "MOP",
    "TWD",
    "SGD",
    "MYR",
)

CHINA_SOURCE_TIMEZONE = ZoneInfo("Asia/Shanghai")
BANK_QUOTE_STALE_AFTER = timedelta(days=7)
