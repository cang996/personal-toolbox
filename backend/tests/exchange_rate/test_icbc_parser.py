import json
from pathlib import Path

import pytest

from backend.app.exchange_rate.banks.icbc import parse_icbc_rates


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "icbc_rates.json"


@pytest.fixture(scope="module")
def fixture_text() -> str:
    return FIXTURE_PATH.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def icbc_rates(fixture_text: str):
    return parse_icbc_rates(fixture_text)


def test_parses_australian_dollar_and_normalizes_per_100_quote(icbc_rates) -> None:
    aud = next(rate for rate in icbc_rates if rate.currency_code == "AUD")

    assert aud.currency_name == "澳大利亚元"
    assert aud.currency_code == "AUD"
    assert aud.spot_buy == pytest.approx(4.7966)
    assert aud.spot_sell == pytest.approx(4.8409)
    assert aud.reference_rate == pytest.approx(4.8207)
    assert aud.published_at == "2026-08-22 04:00:48"


def test_parses_multiple_currencies(icbc_rates) -> None:
    parsed_codes = {rate.currency_code for rate in icbc_rates}

    assert {"USD", "EUR", "GBP", "JPY", "KRW", "MYR"}.issubset(parsed_codes)


def test_record_count_matches_fixture_data(fixture_text: str, icbc_rates) -> None:
    payload = json.loads(fixture_text)

    assert len(icbc_rates) == len(payload["data"])


@pytest.mark.parametrize(
    "payload",
    [
        "not valid JSON",
        "[]",
        '{"code": 0}',
    ],
)
def test_rejects_invalid_json_or_structure(payload: str) -> None:
    with pytest.raises(ValueError):
        parse_icbc_rates(payload)


def test_rejects_nonzero_response_code() -> None:
    with pytest.raises(ValueError, match="code must be 0"):
        parse_icbc_rates({"code": 1, "data": []})


def test_rejects_non_list_data() -> None:
    with pytest.raises(ValueError, match="data must be a list"):
        parse_icbc_rates({"code": 0, "data": {}})


def test_converts_empty_and_null_rates_to_none() -> None:
    payload = {
        "code": 0,
        "data": [
            {
                "currencyCHName": "测试币种",
                "currencyENName": "TST",
                "reference": "",
                "foreignBuy": None,
                "foreignSell": "100",
                "cashBuy": "",
                "cashSell": None,
                "publishDate": "2026-08-22",
                "publishTime": "04:00:48",
            }
        ],
    }

    rate = parse_icbc_rates(payload)[0]

    assert rate.reference_rate is None
    assert rate.spot_buy is None
    assert rate.spot_sell == 1.0
    assert rate.cash_buy is None
    assert rate.cash_sell is None


def test_rejects_record_with_missing_required_field() -> None:
    with pytest.raises(ValueError, match="missing fields"):
        parse_icbc_rates({"code": 0, "data": [{"currencyENName": "AUD"}]})
