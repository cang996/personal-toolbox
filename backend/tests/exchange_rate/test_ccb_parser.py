import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

from app.exchange_rate.banks.ccb import parse_ccb_rates


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "ccb_rates.xml"


@pytest.fixture(scope="module")
def fixture_bytes() -> bytes:
    return FIXTURE_PATH.read_bytes()


@pytest.fixture(scope="module")
def ccb_rates(fixture_bytes: bytes):
    return parse_ccb_rates(fixture_bytes)


def test_fixture_record_count_matches_parsed_rates(fixture_bytes: bytes, ccb_rates) -> None:
    root = ET.fromstring(fixture_bytes)
    fixture_count = len(root.findall(".//ReferencePriceSettlement"))

    assert len(ccb_rates) == fixture_count


def test_parses_australian_dollar_without_unit_conversion(ccb_rates) -> None:
    aud = next(rate for rate in ccb_rates if rate.currency_numeric_code == "036")

    assert aud.currency_code == "AUD"
    assert aud.currency_name == "澳大利亚元"
    assert aud.spot_buy == pytest.approx(4.8211)
    assert aud.spot_sell == pytest.approx(4.8549)
    assert aud.cash_buy == pytest.approx(4.8211)
    assert aud.cash_sell == pytest.approx(4.8549)
    assert aud.spot_buy > 4
    assert aud.published_at == "2026-08-24 00:05:03"


def test_parses_multiple_mapped_currencies(ccb_rates) -> None:
    parsed_codes = {rate.currency_code for rate in ccb_rates}

    assert {"USD", "EUR", "GBP", "JPY", "CAD"}.issubset(parsed_codes)


def test_uses_non_cny_side_for_inverse_currency_pair(ccb_rates) -> None:
    myr = next(rate for rate in ccb_rates if rate.currency_code == "MYR")

    assert myr.currency_numeric_code == "458"
    assert myr.currency_name == "马来西亚林吉特"
    assert myr.spot_buy == pytest.approx(1 / 0.60308)
    assert myr.spot_sell == pytest.approx(1 / 0.59768)
    assert myr.cash_buy == pytest.approx(1 / 0.60308)
    assert myr.cash_sell == pytest.approx(1 / 0.59768)


def test_normalizes_another_real_inverse_currency_pair(ccb_rates) -> None:
    thb = next(rate for rate in ccb_rates if rate.currency_numeric_code == "764")

    assert thb.spot_buy == pytest.approx(1 / 4.8715)
    assert thb.spot_sell == pytest.approx(1 / 4.84)
    assert thb.cash_buy == pytest.approx(1 / 4.8715)
    assert thb.cash_sell == pytest.approx(1 / 4.84)


def test_rejects_malformed_xml() -> None:
    with pytest.raises(ValueError, match="not valid XML"):
        parse_ccb_rates("<broken>")


def test_rejects_incorrect_root() -> None:
    with pytest.raises(ValueError, match="root must be"):
        parse_ccb_rates("<NotRates />")


def test_rejects_xml_without_rate_records() -> None:
    with pytest.raises(ValueError, match="does not contain any"):
        parse_ccb_rates("<ReferencePriceSettlements />")


def test_empty_or_missing_prices_become_none() -> None:
    xml = """
    <ReferencePriceSettlements>
      <ReferencePriceSettlement>
        <Ofrd_Ccy_CcyCd>999</Ofrd_Ccy_CcyCd>
        <Ofr_Ccy_CcyCd>156</Ofr_Ccy_CcyCd>
        <BidRateOfCcy></BidRateOfCcy>
        <OfrRateOfCash></OfrRateOfCash>
        <LstPr_Dt>20260824</LstPr_Dt>
        <LstPr_Tm>000503</LstPr_Tm>
      </ReferencePriceSettlement>
    </ReferencePriceSettlements>
    """

    rate = parse_ccb_rates(xml)[0]

    assert rate.spot_buy is None
    assert rate.spot_sell is None
    assert rate.cash_buy is None
    assert rate.cash_sell is None


def test_unknown_numeric_code_is_preserved() -> None:
    xml = """
    <ReferencePriceSettlements>
      <ReferencePriceSettlement>
        <Ofrd_Ccy_CcyCd>999</Ofrd_Ccy_CcyCd>
        <Ofr_Ccy_CcyCd>156</Ofr_Ccy_CcyCd>
        <LstPr_Dt>20260824</LstPr_Dt>
        <LstPr_Tm>000503</LstPr_Tm>
      </ReferencePriceSettlement>
    </ReferencePriceSettlements>
    """

    rate = parse_ccb_rates(xml)[0]

    assert rate.currency_numeric_code == "999"
    assert rate.currency_code is None
    assert rate.currency_name is None


@pytest.mark.parametrize(
    ("offered_code", "counter_code"),
    [("156", "156"), ("036", "840")],
)
def test_rejects_currency_pairs_without_exactly_one_cny_side(
    offered_code: str, counter_code: str
) -> None:
    xml = f"""
    <ReferencePriceSettlements>
      <ReferencePriceSettlement>
        <Ofrd_Ccy_CcyCd>{offered_code}</Ofrd_Ccy_CcyCd>
        <Ofr_Ccy_CcyCd>{counter_code}</Ofr_Ccy_CcyCd>
        <LstPr_Dt>20260824</LstPr_Dt>
        <LstPr_Tm>000503</LstPr_Tm>
      </ReferencePriceSettlement>
    </ReferencePriceSettlements>
    """

    with pytest.raises(ValueError, match="exactly one CNY"):
        parse_ccb_rates(xml)


def test_rejects_zero_price_for_inverse_currency_pair() -> None:
    xml = """
    <ReferencePriceSettlements>
      <ReferencePriceSettlement>
        <Ofrd_Ccy_CcyCd>156</Ofrd_Ccy_CcyCd>
        <Ofr_Ccy_CcyCd>458</Ofr_Ccy_CcyCd>
        <BidRateOfCcy>0</BidRateOfCcy>
        <OfrRateOfCcy>0.60308</OfrRateOfCcy>
        <LstPr_Dt>20260824</LstPr_Dt>
        <LstPr_Tm>000503</LstPr_Tm>
      </ReferencePriceSettlement>
    </ReferencePriceSettlements>
    """

    with pytest.raises(ValueError, match="cannot invert non-positive BidRateOfCcy"):
        parse_ccb_rates(xml)


def test_empty_inverse_prices_remain_none() -> None:
    xml = """
    <ReferencePriceSettlements>
      <ReferencePriceSettlement>
        <Ofrd_Ccy_CcyCd>156</Ofrd_Ccy_CcyCd>
        <Ofr_Ccy_CcyCd>458</Ofr_Ccy_CcyCd>
        <BidRateOfCcy></BidRateOfCcy>
        <OfrRateOfCash></OfrRateOfCash>
        <LstPr_Dt>20260824</LstPr_Dt>
        <LstPr_Tm>000503</LstPr_Tm>
      </ReferencePriceSettlement>
    </ReferencePriceSettlements>
    """

    rate = parse_ccb_rates(xml)[0]

    assert rate.spot_buy is None
    assert rate.spot_sell is None
    assert rate.cash_buy is None
    assert rate.cash_sell is None
