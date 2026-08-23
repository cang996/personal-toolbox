import ssl
from pathlib import Path

import httpx


CCB_EXCHANGE_RATE_URL = (
    "https://www2.ccb.com/chn/forex/exchange-quotations.shtml?tab=0"
)
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
HTML_RESPONSE_PATH = Path(__file__).with_name("ccb_response.html")
JSON_RESPONSE_PATH = Path(__file__).with_name("ccb_response.json")

TEXT_MARKERS = (
    "澳大利亚元",
    "AUD",
    "美元",
    "现汇买入",
    "现汇卖出",
    "买入价",
    "卖出价",
)
SOURCE_MARKERS = (
    "table",
    "iframe",
    "fetch",
    "XMLHttpRequest",
    "$.ajax",
    "axios",
    "JSON",
    "api",
    "exchange",
    "forex",
    "quotation",
    "rate",
)


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

    try:
        with httpx.Client(
            verify=ssl_context,
            timeout=15.0,
            follow_redirects=True,
        ) as client:
            response = client.get(
                CCB_EXCHANGE_RATE_URL,
                headers={"User-Agent": USER_AGENT},
            )
    except httpx.HTTPError as error:
        print(f"Request failed: {error}")
        return

    response_text = response.text

    print(f"HTTP status code: {response.status_code}")
    print(f"Content-Type: {response.headers.get('content-type', 'not provided')}")
    print(f"Response encoding: {response.encoding or 'not provided'}")
    print(f"Final URL: {response.url}")
    print(f"Response byte length: {len(response.content)}")
    print("Response text (first 1000 characters):")
    print(response_text[:1000])

    print("Text markers:")
    for marker in TEXT_MARKERS:
        print(f"Contains {marker}: {marker in response_text}")

    lower_response_text = response_text.lower()
    print("Source markers (case-insensitive):")
    for marker in SOURCE_MARKERS:
        print(f"Contains {marker}: {marker.lower() in lower_response_text}")

    try:
        response.json()
    except ValueError:
        response_path = HTML_RESPONSE_PATH
        print("Response is valid JSON: False")
    else:
        response_path = JSON_RESPONSE_PATH
        print("Response is valid JSON: True")

    response_path.write_text(response_text, encoding="utf-8")
    print(f"Saved full response to: {response_path}")


if __name__ == "__main__":
    main()
