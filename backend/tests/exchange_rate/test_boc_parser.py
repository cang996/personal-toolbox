from pathlib import Path

import pytest

from backend.app.exchange_rate.banks.boc import parse_boc_rates


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "boc_rates.html"


@pytest.fixture(scope="module")
def boc_rates():
    return parse_boc_rates(FIXTURE_PATH.read_text(encoding="utf-8"))


def test_parses_australian_dollar_and_normalizes_per_100_quote(boc_rates) -> None:
    aud = next(rate for rate in boc_rates if rate.currency_name == "澳大利亚元")

    assert aud.currency_code == "AUD"
    assert isinstance(aud.spot_buy, float) or aud.spot_buy is None
    assert isinstance(aud.spot_sell, float) or aud.spot_sell is None
    assert aud.spot_buy == pytest.approx(4.7384)
    assert aud.spot_sell == pytest.approx(4.7761)
    assert aud.published_at == "2026/08/05 17:04:28"


def test_parses_multiple_common_currencies(boc_rates) -> None:
    parsed_codes = {rate.currency_code for rate in boc_rates}

    assert {"USD", "EUR", "GBP", "JPY"}.issubset(parsed_codes)


def test_does_not_treat_headers_as_currencies(boc_rates) -> None:
    names = {rate.currency_name for rate in boc_rates}

    assert "货币名称" not in names
    assert "现汇卖出价" not in names


@pytest.mark.parametrize("html", ["", "<html><body>not a rate table</body></html>"])
def test_rejects_empty_or_invalid_html(html: str) -> None:
    with pytest.raises(ValueError):
        parse_boc_rates(html)
