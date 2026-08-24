from pathlib import Path
import ssl
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup


ABC_LIST_PRICE_URL = "https://ewealth.abchina.com.cn/ForeignExchange/ListPrice/"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
RESPONSE_PATH = Path(__file__).with_name("abc_response.html")


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
                ABC_LIST_PRICE_URL,
                headers={"User-Agent": USER_AGENT},
            )
    except httpx.HTTPError as error:
        print(f"Request failed: {error}")
        return

    try:
        response_text = response.content.decode("gb18030")
    except UnicodeDecodeError:
        response_text = response.text
    soup = BeautifulSoup(response_text, "html.parser")

    print(f"HTTP status code: {response.status_code}")
    print(f"Content-Type: {response.headers.get('content-type', 'not provided')}")
    print(f"Response encoding: {response.encoding or 'not provided'}")
    print(f"Final URL: {response.url}")
    print(f"Response byte length: {len(response.content)}")
    print(f"Page title: {soup.title.get_text(' ', strip=True) if soup.title else ''}")

    print("Frames:")
    for frame in soup.select("iframe[src]"):
        print(urljoin(str(response.url), frame["src"]))

    print("Scripts:")
    for script in soup.select("script[src]"):
        print(urljoin(str(response.url), script["src"]))

    print("Inline request markers:")
    for line in response_text.splitlines():
        lowered = line.lower()
        if any(marker in lowered for marker in ("ajax", "fetch(", "xmlhttprequest", "listprice")):
            print(line.strip()[:500])

    RESPONSE_PATH.write_text(response_text, encoding="utf-8")
    print(f"Saved full response to: {RESPONSE_PATH}")


if __name__ == "__main__":
    main()
