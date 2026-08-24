import ssl
from pathlib import Path
from typing import Any

import httpx


ICBC_API_URL = "https://papi.icbc.com.cn/exchanges/ns/getLatest"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
HEADERS = {
    "User-Agent": USER_AGENT,
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
}
RESPONSE_PATH = Path(__file__).with_name("icbc_api_response.json")


def print_json_diagnostics(payload: Any) -> None:
    print(f"Top-level data type: {type(payload).__name__}")

    if not isinstance(payload, dict):
        print("Top-level keys: not applicable")
        print("code: not available")
        print("data type: not available")
        print("data record count: not available")
        print("First record keys: not available")
        print("First record: not available")
        print("Contains currencyENName == AUD: False")
        return

    print(f"Top-level keys: {list(payload.keys())}")
    print(f"code: {payload.get('code', 'not available')}")

    data = payload.get("data")
    print(f"data type: {type(data).__name__ if data is not None else 'not available'}")

    if not isinstance(data, list):
        print("data record count: not available")
        print("First record keys: not available")
        print("First record: not available")
        print("Contains currencyENName == AUD: False")
        return

    print(f"data record count: {len(data)}")
    first_record = data[0] if data else None
    first_record_keys = (
        list(first_record.keys()) if isinstance(first_record, dict) else "not available"
    )
    print(f"First record keys: {first_record_keys}")
    print(f"First record: {first_record if first_record is not None else 'not available'}")

    aud_record = next(
        (
            record
            for record in data
            if isinstance(record, dict) and record.get("currencyENName") == "AUD"
        ),
        None,
    )
    print(f"Contains currencyENName == AUD: {aud_record is not None}")
    if aud_record is not None:
        print(f"AUD record: {aud_record}")


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
        with httpx.Client(verify=ssl_context) as client:
            response = client.post(
                ICBC_API_URL,
                headers=HEADERS,
                content=b"",
                timeout=15.0,
                follow_redirects=True,
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

    RESPONSE_PATH.write_text(response_text, encoding="utf-8")
    print(f"Saved full response to: {RESPONSE_PATH}")

    try:
        payload = response.json()
    except ValueError:
        print("Response is valid JSON: False")
        return

    print("Response is valid JSON: True")
    print_json_diagnostics(payload)


if __name__ == "__main__":
    main()
