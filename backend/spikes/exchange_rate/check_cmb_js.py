from pathlib import Path

import httpx


CMB_SCRIPT_URL = "https://fx.cmbchina.com/umi.js"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
RESPONSE_PATH = Path(__file__).with_name("cmb_umi_response.js")


def main() -> None:
    try:
        response = httpx.get(
            CMB_SCRIPT_URL,
            headers={
                "Referer": "https://fx.cmbchina.com/hq/",
                "User-Agent": USER_AGENT,
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

    response.raise_for_status()
    RESPONSE_PATH.write_bytes(response.content)
    print(f"Saved full response to: {RESPONSE_PATH}")


if __name__ == "__main__":
    main()
