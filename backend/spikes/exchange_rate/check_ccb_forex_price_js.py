import ssl
from pathlib import Path

import httpx


CCB_FOREX_PRICE_JS_URL = (
    "https://www2.ccb.com/uiFramework/commonResource/zip/cn/cn/forex/v3/js/"
    "forex_price.js"
)
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
RESPONSE_PATH = Path(__file__).with_name("ccb_forex_price_response.js")

MARKERS = (
    "jshckpj",
    "$.ajax",
    "$.get",
    "$.post",
    "ajax",
    "url:",
    "type:",
    "data:",
    "dataType:",
    "json",
    "jsonp",
    "callback",
    "XMLHttpRequest",
    "fetch",
    "quotation",
    "exchange",
    "forex",
    "price",
    "rate",
    "currency",
    "curr",
    "buy",
    "sell",
    "timestamp",
    "publish",
    "html(",
    "append(",
    "appendTo(",
    "before(",
    "after(",
)

CONTEXT_MARKERS = {
    "jshckpj",
    "$.ajax",
    "$.get",
    "$.post",
    "url:",
    "type:",
    "data:",
    "dataType:",
    "jsonp",
    "callback",
    "XMLHttpRequest",
    "fetch",
    "html(",
    "append(",
    "appendTo(",
    "before(",
    "after(",
}
MAX_CONTEXTS_PER_MARKER = 8
CONTEXT_BEFORE = 500
CONTEXT_AFTER = 900


def find_occurrences(source: str, marker: str) -> list[int]:
    source_lower = source.lower()
    marker_lower = marker.lower()
    occurrences: list[int] = []
    start = 0

    while True:
        index = source_lower.find(marker_lower, start)
        if index == -1:
            return occurrences
        occurrences.append(index)
        start = index + len(marker)


def line_number(source: str, index: int) -> int:
    return source.count("\n", 0, index) + 1


def print_static_analysis(source: str) -> None:
    print("Static-analysis marker summary:")
    occurrences_by_marker: dict[str, list[int]] = {}
    for marker in MARKERS:
        occurrences = find_occurrences(source, marker)
        occurrences_by_marker[marker] = occurrences
        lines = [line_number(source, index) for index in occurrences]
        displayed_lines = lines[:20]
        suffix = " ..." if len(lines) > len(displayed_lines) else ""
        print(
            f"{marker}: {len(occurrences)} occurrence(s); "
            f"lines={displayed_lines}{suffix}"
        )

    print("Key source contexts:")
    for marker in MARKERS:
        if marker not in CONTEXT_MARKERS:
            continue
        occurrences = occurrences_by_marker[marker]
        for occurrence_number, index in enumerate(
            occurrences[:MAX_CONTEXTS_PER_MARKER], start=1
        ):
            start = max(0, index - CONTEXT_BEFORE)
            end = min(len(source), index + len(marker) + CONTEXT_AFTER)
            print(
                f"--- {marker} occurrence {occurrence_number}/{len(occurrences)} "
                f"at line {line_number(source, index)} ---"
            )
            print(source[start:end])
        if len(occurrences) > MAX_CONTEXTS_PER_MARKER:
            print(
                f"--- {marker}: omitted "
                f"{len(occurrences) - MAX_CONTEXTS_PER_MARKER} additional context(s) ---"
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
                CCB_FOREX_PRICE_JS_URL,
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
    print("JavaScript text (first 1500 characters):")
    print(response_text[:1500])

    RESPONSE_PATH.write_text(response_text, encoding="utf-8")
    print(f"Saved full response to: {RESPONSE_PATH}")

    print_static_analysis(response_text)


if __name__ == "__main__":
    main()
