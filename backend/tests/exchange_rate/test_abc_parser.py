import json
from pathlib import Path

import pytest

from backend.app.exchange_rate.banks.abc import parse_abc_rates


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "abc_rates.json"


@pytest.fixture(scope="module")
def fixture_text() -> str:
    return FIXTURE_PATH.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def abc_rates(fixture_text: str):
    return parse_abc_rates(fixture_text)


def test_parses_australian_dollar_and_normalizes_per_100_quote(abc_rates) -> None:
    aud = next(rate for rate in abc_rates if rate.currency_code == "AUD")

    assert aud.currency_name == "澳大利亚元(AUD)"
    assert aud.currency_id == "29"
    assert aud.abc_benchmark_rate == pytest.approx(4.82410)
    assert aud.spot_buy == pytest.approx(4.80722)
    assert aud.spot_sell == pytest.approx(4.84098)
    assert aud.cash_buy == pytest.approx(4.80722)
    assert aud.published_at == "2026-08-24 01:11:27+08:00"


def test_parses_multiple_common_currencies(abc_rates) -> None:
    parsed_codes = {rate.currency_code for rate in abc_rates}

    assert {"USD", "EUR", "GBP", "JPY", "KRW", "MOP"}.issubset(parsed_codes)


def test_fixture_record_count_matches_data_table(fixture_text: str, abc_rates) -> None:
    payload = json.loads(fixture_text)

    assert len(abc_rates) == len(payload["Data"]["Table"]) == 24


@pytest.mark.parametrize(
    "payload",
    [
        "not valid JSON",
        "[]",
        '{"ErrorCode": "0"}',
        '{"ErrorCode": "0", "Data": {}}',
        '{"ErrorCode": "0", "Data": {"Table": []}}',
    ],
)
def test_rejects_malformed_json_or_invalid_structure(payload: str) -> None:
    with pytest.raises(ValueError):
        parse_abc_rates(payload)


def test_rejects_nonzero_error_code() -> None:
    with pytest.raises(ValueError, match="ErrorCode must be '0'"):
        parse_abc_rates({"ErrorCode": "1", "Data": {"Table": []}})


def test_empty_quotes_become_none() -> None:
    payload = _payload(
        {
            "BenchMarkPrice": "",
            "BuyingPrice": None,
            "CashBuyingPrice": "",
            "CurrId": "999",
            "CurrName": "测试币(XYZ)",
            "PublishTime": "2026-08-24T01:11:27+08:00",
            "SellPrice": "100",
        }
    )

    rate = parse_abc_rates(payload)[0]

    assert rate.abc_benchmark_rate is None
    assert rate.spot_buy is None
    assert rate.spot_sell == 1.0
    assert rate.cash_buy is None


def test_unknown_currency_is_preserved_without_a_guessed_code() -> None:
    record = _valid_record()
    record["CurrName"] = "测试币"
    record["CurrId"] = "999"

    rate = parse_abc_rates(_payload(record))[0]

    assert rate.currency_name == "测试币"
    assert rate.currency_code is None
    assert rate.currency_id == "999"


@pytest.mark.parametrize("invalid_quote", ["not-a-price", -1, float("inf"), True])
def test_rejects_invalid_quotes(invalid_quote) -> None:
    record = _valid_record()
    record["BuyingPrice"] = invalid_quote

    with pytest.raises(ValueError, match="invalid BuyingPrice"):
        parse_abc_rates(_payload(record))


@pytest.mark.parametrize(
    "publish_time",
    ["not-a-time", "2026-08-24T01:11:27"],
)
def test_rejects_invalid_or_timezone_less_publish_time(publish_time: str) -> None:
    record = _valid_record()
    record["PublishTime"] = publish_time

    with pytest.raises(ValueError, match="invalid PublishTime"):
        parse_abc_rates(_payload(record))


def test_rejects_record_with_missing_required_field() -> None:
    record = _valid_record()
    del record["SellPrice"]

    with pytest.raises(ValueError, match="missing fields: SellPrice"):
        parse_abc_rates(_payload(record))


def _payload(record: dict) -> dict:
    return {"ErrorCode": "0", "Data": {"Table": [record]}}


def _valid_record() -> dict:
    return {
        "BenchMarkPrice": "100",
        "BuyingPrice": "99",
        "CashBuyingPrice": "98",
        "CurrId": "999",
        "CurrName": "测试币(XYZ)",
        "PublishTime": "2026-08-24T01:11:27+08:00",
        "SellPrice": "101",
    }
