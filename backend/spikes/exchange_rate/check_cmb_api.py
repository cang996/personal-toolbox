from pathlib import Path
import json

import httpx


CMB_EXCHANGE_RATE_API_URL = "https://fx.cmbchina.com/api/v1/fx/rate"
CMB_HQ_BUSINESS_ID = "LB502215022800"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
RESPONSE_PATH = Path(__file__).with_name("cmb_response.json")


def main() -> None:
    try:
        response = httpx.get(
            CMB_EXCHANGE_RATE_API_URL,
            headers={
                "Accept": "application/json",
                "Referer": "https://fx.cmbchina.com/hq/",
                "User-Agent": USER_AGENT,
                "X-B3-BusinessId": CMB_HQ_BUSINESS_ID,
            },
            timeout=15.0,
            follow_redirects=True,
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
        response_text = response.content.decode("utf-8")
    except UnicodeDecodeError as error:
        print(f"Response is valid UTF-8: False ({error})")
        return
    print("Response is valid UTF-8: True")

    try:
        payload = json.loads(response_text)
    except json.JSONDecodeError:
        print("UTF-8-decoded response is valid JSON: False")
        print(response_text[:1000])
        return

    print("UTF-8-decoded response is valid JSON: True")
    print(
        "Top-level keys: "
        f"{sorted(payload) if isinstance(payload, dict) else 'not an object'}"
    )
    if isinstance(payload, dict):
        print(f"returnCode: {payload.get('returnCode')!r}")
        body = payload.get("body")
        print(f"Record count: {len(body) if isinstance(body, list) else 'not a list'}")
        if isinstance(body, list) and body:
            print(
                "Record fields: "
                f"{sorted(body[0]) if isinstance(body[0], dict) else 'not an object'}"
            )
            print(
                "First record (ASCII escaped): "
                f"{json.dumps(body[0], ensure_ascii=True, sort_keys=True)}"
            )

    RESPONSE_PATH.write_bytes(response.content)
    print(f"Saved full response to: {RESPONSE_PATH}")


if __name__ == "__main__":
    main()
