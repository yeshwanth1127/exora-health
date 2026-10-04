"""Small in-process safety limits; upstream proxy limits remain the first line of defence."""
import hashlib
import hmac
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware

from .config import settings


class LimitsMiddleware(BaseHTTPMiddleware):
    BODY_LIMIT = 256 * 1024
    UPLOAD_LIMIT = 20 * 1024 * 1024

    def __init__(self, app):
        super().__init__(app)
        self.events: dict[str, deque[float]] = defaultdict(deque)

    def _service_request(self, request: Request) -> bool:
        supplied = request.headers.get("X-Service-Key", "")
        valid = [settings.voice_service_api_key, settings.whatsapp_service_api_key]
        return bool(supplied and any(value and hmac.compare_digest(supplied, value) for value in valid))

    def _allow(self, key: str, count: int, window: int) -> bool:
        now = time.monotonic()
        bucket = self.events[key]
        while bucket and bucket[0] <= now - window:
            bucket.popleft()
        if len(bucket) >= count:
            return False
        bucket.append(now)
        return True

    async def dispatch(self, request: Request, call_next):
        if not settings.rate_limits_enabled:
            return await call_next(request)
        content_length = request.headers.get("content-length")
        is_upload = "multipart/form-data" in request.headers.get("content-type", "")
        maximum = self.UPLOAD_LIMIT if is_upload else self.BODY_LIMIT
        if content_length and int(content_length) > maximum:
            raise HTTPException(status_code=413, detail="Request body is too large")
        if not self._service_request(request):
            ip = request.client.host if request.client else "unknown"
            session = request.cookies.get(settings.session_cookie_name, "")
            identity = hashlib.sha256(session.encode()).hexdigest()[:16] if session else ip
            if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
                count, window = (120, 60) if session else (40, 60)
                if not self._allow(f"write:{identity}", count, window):
                    raise HTTPException(status_code=429, detail="Too many requests")
        return await call_next(request)
