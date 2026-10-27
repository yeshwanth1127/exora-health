"""Small, bounded public-web fetcher used by the reach audit. No browser or JS execution."""
import http.client
import ipaddress
import socket
import ssl
import time
import zlib
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit, urlunsplit

MAX_BODY = 1024 * 1024
USER_AGENT = "CaptureReachAudit/1.0"


class WebsiteFetchError(Exception):
    def __init__(self, code, message):
        self.code, self.message = code, message
        super().__init__(message)


@dataclass
class Page:
    url: str
    status: int
    headers: dict
    body: bytes
    elapsed_ms: int

    def text(self):
        # Do not let a remote page choose arbitrary Python codec names.
        return self.body.decode("utf-8", errors="replace")


def public_address(value):
    address = ipaddress.ip_address(value)
    if not address.is_global or address.is_multicast or address.is_reserved:
        return False
    if isinstance(address, ipaddress.IPv6Address):
        embedded = address.ipv4_mapped or address.sixtofour
        if embedded and not public_address(str(embedded)):
            return False
        if address.teredo and any(not public_address(str(part)) for part in address.teredo):
            return False
    return True


def public_target(value):
    """Validate each redirect, resolve once, and return a pinned public address."""
    if len(value) > 2048 or any(ord(char) < 33 or ord(char) == 127 for char in value) or "\\" in value:
        raise WebsiteFetchError("UNSAFE_URL", "The linked website address cannot be audited safely.")
    try:
        url = urlsplit(value)
        host = (url.hostname or "").encode("idna").decode("ascii").lower().rstrip(".")
        port = url.port or (443 if url.scheme == "https" else 80)
        if url.scheme not in ("http", "https") or not host or url.username is not None or url.password is not None:
            raise ValueError()
        if port != (443 if url.scheme == "https" else 80):
            raise ValueError()
        if host == "localhost" or host.endswith((".localhost", ".local", ".internal", ".home.arpa")) or "%" in host:
            raise ValueError()
        addresses = sorted({result[4][0] for result in socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)}, key=lambda ip: ":" in ip)
        if not addresses or any(not public_address(ip) for ip in addresses):
            raise ValueError()
    except (ValueError, UnicodeError, OSError):
        raise WebsiteFetchError("UNSAFE_TARGET", "The website does not resolve exclusively to public internet addresses.") from None
    authority = f"[{host}]" if ":" in host else host
    clean = urlunsplit((url.scheme, authority, url.path or "/", url.query, ""))
    return clean, host, port, addresses[0]


class PinnedHTTP(http.client.HTTPConnection):
    def __init__(self, host, port, ip, timeout):
        super().__init__(host, port, timeout=timeout)
        self.ip = ip

    def connect(self):
        self.sock = socket.create_connection((self.ip, self.port), self.timeout)


class PinnedHTTPS(http.client.HTTPSConnection):
    def __init__(self, host, port, ip, timeout):
        super().__init__(host, port, timeout=timeout, context=ssl.create_default_context())
        self.ip = ip

    def connect(self):
        raw = socket.create_connection((self.ip, self.port), self.timeout)
        try:
            self.sock = self._context.wrap_socket(raw, server_hostname=self.host)
        except Exception:
            raw.close()
            raise


def fetch_public(url, *, deadline=None, max_bytes=MAX_BODY, redirect_check=None):
    """No ambient proxies, cookies, credentials, automatic redirects or second DNS lookup."""
    started = time.monotonic()
    deadline = deadline or started + 12
    current = url
    for hop in range(4):
        if time.monotonic() >= deadline:
            raise WebsiteFetchError("TIMEOUT", "The website did not respond within the audit time limit.")
        current, host, port, ip = public_target(current)
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise WebsiteFetchError("TIMEOUT", "The website did not respond within the audit time limit.")
        cls = PinnedHTTPS if current.startswith("https:") else PinnedHTTP
        connection = cls(host, port, ip, min(6, remaining))
        try:
            parts = urlsplit(current)
            path = urlunsplit(("", "", parts.path, parts.query, ""))
            connection.request("GET", path, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9", "Accept-Encoding": "gzip, deflate", "Connection": "close"})
            response = connection.getresponse()
            headers = {}
            for key, value in response.getheaders():
                key = key.lower()
                headers[key] = headers[key] + ", " + value if key in headers else value
            if response.status in (301, 302, 303, 307, 308):
                location = headers.get("location", "")
                if not location:
                    raise WebsiteFetchError("REDIRECT_ERROR", "The website returned an incomplete redirect.")
                next_url = urljoin(current, location)
                if current.startswith("https:") and not next_url.startswith("https:"):
                    raise WebsiteFetchError("INSECURE_REDIRECT", "The HTTPS website redirects to an insecure address.")
                if redirect_check:
                    redirect_check(next_url)
                current = next_url
                continue
            encoding = headers.get("content-encoding", "identity").lower()
            if encoding not in ("", "identity", "gzip", "deflate"):
                raise WebsiteFetchError("ENCODING_UNSUPPORTED", "The website returned a compressed response the lightweight audit cannot assess.")
            try:
                if int(headers.get("content-length", "0")) > max_bytes:
                    raise WebsiteFetchError("PAGE_TOO_LARGE", "The page exceeds the lightweight audit size limit.")
            except ValueError:
                raise WebsiteFetchError("INVALID_RESPONSE", "The website returned an invalid response.") from None
            chunks, length = [], 0
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise WebsiteFetchError("TIMEOUT", "The website exceeded the audit time limit.")
                if connection.sock:
                    connection.sock.settimeout(min(4, remaining))
                chunk = response.read1(min(32768, max_bytes + 1 - length))
                if not chunk:
                    break
                chunks.append(chunk)
                length += len(chunk)
                if length > max_bytes:
                    raise WebsiteFetchError("PAGE_TOO_LARGE", "The page exceeds the lightweight audit size limit.")
            body = b"".join(chunks)
            if encoding in ("gzip", "deflate"):
                try:
                    decoder = zlib.decompressobj(16 + zlib.MAX_WBITS if encoding == "gzip" else zlib.MAX_WBITS)
                    body = decoder.decompress(body, max_bytes + 1)
                    if len(body) > max_bytes or decoder.unconsumed_tail:
                        raise WebsiteFetchError("PAGE_TOO_LARGE", "The decoded page exceeds the audit size limit.")
                    if not decoder.eof or decoder.unused_data:
                        raise WebsiteFetchError("INVALID_RESPONSE", "The website returned an incomplete or unsupported compressed page.")
                except zlib.error:
                    raise WebsiteFetchError("INVALID_RESPONSE", "The website returned invalid compressed content.") from None
            return Page(current, response.status, headers, body, round((time.monotonic() - started) * 1000))
        except WebsiteFetchError:
            raise
        except ssl.SSLCertVerificationError:
            raise WebsiteFetchError("TLS_ERROR", "The website's HTTPS certificate could not be verified.") from None
        except (OSError, http.client.HTTPException, ValueError):
            raise WebsiteFetchError("UNAVAILABLE", "The website could not be retrieved securely. It may block automated checks or be temporarily unavailable.") from None
        finally:
            connection.close()
    raise WebsiteFetchError("TOO_MANY_REDIRECTS", "The website redirects too many times for the lightweight audit.")
