from pathlib import Path
import ssl

import httpx


ABC_EXCHANGE_RATE_API_URL = (
    "https://ewealth.abchina.com.cn/app/data/api/DataService/ExchangeRateV2"
)
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
RESPONSE_PATH = Path(__file__).with_name("abc_response.json")


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
                ABC_EXCHANGE_RATE_API_URL,
                headers={
                    "Accept": "application/json, text/javascript, */*; q=0.01",
                    "Referer": "https://ewealth.abchina.com.cn/ForeignExchange/ListPrice/",
                    "User-Agent": USER_AGENT,
                    "X-Requested-With": "XMLHttpRequest",
                },
            )
    except httpx.HTTPError as error:
        print(f"Request failed: {error}")
        return

    print(f"HTTP status code: {response.status_code}")
    print(f"Content-Type: {response.headers.get('content-type', 'not provided')}")
    print(f"Response encoding: {response.encoding or 'not provided'}")
    print(f"Final URL: {response.url}")
    print(f"Response byte length: {len(response.content)}")

    try:
        payload = response.json()
    except ValueError:
        print("Response is valid JSON: False")
        print(response.text[:1000])
        return

    print("Response is valid JSON: True")
    print(f"Top-level keys: {sorted(payload) if isinstance(payload, dict) else 'not an object'}")
    if isinstance(payload, dict):
        print(f"ErrorCode: {payload.get('ErrorCode')!r}")
        data = payload.get("Data")
        table = data.get("Table") if isinstance(data, dict) else None
        print(f"Record count: {len(table) if isinstance(table, list) else 'not a list'}")
        if isinstance(table, list) and table:
            print(f"Record fields: {sorted(table[0]) if isinstance(table[0], dict) else 'not an object'}")
            print(f"First record: {table[0]!r}")

    RESPONSE_PATH.write_bytes(response.content)
    print(f"Saved full response to: {RESPONSE_PATH}")


if __name__ == "__main__":
    main()
