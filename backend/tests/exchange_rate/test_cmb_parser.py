import json
from pathlib import Path

import pytest

from backend.app.exchange_rate.banks.cmb import parse_cmb_rates


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "cmb_rates.json"


@pytest.fixture(scope="module")
def fixture_text() -> str:
    return FIXTURE_PATH.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def cmb_rates(fixture_text: str):
    return parse_cmb_rates(fixture_text)


def test_parses_australian_dollar_and_normalizes_per_100_quote(cmb_rates) -> None:
    aud = next(rate for rate in cmb_rates if rate.currency_code == "AUD")

    assert aud.currency_name == "澳大利亚元"
    assert aud.spot_buy == pytest.approx(4.7984)
    assert aud.spot_sell == pytest.approx(4.8370)
    assert aud.cash_buy == pytest.approx(4.7984)
    assert aud.cash_sell == pytest.approx(4.8370)
    assert aud.published_at == "2026-08-24 11:19:18"


def test_parses_us_dollar_and_euro(cmb_rates) -> None:
    by_code = {rate.currency_code: rate for rate in cmb_rates}

    assert by_code["USD"].spot_buy == pytest.approx(6.7115)
    assert by_code["USD"].spot_sell == pytest.approx(6.7407)
    assert by_code["EUR"].spot_buy == pytest.approx(7.8228)
    assert by_code["EUR"].spot_sell == pytest.approx(7.8856)


def test_fixture_record_count_matches_response_body(fixture_text: str, cmb_rates) -> None:
    payload = json.loads(fixture_text)

    assert len(cmb_rates) == len(payload["body"]) == 10


def test_maps_spot_and_cash_fields_independently() -> None:
    record = _valid_record()
    record.update(
        {"rthBid": "101", "rthOfr": "102", "rtcBid": "91", "rtcOfr": "112"}
    )

    rate = parse_cmb_rates(_payload(record))[0]

    assert rate.spot_buy == 1.01
    assert rate.spot_sell == 1.02
    assert rate.cash_buy == 0.91
    assert rate.cash_sell == 1.12


@pytest.mark.parametrize(
    "payload",
    [
        "not valid JSON",
        "[]",
        '{"returnCode": "SUC0000"}',
        '{"returnCode": "SUC0000", "body": {}}',
        '{"returnCode": "SUC0000", "body": []}',
    ],
)
def test_rejects_malformed_json_or_invalid_structure(payload: str) -> None:
    with pytest.raises(ValueError):
        parse_cmb_rates(payload)


def test_rejects_unsuccessful_return_code() -> None:
    with pytest.raises(ValueError, match="returnCode must be 'SUC0000'"):
        parse_cmb_rates({"returnCode": "ERROR", "body": []})


def test_empty_quotes_become_none() -> None:
    record = _valid_record()
    record.update({"rthBid": "", "rthOfr": None, "rtcBid": "", "rtcOfr": None})

    rate = parse_cmb_rates(_payload(record))[0]

    assert rate.spot_buy is None
    assert rate.spot_sell is None
    assert rate.cash_buy is None
    assert rate.cash_sell is None


def test_unknown_currency_is_preserved_without_a_guessed_code() -> None:
    record = _valid_record()
    record["ccyNbr"] = "测试币"
    record["ccyNbrEng"] = "测试币"

    rate = parse_cmb_rates(_payload(record))[0]

    assert rate.currency_name == "测试币"
    assert rate.currency_code is None


@pytest.mark.parametrize("invalid_quote", ["not-a-price", -1, float("inf"), True])
def test_rejects_invalid_quotes(invalid_quote) -> None:
    record = _valid_record()
    record["rthBid"] = invalid_quote

    with pytest.raises(ValueError, match="invalid rthBid"):
        parse_cmb_rates(_payload(record))


@pytest.mark.parametrize(
    ("date", "time"),
    [("2026-08-24", "11:18:18"), ("2026年08月24日", "not-a-time")],
)
def test_rejects_invalid_publication_time(date: str, time: str) -> None:
    record = _valid_record()
    record["ratDat"] = date
    record["ratTim"] = time

    with pytest.raises(ValueError, match="invalid publication time"):
        parse_cmb_rates(_payload(record))


def test_rejects_record_with_missing_required_field() -> None:
    record = _valid_record()
    del record["rtcOfr"]

    with pytest.raises(ValueError, match="missing fields: rtcOfr"):
        parse_cmb_rates(_payload(record))


def _payload(record: dict) -> dict:
    return {"returnCode": "SUC0000", "body": [record]}


def _valid_record() -> dict:
    return {
        "ccyNbr": "测试币",
        "ccyNbrEng": "测试币 XYZ",
        "ratDat": "2026年08月24日",
        "ratTim": "11:18:18",
        "rtcBid": "98",
        "rtcOfr": "102",
        "rthBid": "99",
        "rthOfr": "101",
    }
