import socket
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import pytest

from app.exchange_rate.banks.abc import parse_abc_rates
from app.exchange_rate.banks.boc import BocRate, parse_boc_rates
from app.exchange_rate.banks.ccb import parse_ccb_rates
from app.exchange_rate.banks.cmb import CmbRate, parse_cmb_rates
from app.exchange_rate.banks.icbc import parse_icbc_rates
from app.exchange_rate.mappers import (
    map_abc_rate,
    map_boc_rate,
    map_ccb_rate,
    map_cmb_rate,
    map_icbc_rate,
)
from app.exchange_rate.models import BankExchangeRate, RateStatus


FIXTURE_DIRECTORY = Path(__file__).parent / "fixtures"
EXPLICIT_SOURCE_TIMEZONE = timezone(timedelta(hours=8))


@pytest.fixture(scope="module")
def bank_specific_rates():
    return {
        "BOC": next(
            rate
            for rate in parse_boc_rates(
                (FIXTURE_DIRECTORY / "boc_rates.html").read_text(encoding="utf-8")
            )
            if rate.currency_code == "AUD"
        ),
        "ICBC": next(
            rate
            for rate in parse_icbc_rates(
                (FIXTURE_DIRECTORY / "icbc_rates.json").read_text(encoding="utf-8")
            )
            if rate.currency_code == "AUD"
        ),
        "CCB": next(
            rate
            for rate in parse_ccb_rates(
                (FIXTURE_DIRECTORY / "ccb_rates.xml").read_bytes()
            )
            if rate.currency_code == "AUD"
        ),
        "ABC": next(
            rate
            for rate in parse_abc_rates(
                (FIXTURE_DIRECTORY / "abc_rates.json").read_text(encoding="utf-8")
            )
            if rate.currency_code == "AUD"
        ),
        "CMB": next(
            rate
            for rate in parse_cmb_rates(
                (FIXTURE_DIRECTORY / "cmb_rates.json").read_text(encoding="utf-8")
            )
            if rate.currency_code == "AUD"
        ),
    }


@pytest.fixture(scope="module")
def mapped_rates(bank_specific_rates):
    return {
        "BOC": map_boc_rate(
            bank_specific_rates["BOC"],
            source_timezone=EXPLICIT_SOURCE_TIMEZONE,
        ),
        "ICBC": map_icbc_rate(
            bank_specific_rates["ICBC"],
            source_timezone=EXPLICIT_SOURCE_TIMEZONE,
        ),
        "CCB": map_ccb_rate(
            bank_specific_rates["CCB"],
            source_timezone=EXPLICIT_SOURCE_TIMEZONE,
        ),
        "ABC": map_abc_rate(bank_specific_rates["ABC"]),
        "CMB": map_cmb_rate(
            bank_specific_rates["CMB"],
            source_timezone=EXPLICIT_SOURCE_TIMEZONE,
        ),
    }


@pytest.mark.parametrize(
    ("bank_code", "bank_name"),
    [
        ("BOC", "中国银行"),
        ("ICBC", "中国工商银行"),
        ("CCB", "中国建设银行"),
        ("ABC", "中国农业银行"),
        ("CMB", "招商银行"),
    ],
)
def test_maps_all_five_banks_with_identity_and_currency(
    mapped_rates, bank_specific_rates, bank_code: str, bank_name: str
) -> None:
    mapped = mapped_rates[bank_code]
    source = bank_specific_rates[bank_code]

    assert isinstance(mapped, BankExchangeRate)
    assert mapped.bank_code == bank_code
    assert mapped.bank_name == bank_name
    assert mapped.currency_code == source.currency_code == "AUD"
    assert mapped.currency_name == source.currency_name
    assert mapped.status is RateStatus.AVAILABLE


@pytest.mark.parametrize("bank_code", ["BOC", "ICBC", "CCB", "CMB"])
def test_maps_all_native_price_fields_independently(
    mapped_rates, bank_specific_rates, bank_code: str
) -> None:
    mapped = mapped_rates[bank_code]
    source = bank_specific_rates[bank_code]

    assert mapped.spot_buy == _decimal(source.spot_buy)
    assert mapped.spot_sell == _decimal(source.spot_sell)
    assert mapped.cash_buy == _decimal(source.cash_buy)
    assert mapped.cash_sell == _decimal(source.cash_sell)
    assert mapped.derived_fields == frozenset()


