from pathlib import Path

import httpx


BOC_EXCHANGE_RATE_URL = "https://www.boc.cn/sourcedb/whpj/"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
RESPONSE_PATH = Path(__file__).with_name("boc_response.html")


def main() -> None:
    try:
        response = httpx.get(
            BOC_EXCHANGE_RATE_URL,
            headers={"User-Agent": USER_AGENT},
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
    if hasattr(response, "apparent_encoding"):
        print(f"Apparent encoding: {response.apparent_encoding}")
    print(f"Final URL: {response.url}")
    print(f"Response byte length: {len(response.content)}")
    print("Response text (first 500 characters):")
    print(response_text[:500])
    print(f"Contains 澳大利亚元: {'澳大利亚元' in response_text}")
    print(f"Contains 现汇卖出价: {'现汇卖出价' in response_text}")

    RESPONSE_PATH.write_text(response_text, encoding="utf-8")
    print(f"Saved full response to: {RESPONSE_PATH}")


if __name__ == "__main__":
    main()
