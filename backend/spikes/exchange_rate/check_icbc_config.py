import re
from pathlib import Path

import httpx


ICBC_CONFIG_URL = "https://www.icbc.com.cn/Portal_Resources/Common/config.js?v=1"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
RESPONSE_PATH = Path(__file__).with_name("icbc_config_response.js")

HOST_PATTERNS = (
    re.compile(
        r"window\.appConfig\.papi\.host\s*=\s*(['\"])(?P<host>[^'\"]+)\1"
    ),
    re.compile(
        r"\bpapi\s*:\s*\{(?:(?!\}).)*?\bhost\s*:\s*(['\"])(?P<host>[^'\"]+)\1",
        re.DOTALL,
    ),
)


def find_papi_host(script: str) -> str | None:
    """Conservatively extract a quoted papi.host assignment from JavaScript."""
    for pattern in HOST_PATTERNS:
        match = pattern.search(script)
        if match:
            return match.group("host")
    return None


def print_papi_context(script: str) -> None:
    index = script.lower().find("papi")
    if index == -1:
        print("No 'papi' text was found in the configuration response.")
        return

    start = max(0, index - 250)
    end = min(len(script), index + 500)
    print("Context around 'papi':")
    print(script[start:end])


def main() -> None:
    try:
        response = httpx.get(
            ICBC_CONFIG_URL,
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
    print(f"Final URL: {response.url}")
    print(f"Response byte length: {len(response.content)}")
    print("Response text (first 1000 characters):")
    print(response_text[:1000])
    print(f"Contains appConfig: {'appConfig' in response_text}")
    print(f"Contains papi: {'papi' in response_text}")
    print(f"Contains host: {'host' in response_text}")

    RESPONSE_PATH.write_text(response_text, encoding="utf-8")
    print(f"Saved full response to: {RESPONSE_PATH}")

    papi_host = find_papi_host(response_text)
    if papi_host is None:
        print("Could not reliably extract window.appConfig.papi.host.")
        print_papi_context(response_text)
    else:
        print(f"Extracted window.appConfig.papi.host: {papi_host}")


if __name__ == "__main__":
    main()