def test_abc_derives_cash_sell_from_spot_sell(mapped_rates, bank_specific_rates) -> None:
    mapped = mapped_rates["ABC"]
    source = bank_specific_rates["ABC"]

    assert mapped.spot_buy == _decimal(source.spot_buy)
    assert mapped.spot_sell == _decimal(source.spot_sell)
    assert mapped.cash_buy == _decimal(source.cash_buy)
    assert mapped.cash_sell == _decimal(source.spot_sell)
    assert mapped.derived_fields == frozenset({"cash_sell"})


def test_float_conversion_does_not_expand_binary_representation() -> None:
    source = BocRate(
        currency_name="测试币",
        currency_code="TST",
        spot_buy=1.1,
        cash_buy=2.2,
        spot_sell=3.3,
        cash_sell=4.4,
        boc_conversion_rate=5.5,
        published_at="2026/08/24 12:00:00",
    )

    mapped = map_boc_rate(source, source_timezone=EXPLICIT_SOURCE_TIMEZONE)

    assert mapped.spot_buy == Decimal("1.1")
    assert mapped.cash_buy == Decimal("2.2")
    assert mapped.spot_sell == Decimal("3.3")
    assert mapped.cash_sell == Decimal("4.4")


def test_legitimate_none_prices_remain_missing() -> None:
    source = CmbRate(
        currency_name="测试币",
        currency_code=None,
        spot_buy=None,
        spot_sell=None,
        cash_buy=None,
        cash_sell=None,
        published_at="2026-08-24 12:00:00",
    )

    mapped = map_cmb_rate(source, source_timezone=EXPLICIT_SOURCE_TIMEZONE)

    assert mapped.currency_code is None
    assert mapped.spot_buy is None
    assert mapped.spot_sell is None
    assert mapped.cash_buy is None
    assert mapped.cash_sell is None


def test_published_at_preserves_embedded_or_explicit_timezone(mapped_rates) -> None:
    for bank_code, mapped in mapped_rates.items():
        assert isinstance(mapped.published_at, datetime)
        assert mapped.published_at.utcoffset() == timedelta(hours=8), bank_code

    assert mapped_rates["BOC"].published_at.isoformat() == (
        "2026-08-05T17:04:28+08:00"
    )
    assert mapped_rates["ICBC"].published_at.isoformat() == (
        "2026-08-22T04:00:48+08:00"
    )
    assert mapped_rates["CCB"].published_at.isoformat() == (
        "2026-08-24T00:05:03+08:00"
    )
    assert mapped_rates["ABC"].published_at.isoformat() == (
        "2026-08-24T01:11:27+08:00"
    )
    assert mapped_rates["CMB"].published_at.isoformat() == (
        "2026-08-24T11:19:18+08:00"
    )


def test_model_rejects_naive_published_at(mapped_rates) -> None:
    values = mapped_rates["CMB"].__dict__ | {"published_at": datetime(2026, 8, 24)}

    with pytest.raises(ValueError, match="must be timezone-aware"):
        BankExchangeRate(**values)


def test_status_type_and_explicit_mapper_status(bank_specific_rates) -> None:
    assert {status.value for status in RateStatus} == {
        "available",
        "stale",
        "unavailable",
        "unsupported",
    }

    mapped = map_cmb_rate(
        bank_specific_rates["CMB"],
        source_timezone=EXPLICIT_SOURCE_TIMEZONE,
        status=RateStatus.STALE,
    )

    assert mapped.status is RateStatus.STALE


def test_bank_specific_reference_fields_do_not_enter_common_model(mapped_rates) -> None:
    excluded_fields = {
        "abc_benchmark_rate",
        "boc_conversion_rate",
        "currency_id",
        "currency_numeric_code",
        "reference_rate",
    }

    for mapped in mapped_rates.values():
        assert excluded_fields.isdisjoint(mapped.__dict__)


def test_mappers_do_not_open_network_connections(
    monkeypatch, bank_specific_rates
) -> None:
    def fail_if_called(*args, **kwargs):
        raise AssertionError("mapper attempted a network connection")

    monkeypatch.setattr(socket, "socket", fail_if_called)

    map_boc_rate(
        bank_specific_rates["BOC"], source_timezone=EXPLICIT_SOURCE_TIMEZONE
    )
    map_icbc_rate(
        bank_specific_rates["ICBC"], source_timezone=EXPLICIT_SOURCE_TIMEZONE
    )
    map_ccb_rate(
        bank_specific_rates["CCB"], source_timezone=EXPLICIT_SOURCE_TIMEZONE
    )
    map_abc_rate(bank_specific_rates["ABC"])
    map_cmb_rate(
        bank_specific_rates["CMB"], source_timezone=EXPLICIT_SOURCE_TIMEZONE
    )


def _decimal(value: float | None) -> Decimal | None:
    return Decimal(str(value)) if value is not None else None
