from pathlib import Path
import ssl

import httpx


SCRIPT_URLS = (
    "https://ewealth.abchina.com.cn/images/foreignCommon.js",
    "https://ewealth.abchina.com.cn/images/foreignHomeJsh.js",
)
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


def main() -> None:
    legacy_server_connect = getattr(ssl, "OP_LEGACY_SERVER_CONNECT", None)
    if legacy_server_connect is None:
        print(
            "Current Python ssl module does not provide "
            "OP_LEGACY_SERVER_CONNECT; requests were not attempted."
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
            for script_url in SCRIPT_URLS:
                response = client.get(script_url, headers={"User-Agent": USER_AGENT})
                print(f"{script_url}: HTTP {response.status_code}")
                print(
                    "Content-Type: "
                    f"{response.headers.get('content-type', 'not provided')}"
                )
                print(f"Response byte length: {len(response.content)}")
                response.raise_for_status()

                response_path = Path(__file__).with_name(
                    f"abc_{Path(script_url).name[:-3]}_response.js"
                )
                response_path.write_bytes(response.content)
                print(f"Saved full response to: {response_path}")
    except httpx.HTTPError as error:
        print(f"Request failed: {error}")


if __name__ == "__main__":
    main()
