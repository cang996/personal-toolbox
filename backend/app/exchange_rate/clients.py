import ssl

import httpx

from .banks.abc import parse_abc_rates
from .banks.boc import parse_boc_rates
from .banks.ccb import parse_ccb_rates
from .banks.cmb import parse_cmb_rates
from .banks.icbc import parse_icbc_rates
from .mappers import (
    map_abc_rate,
    map_boc_rate,
    map_ccb_rate,
    map_cmb_rate,
    map_icbc_rate,
)
from .models import BankExchangeRate
from .policies import CHINA_SOURCE_TIMEZONE


USER_AGENT = "personal-toolbox/1.0"


def _legacy_tls_context() -> ssl.SSLContext:
    legacy_option = getattr(ssl, "OP_LEGACY_SERVER_CONNECT", None)
    if legacy_option is None:
        raise RuntimeError("This Python SSL module does not support legacy server connect.")
    context = ssl.create_default_context()
    context.options |= legacy_option
    return context


class BocClient:
    bank_code = "BOC"
    bank_name = "中国银行"
    source_url = "https://www.boc.cn/sourcedb/whpj/"

    def __init__(self, *, transport: httpx.BaseTransport | None = None) -> None:
        self._transport = transport

    def fetch_rates(self) -> list[BankExchangeRate]:
        with httpx.Client(transport=self._transport, timeout=15.0) as client:
            response = client.get(self.source_url, headers={"User-Agent": USER_AGENT})
            response.raise_for_status()
        return [
            map_boc_rate(rate, source_timezone=CHINA_SOURCE_TIMEZONE)
            for rate in parse_boc_rates(response.text)
        ]


class IcbcClient:
    bank_code = "ICBC"
    bank_name = "中国工商银行"
    source_url = "https://papi.icbc.com.cn/exchanges/ns/getLatest"

    def __init__(self, *, transport: httpx.BaseTransport | None = None) -> None:
        self._transport = transport

    def fetch_rates(self) -> list[BankExchangeRate]:
        with httpx.Client(
            verify=_legacy_tls_context(), transport=self._transport, timeout=15.0
        ) as client:
            response = client.post(
                self.source_url,
                content=b"",
                headers={
                    "User-Agent": USER_AGENT,
                    "Content-Type": "application/json",
                    "Accept": "application/json, text/plain, */*",
                },
            )
            response.raise_for_status()
        return [
            map_icbc_rate(rate, source_timezone=CHINA_SOURCE_TIMEZONE)
            for rate in parse_icbc_rates(response.text)
        ]


class CcbClient:
    bank_code = "CCB"
    bank_name = "中国建设银行"
    source_url = "https://www2.ccb.com/cn/home/news/jshckpj_new2.xml"

    def __init__(self, *, transport: httpx.BaseTransport | None = None) -> None:
        self._transport = transport

    def fetch_rates(self) -> list[BankExchangeRate]:
        with httpx.Client(
            verify=_legacy_tls_context(), transport=self._transport, timeout=30.0
        ) as client:
            response = self._get_with_one_timeout_retry(client)
            response.raise_for_status()
        return [
            map_ccb_rate(rate, source_timezone=CHINA_SOURCE_TIMEZONE)
            for rate in parse_ccb_rates(response.content)
        ]

    def _get_with_one_timeout_retry(self, client: httpx.Client) -> httpx.Response:
        headers = {"User-Agent": USER_AGENT, "Accept": "application/xml, text/xml, */*"}
        try:
            return client.get(self.source_url, headers=headers)
        except httpx.TimeoutException:
            return client.get(self.source_url, headers=headers)


class AbcClient:
    bank_code = "ABC"
    bank_name = "中国农业银行"
    source_url = (
        "https://ewealth.abchina.com.cn/app/data/api/DataService/ExchangeRateV2"
    )

    def __init__(self, *, transport: httpx.BaseTransport | None = None) -> None:
        self._transport = transport

    def fetch_rates(self) -> list[BankExchangeRate]:
        with httpx.Client(
            verify=_legacy_tls_context(), transport=self._transport, timeout=15.0
        ) as client:
            response = client.get(
                self.source_url,
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept": "application/json, text/javascript, */*; q=0.01",
                    "Referer": "https://ewealth.abchina.com.cn/ForeignExchange/ListPrice/",
                    "X-Requested-With": "XMLHttpRequest",
                },
            )
            response.raise_for_status()
        return [map_abc_rate(rate) for rate in parse_abc_rates(response.text)]


class CmbClient:
    bank_code = "CMB"
    bank_name = "招商银行"
    source_url = "https://fx.cmbchina.com/api/v1/fx/rate"

    def __init__(self, *, transport: httpx.BaseTransport | None = None) -> None:
        self._transport = transport

    def fetch_rates(self) -> list[BankExchangeRate]:
        with httpx.Client(transport=self._transport, timeout=15.0) as client:
            response = client.get(
                self.source_url,
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept": "application/json",
                    "Referer": "https://fx.cmbchina.com/hq/",
                    "X-B3-BusinessId": "LB502215022800",
                },
            )
            response.raise_for_status()
        return [
            map_cmb_rate(rate, source_timezone=CHINA_SOURCE_TIMEZONE)
            for rate in parse_cmb_rates(response.text)
        ]


def production_bank_clients() -> tuple[
    BocClient, IcbcClient, CcbClient, AbcClient, CmbClient
]:
    return BocClient(), IcbcClient(), CcbClient(), AbcClient(), CmbClient()
