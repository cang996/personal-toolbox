import ssl
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

import httpx


CCB_XML_URL = "https://www2.ccb.com/cn/home/news/jshckpj_new2.xml"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "application/xml,text/xml,*/*",
}
RESPONSE_PATH = Path(__file__).with_name("ccb_xml_response.xml")
EXPECTED_FIELDS = (
    "Ofrd_Ccy_CcyCd",
    "Ofr_Ccy_CcyCd",
    "BidRateOfCcy",
    "OfrRateOfCcy",
    "BidRateOfCash",
    "OfrRateOfCash",
    "LstPr_Dt",
    "LstPr_Tm",
)


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def print_console_safe(value: str) -> None:
    encoding = sys.stdout.encoding or "utf-8"
    print(value.encode(encoding, errors="backslashreplace").decode(encoding))


def field_text(record: ET.Element, field: str) -> str | None:
    for child in record:
        if local_name(child.tag) == field:
            return child.text.strip() if child.text else ""
    return None


def print_record(record: ET.Element) -> None:
    for child in record:
        value = child.text.strip() if child.text else ""
        print_console_safe(f"{local_name(child.tag)}: {value}")


def request_with_one_timeout_retry(client: httpx.Client) -> httpx.Response | None:
    for attempt in (1, 2):
        print(f"Attempt {attempt}")
        try:
            return client.get(CCB_XML_URL, headers=HEADERS)
        except httpx.TimeoutException as error:
            print(f"Attempt {attempt} timed out: {error}")
            if attempt == 1:
                time.sleep(1.0)
                continue
            return None
        except httpx.HTTPError as error:
            print(f"Request failed: {error}")
            return None
    return None


def print_xml_diagnostics(response_content: bytes) -> None:
    try:
        root = ET.fromstring(response_content)
    except ET.ParseError as error:
        print("XML parsed successfully: False")
        print(f"XML parse error: {error}")
        return

    print("XML parsed successfully: True")
    print(f"Root tag: {local_name(root.tag)}")
    direct_child_tags = list(dict.fromkeys(local_name(child.tag) for child in root))
    print(f"Root direct child tags: {direct_child_tags}")

    records = [
        element
        for element in root.iter()
        if local_name(element.tag) == "ReferencePriceSettlement"
    ]
    print(f"ReferencePriceSettlement count: {len(records)}")

    all_tags = {local_name(element.tag) for element in root.iter()}
    print("Expected field presence:")
    for field in EXPECTED_FIELDS:
        print(f"{field}: {field in all_tags}")

    if not records:
        print("No ReferencePriceSettlement records were found.")
        print("AUD record with currency code 036: not found")
        return

    print("First ReferencePriceSettlement record:")
    print_record(records[0])

    aud_record = next(
        (
            record
            for record in records
            if field_text(record, "Ofrd_Ccy_CcyCd") == "036"
            or field_text(record, "Ofr_Ccy_CcyCd") == "036"
        ),
        None,
    )
    if aud_record is None:
        print("AUD record with currency code 036: not found")
        return

    print("AUD record with currency code 036: found")
    print("AUD ReferencePriceSettlement record:")
    print_record(aud_record)


def main() -> None:
    legacy_server_connect = getattr(ssl, "OP_LEGACY_SERVER_CONNECT", None)
    if legacy_server_connect is None:
        print(
            "Current Python ssl module does not provide "
            "OP_LEGACY_SERVER_CONNECT; request was not attempted."
        )
        return

    ssl_context = ssl.create_default_context()
    ssl_context.options |= legacy_server_connect

    with httpx.Client(
        verify=ssl_context,
        timeout=30.0,
        follow_redirects=True,
    ) as client:
        response = request_with_one_timeout_retry(client)

    if response is None:
        return

    print(f"HTTP status code: {response.status_code}")
    print(f"Content-Type: {response.headers.get('content-type', 'not provided')}")
    print(f"Response encoding: {response.encoding or 'not provided'}")
    print(f"Final URL: {response.url}")
    print(f"Response byte length: {len(response.content)}")
    print("Response text (first 1500 characters):")
    print_console_safe(response.text[:1500])

    RESPONSE_PATH.write_bytes(response.content)
    print(f"Saved full response to: {RESPONSE_PATH}")

    print_xml_diagnostics(response.content)


if __name__ == "__main__":
    main()
