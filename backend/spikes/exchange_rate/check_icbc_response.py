from pathlib import Path

import httpx


ICBC_EXCHANGE_RATE_URL = (
    "https://www.icbc.com.cn/ICBC/"
    "%E9%87%91%E8%9E%8D%E4%BF%A1%E6%81%AF/"
    "%E8%A1%8C%E6%83%85%E6%95%B0%E6%8D%AE/"
    "%E4%BA%BA%E6%B0%91%E5%B8%81%E5%8D%B3%E6%9C%9F%E5%A4%96%E6%B1%87%E7%89%8C%E4%BB%B7/"
)
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
RESPONSE_PATH = Path(__file__).with_name("icbc_response.html")


def main() -> None:
    try:
        response = httpx.get(
            ICBC_EXCHANGE_RATE_URL,
            headers={"User-Agent": USER_AGENT},
            timeout=15.0,
            follow_redirects=True,
        )
    except httpx.HTTPError as error:
        print(f"Request failed: {error}")
        return

    response_text = response.text
    has_spot_buy_header = any(
        header in response_text for header in ("现汇买入", "银行买入价", "汇买")
    )
    has_sell_header = any(
        header in response_text for header in ("卖出价", "银行卖出价", "汇卖")
    )

    print(f"HTTP status code: {response.status_code}")
    print(f"Content-Type: {response.headers.get('content-type', 'not provided')}")
    print(f"Response encoding: {response.encoding or 'not provided'}")
    print(f"Final URL: {response.url}")
    print(f"Response byte length: {len(response.content)}")
    print("Response text (first 500 characters):")
    print(response_text[:500])
    print(f"Contains 澳大利亚元: {'澳大利亚元' in response_text}")
    print(f"Contains spot-buy header: {has_spot_buy_header}")
    print(f"Contains sell-price header: {has_sell_header}")

    RESPONSE_PATH.write_text(response_text, encoding="utf-8")
    print(f"Saved full response to: {RESPONSE_PATH}")


if __name__ == "__main__":
    main()
