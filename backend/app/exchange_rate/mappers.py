from datetime import datetime, tzinfo
from decimal import Decimal

from .banks.abc import AbcRate
from .banks.boc import BocRate
from .banks.ccb import CcbRate
from .banks.cmb import CmbRate
from .banks.icbc import IcbcRate
from .models import BankExchangeRate, RateStatus


def map_boc_rate(
    rate: BocRate,
    *,
    source_timezone: tzinfo,
    status: RateStatus = RateStatus.AVAILABLE,
) -> BankExchangeRate:
    return _map_rate(
        bank_code="BOC",
        bank_name="中国银行",
        currency_code=rate.currency_code,
        currency_name=rate.currency_name,
        spot_buy=rate.spot_buy,
        spot_sell=rate.spot_sell,
        cash_buy=rate.cash_buy,
        cash_sell=rate.cash_sell,
        published_at=_parse_naive_timestamp(
            rate.published_at, "%Y/%m/%d %H:%M:%S", source_timezone
        ),
        status=status,
    )


def map_icbc_rate(
    rate: IcbcRate,
    *,
    source_timezone: tzinfo,
    status: RateStatus = RateStatus.AVAILABLE,
) -> BankExchangeRate:
    return _map_rate(
        bank_code="ICBC",
        bank_name="中国工商银行",
        currency_code=rate.currency_code,
        currency_name=rate.currency_name,
        spot_buy=rate.spot_buy,
        spot_sell=rate.spot_sell,
        cash_buy=rate.cash_buy,
        cash_sell=rate.cash_sell,
        published_at=_parse_naive_timestamp(
            rate.published_at, "%Y-%m-%d %H:%M:%S", source_timezone
        ),
        status=status,
    )


def map_ccb_rate(
    rate: CcbRate,
    *,
    source_timezone: tzinfo,
    status: RateStatus = RateStatus.AVAILABLE,
) -> BankExchangeRate:
    return _map_rate(
        bank_code="CCB",
        bank_name="中国建设银行",
        currency_code=rate.currency_code,
        currency_name=rate.currency_name,
        spot_buy=rate.spot_buy,
        spot_sell=rate.spot_sell,
        cash_buy=rate.cash_buy,
        cash_sell=rate.cash_sell,
        published_at=_parse_naive_timestamp(
            rate.published_at, "%Y-%m-%d %H:%M:%S", source_timezone
        ),
        status=status,
    )


def map_abc_rate(
    rate: AbcRate,
    *,
    status: RateStatus = RateStatus.AVAILABLE,
) -> BankExchangeRate:
    spot_sell = _decimal_price(rate.spot_sell)
    return BankExchangeRate(
        bank_code="ABC",
        bank_name="中国农业银行",
        currency_code=rate.currency_code,
        currency_name=rate.currency_name,
        spot_buy=_decimal_price(rate.spot_buy),
        spot_sell=spot_sell,
        cash_buy=_decimal_price(rate.cash_buy),
        cash_sell=spot_sell,
        published_at=_parse_aware_timestamp(rate.published_at),
        status=status,
        derived_fields=frozenset({"cash_sell"}),
    )


def map_cmb_rate(
    rate: CmbRate,
    *,
    source_timezone: tzinfo,
    status: RateStatus = RateStatus.AVAILABLE,
) -> BankExchangeRate:
    return _map_rate(
        bank_code="CMB",
        bank_name="招商银行",
        currency_code=rate.currency_code,
        currency_name=rate.currency_name,
        spot_buy=rate.spot_buy,
        spot_sell=rate.spot_sell,
        cash_buy=rate.cash_buy,
        cash_sell=rate.cash_sell,
        published_at=_parse_naive_timestamp(
            rate.published_at, "%Y-%m-%d %H:%M:%S", source_timezone
        ),
        status=status,
    )


def _map_rate(
    *,
    bank_code: str,
    bank_name: str,
    currency_code: str | None,
    currency_name: str | None,
    spot_buy: float | None,
    spot_sell: float | None,
    cash_buy: float | None,
    cash_sell: float | None,
    published_at: datetime,
    status: RateStatus,
) -> BankExchangeRate:
    return BankExchangeRate(
        bank_code=bank_code,
        bank_name=bank_name,
        currency_code=currency_code,
        currency_name=currency_name,
        spot_buy=_decimal_price(spot_buy),
        spot_sell=_decimal_price(spot_sell),
        cash_buy=_decimal_price(cash_buy),
        cash_sell=_decimal_price(cash_sell),
        published_at=published_at,
        status=status,
    )


def _decimal_price(value: float | None) -> Decimal | None:
    if value is None:
        return None
    return Decimal(str(value))


def _parse_naive_timestamp(
    value: str, timestamp_format: str, source_timezone: tzinfo
) -> datetime:
    parsed = datetime.strptime(value, timestamp_format).replace(tzinfo=source_timezone)
    if parsed.utcoffset() is None:
        raise ValueError("source_timezone must produce a timezone-aware datetime.")
    return parsed


def _parse_aware_timestamp(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError("Bank-specific timestamp must include timezone information.")
    return parsed
