"""Server-only Google Places adapter for the loopback website preview.

No key is returned to the browser, and Places responses are not stored.
Production requires a separately hosted same-origin service.
"""
import json
import os
import re
import time
from collections import deque
from pathlib import Path
from threading import Lock, BoundedSemaphore
from reach_report import build_report
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, urlsplit
from urllib.request import Request, urlopen

_lock = Lock()
_requests = deque()
_report_slots = BoundedSemaphore(2)


def api_key():
    value = os.environ.get("CAPTURE_GOOGLE_MAPS_API_KEY", "")
    if value:
        return value
    config = Path(__file__).with_name(".env.maps.local")
    if config.exists():
        for line in config.read_text().splitlines():
            if line.startswith("CAPTURE_GOOGLE_MAPS_API_KEY="):
                return line.split("=", 1)[1].strip()
    return ""


class LookupError(Exception):
    def __init__(self, code, message, status=503):
        self.code, self.message, self.status = code, message, status
        super().__init__(message)


def google_request(path, fields, body=None):
    key = api_key()
    if not key:
        raise LookupError("NOT_CONFIGURED", "Google lookup is not configured on this server.")
    request = Request(
        "https://places.googleapis.com/v1/" + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": fields},
        method="POST" if body is not None else "GET",
    )
    try:
        with urlopen(request, timeout=12) as response:
            return json.load(response)
    except HTTPError as error:
        try:
            payload = json.loads(error.read()).get("error", {})
            reason = next((item.get("reason") for item in payload.get("details", []) if item.get("reason")), "")
        except (ValueError, TypeError):
            reason = ""
        if reason == "SERVICE_DISABLED":
            raise LookupError("PLACES_DISABLED", "Google Places API (New) is disabled for the configured project. Enable it in Google Cloud, then try again.") from None
        if error.code == 403:
            raise LookupError("ACCESS_DENIED", "Google denied this request. Check the key’s Places API restrictions and project billing.") from None
        if error.code == 429:
            raise LookupError("QUOTA_EXCEEDED", "Google’s request limit has been reached for this project. Daily budget limits or short-term rate limits can cause this. Try again after the quota resets.", 429) from None
        raise LookupError("GOOGLE_ERROR", "Google could not complete the lookup. Please try again.") from None
    except (URLError, TimeoutError, ValueError):
        raise LookupError("LOOKUP_UNAVAILABLE", "Google lookup is unavailable right now. Please try again.") from None


def safe_url(value, google_only=False):
    try:
        url = urlsplit(value or "")
        if url.scheme not in ("https", "http") or not url.hostname or url.username or url.password:
            return ""
        if google_only and not (url.hostname == "google.com" or url.hostname.endswith(".google.com")):
            return ""
        return value
    except ValueError:
        return ""


def normalise(place):
    return {
        "id": place.get("id", ""),
        "name": place.get("displayName", {}).get("text", ""),
        "address": place.get("formattedAddress", ""),
        "category": place.get("primaryTypeDisplayName", {}).get("text", ""),
        "mapsUrl": safe_url(place.get("googleMapsUri"), True),
        "website": safe_url(place.get("websiteUri")),
        "phone": place.get("nationalPhoneNumber", ""),
        "hours": place.get("regularOpeningHours", {}).get("weekdayDescriptions", []),
        "rating": place.get("rating"),
        "reviewCount": place.get("userRatingCount"),
        "businessStatus": place.get("businessStatus", ""),
        "location": place.get("location"),
        "openNow": place.get("currentOpeningHours", {}).get("openNow"),
        "accessibility": {key: value for key, value in place.get("accessibilityOptions", {}).items() if isinstance(value, bool)},
        "attributions": [{"name": item.get("provider", ""), "url": safe_url(item.get("providerUri"))} for item in place.get("attributions", [])],
    }


def lookup(query_string):
    params = parse_qs(query_string)
    mode = params.get("mode", [""])[0]
    if mode == "status":
        return {"configured": bool(api_key())}
    if mode in ("search", "autocomplete"):
        query = params.get("q", [""])[0].strip()
        if len(query) < 2 or len(query) > 220 or any(ord(c) < 32 for c in query):
            raise LookupError("INVALID_QUERY", "Enter a business name and city, or a supported listing link.", 400)
    elif mode in ("details", "report"):
        place_id = params.get("id", [""])[0]
        if not re.fullmatch(r"[A-Za-z0-9_-]{5,250}", place_id):
            raise LookupError("INVALID_PLACE", "Choose a business from the search results.", 400)
    else:
        raise LookupError("INVALID_REQUEST", "Choose a search or a business result.", 400)
    session = params.get("session", [""])[0]
    if session and not re.fullmatch(r"[A-Za-z0-9_-]{1,36}", session):
        raise LookupError("INVALID_SESSION", "Please start a new search.", 400)
    with _lock:
        now = time.monotonic()
        while _requests and _requests[0] < now - 60:
            _requests.popleft()
        if len(_requests) >= 30:
            raise LookupError("RATE_LIMITED", "Too many lookups. Wait a minute, then try again.", 429)
        _requests.append(now)
    if mode == "autocomplete":
        body = {"input": query, "languageCode": "en"}
        if session:
            body["sessionToken"] = session
        response = google_request("places:autocomplete", "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text", body)
        return {"predictions": [{"id": item["placePrediction"]["placeId"], "label": item["placePrediction"].get("text", {}).get("text", "")} for item in response.get("suggestions", []) if item.get("placePrediction", {}).get("placeId")]}
    if mode == "search":
        response = google_request("places:searchText", "places.id,places.displayName,places.formattedAddress,places.primaryTypeDisplayName,places.googleMapsUri,places.attributions", {"textQuery": query, "pageSize": 5, "languageCode": "en"})
        return {"places": [normalise(place) for place in response.get("places", [])]}
    report_mode = mode == "report"
    if report_mode and not _report_slots.acquire(blocking=False):
        raise LookupError("AUDIT_BUSY", "Two reports are being checked. Please try again shortly.", 429)
    try:
        response = google_request("places/" + quote(place_id, safe="") + ("?sessionToken=" + quote(session, safe="") if session else ""), "id,displayName,formattedAddress,primaryTypeDisplayName,googleMapsUri,websiteUri,nationalPhoneNumber,regularOpeningHours,currentOpeningHours,location,accessibilityOptions,rating,userRatingCount,businessStatus,attributions")
        place = normalise(response)
        return {"report": build_report(place)} if report_mode else {"place": place}
    finally:
        if report_mode:
            _report_slots.release()
