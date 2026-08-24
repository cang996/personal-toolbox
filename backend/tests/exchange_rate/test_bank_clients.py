from pathlib import Path

import httpx
import pytest

from backend.app.exchange_rate.clients import (
    AbcClient,
    BocClient,
    CcbClient,
    CmbClient,
    IcbcClient,
)


FIXTURES = Path(__file__).parent / "fixtures"


@pytest.mark.parametrize(
    ("client_type", "fixture_name", "method", "expected_count"),
    [
        (BocClient, "boc_rates.html", "GET", 40),
        (IcbcClient, "icbc_rates.json", "POST", 21),
        (CcbClient, "ccb_rates.xml", "GET", 29),
        (AbcClient, "abc_rates.json", "GET", 24),
        (CmbClient, "cmb_rates.json", "GET", 10),
    ],
)
def test_production_client_uses_official_request_and_existing_mapping(
    client_type: type, fixture_name: str, method: str, expected_count: int
) -> None:
    fixture = (FIXTURES / fixture_name).read_bytes()
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, content=fixture, request=request)

    client = client_type(transport=httpx.MockTransport(handler))
    rates = client.fetch_rates()

    assert len(requests) == 1
    assert requests[0].method == method
    assert str(requests[0].url) == client.source_url
    assert len(rates) == expected_count
    assert {rate.bank_code for rate in rates} == {client.bank_code}
    assert all(rate.published_at.utcoffset() is not None for rate in rates)


@pytest.mark.parametrize("client_type", [BocClient, IcbcClient, CcbClient, CmbClient])
def test_naive_china_bank_timestamp_uses_asia_shanghai(client_type: type) -> None:
    fixture_names = {
        BocClient: "boc_rates.html",
        IcbcClient: "icbc_rates.json",
        CcbClient: "ccb_rates.xml",
        CmbClient: "cmb_rates.json",
    }
    fixture = (FIXTURES / fixture_names[client_type]).read_bytes()
    transport = httpx.MockTransport(lambda request: httpx.Response(200, content=fixture))

    rates = client_type(transport=transport).fetch_rates()

    assert all(rate.published_at.tzinfo.key == "Asia/Shanghai" for rate in rates)


def test_abc_preserves_upstream_offset_and_mapper_derivation() -> None:
    fixture = (FIXTURES / "abc_rates.json").read_bytes()
    transport = httpx.MockTransport(lambda request: httpx.Response(200, content=fixture))

    rates = AbcClient(transport=transport).fetch_rates()

    assert all(rate.published_at.isoformat().endswith("+08:00") for rate in rates)
    assert all(rate.cash_sell == rate.spot_sell for rate in rates)
    assert all(rate.derived_fields == frozenset({"cash_sell"}) for rate in rates)
