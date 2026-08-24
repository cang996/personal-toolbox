from pathlib import Path
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup


CMB_EXCHANGE_RATE_URL = "https://fx.cmbchina.com/hq/"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
RESPONSE_PATH = Path(__file__).with_name("cmb_response.html")


def main() -> None:
    try:
        response = httpx.get(
            CMB_EXCHANGE_RATE_URL,
            headers={"User-Agent": USER_AGENT},
            timeout=15.0,
            follow_redirects=True,
        )
    except httpx.HTTPError as error:
        print(f"Request failed: {error}")
        return

    response_text = response.text
    soup = BeautifulSoup(response_text, "html.parser")

    print(f"HTTP status code: {response.status_code}")
    print(f"Content-Type: {response.headers.get('content-type', 'not provided')}")
    print(f"Response encoding: {response.encoding or 'not provided'}")
    print(f"Final URL: {response.url}")
    print(f"Response byte length: {len(response.content)}")
    print(f"Page title: {soup.title.get_text(' ', strip=True) if soup.title else ''}")
    print(f"Table count: {len(soup.find_all('table'))}")

    print("Scripts:")
    for script in soup.select("script[src]"):
        print(urljoin(str(response.url), script["src"]))

    print("Rate-related tables:")
    for table_index, table in enumerate(soup.find_all("table")):
        text = table.get_text(" ", strip=True)
        if any(marker in text for marker in ("现汇卖出价", "现汇买入价", "交易币单位")):
            rows = table.find_all("tr")
            print(f"Table {table_index}: {len(rows)} rows")
            for row in rows[:4]:
                print([cell.get_text(" ", strip=True) for cell in row.find_all(["th", "td"])])

    RESPONSE_PATH.write_text(response_text, encoding="utf-8")
    print(f"Saved full response to: {RESPONSE_PATH}")


if __name__ == "__main__":
    main()
