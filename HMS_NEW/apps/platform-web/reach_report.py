"""Versioned deterministic readiness rubric. Scores are not traffic, ranking or revenue estimates."""
from datetime import datetime, timezone
from html.parser import HTMLParser
import re
import time
from urllib.parse import urljoin, urlsplit, urlunsplit
from urllib.robotparser import RobotFileParser
from website_fetch import fetch_public, WebsiteFetchError, USER_AGENT

RUBRIC_VERSION = "reach-readiness-1.0"
CATEGORIES = [("google", "Google profile", 40), ("website", "Website basics", 20), ("search", "Search signals", 20), ("contact", "Contact paths", 20)]
WEBSITE_RULES = [
    ("https", "website", "HTTPS connection", 5, "Serve the website over HTTPS with a valid certificate."),
    ("available", "website", "Homepage available", 5, "Check the homepage response and remove access errors for visitors."),
    ("viewport", "website", "Mobile viewport declared", 5, "Add a viewport meta tag with width=device-width."),
    ("content", "website", "Page text in HTML", 5, "Make key clinic information available in the page HTML and verify that visitors can read it."),
    ("title", "search", "Page title", 5, "Add a descriptive title with the clinic name and location."),
    ("description", "search", "Search description", 5, "Add a concise meta description that explains the clinic and its services."),
    ("heading", "search", "Main page heading", 5, "Add a clear H1 describing this clinic or its main service."),
    ("indexing", "search", "No explicit indexing block", 5, "Review robots rules, noindex meta tags and X-Robots-Tag headers."),
    ("phone_link", "contact", "Direct call or WhatsApp link", 8, "Add a visible tap-to-call or WhatsApp link."),
    ("booking", "contact", "Booking or enquiry link", 6, "Add a clearly labelled booking, appointment or reservation link."),
    ("contact", "contact", "Contact route", 6, "Add a clearly labelled contact page or email link."),
]


class PageSignals(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.meta, self.links, self.text, self.title, self.headings = {}, [], [], [], []
        self.hidden = 0
        self.in_title = False
        self.in_heading = False
        self.current_link = None
        self.scripts = 0

    def handle_starttag(self, tag, attrs):
        attrs = {key: value or "" for key, value in attrs}
        if tag in ("script", "style", "noscript", "template"):
            self.hidden += 1
            self.scripts += tag == "script"
        if self.hidden:
            return
        if tag == "meta":
            key = (attrs.get("name") or attrs.get("property") or "").lower()
            self.meta[key] = attrs.get("content", "")
        if tag == "title": self.in_title = True
        if tag == "h1": self.in_heading = True
        if tag == "a":
            self.current_link = {"href": attrs.get("href", ""), "text": ""}
            self.links.append(self.current_link)

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript", "template"):
            self.hidden = max(0, self.hidden - 1)
        if tag == "title": self.in_title = False
        if tag == "h1": self.in_heading = False
        if tag == "a": self.current_link = None

    def handle_data(self, data):
        if self.hidden or not data.strip(): return
        text = data.strip()
        self.text.append(text)
        if self.in_title: self.title.append(text)
        if self.in_heading: self.headings.append(text)
        if self.current_link is not None: self.current_link["text"] += " " + text


def check(key, category, label, weight, status, evidence, fix="", source=""):
    return {"id": key, "category": category, "label": label, "weight": weight, "status": status, "evidence": evidence, "fix": fix if status != "pass" else "", "sourceUrl": source}


def google_checks(place):
    rules = [
        ("name", "Business name returned", 4, bool(place.get("name")), "Business name", "Verify the listing name in Google Business Profile."),
        ("category", "Business category returned", 4, bool(place.get("category")), "Primary category", "Review the primary category in Google Business Profile."),
        ("address", "Public address returned", 8, bool(place.get("address")), "Public address", "Review the location or service-area settings in Google Business Profile."),
        ("phone", "Public phone returned", 8, bool(place.get("phone")), "Phone number", "Review the public contact number in Google Business Profile."),
        ("hours", "Opening hours returned", 8, bool(place.get("hours")), "Regular opening hours", "Review the regular opening hours in Google Business Profile."),
    ]
    result = [check("google_" + key, "google", label, weight, "pass" if present else "review", f"{field} {'was returned by Google.' if present else 'was not returned. It may be missing, hidden or unsupported; verify it with the listing owner.'}", fix, place.get("mapsUrl", "")) for key, label, weight, present, field, fix in rules]
    state = place.get("businessStatus", "")
    result.append(check("google_status", "google", "Listing marked operational", 8, "pass" if state == "OPERATIONAL" else "review" if state in ("CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY") else "unknown", {"OPERATIONAL": "Google marks the business operational.", "CLOSED_TEMPORARILY": "Google marks the business temporarily closed.", "CLOSED_PERMANENTLY": "Google marks the business permanently closed."}.get(state, "Google did not return a listing status."), "Confirm that the opening or closure status matches the business.", place.get("mapsUrl", "")))
    return result


def unknown_website(reason, url=""):
    return [check(key, category, label, weight, "unknown", reason, fix, url) for key, category, label, weight, fix in WEBSITE_RULES]


def usable_link(base, href):
    if not href.strip() or href.strip().startswith("#"):
        return False
    try:
        target = urlsplit(urljoin(base, href.strip()))
        return bool(target.hostname) if target.scheme in ("http", "https") else target.scheme in ("tel", "mailto") and bool(target.path)
    except ValueError:
        return False


def linked_host(base, href):
    try:
        return (urlsplit(urljoin(base, href)).hostname or "").lower()
    except ValueError:
        return ""


def assess_html(page, robots_status="unavailable"):
    parser = PageSignals()
    parser.feed(page.text())
    title, heading = " ".join(parser.title), " ".join(parser.headings)
    links = parser.links
    visible = " ".join(parser.text)
    robots_meta = ",".join(parser.meta.get(key, "") for key in ("robots", "googlebot")).lower()
    robots_header = page.headers.get("x-robots-tag", "").lower()
    noindex = bool(re.search(r"\b(noindex|none)\b", robots_meta + "," + robots_header))
    viewport = parser.meta.get("viewport", "").lower().replace(" ", "")
    direct = [link for link in links if link["href"].lower().startswith("tel:") or linked_host(page.url, link["href"]) in ("wa.me", "api.whatsapp.com", "web.whatsapp.com")]
    # Recognisable links are a presence signal; their destination and booking completion are not tested.
    useful_links = [link for link in links if usable_link(page.url, link["href"])]
    booking = [link for link in useful_links if re.search(r"\b(book|booking|appointment|schedule|reserve|reservation|enquiry|inquiry)\b", link["text"], re.I)]
    contact = [link for link in useful_links if link["href"].lower().startswith("mailto:") or re.search(r"\b(contact|get in touch)\b", link["text"], re.I)]
    answers = {
        "https": (page.url.startswith("https:"), "Final homepage connection uses HTTPS." if page.url.startswith("https:") else "Final homepage connection uses HTTP."),
        "available": (200 <= page.status < 300, f"Homepage returned HTTP {page.status}."),
        "viewport": ("width=device-width" in viewport, "Mobile viewport declaration found." if "width=device-width" in viewport else "No width=device-width viewport declaration found in the retrieved HTML."),
        "content": (True if len(visible.split()) >= 25 else None if parser.scripts else False, f"Retrieved HTML contains {len(visible.split())} non-script text words. Rendering and visual visibility are not inspected."),
        "title": (bool(title), f"Title: {title[:180]}" if title else "No non-empty title was found in the retrieved HTML."),
        "description": (bool(parser.meta.get("description", "").strip()), "Meta description found." if parser.meta.get("description", "").strip() else "No non-empty meta description found in the retrieved HTML."),
        "heading": (bool(heading), f"H1: {heading[:180]}" if heading else "No non-empty H1 found in the retrieved HTML."),
        "indexing": (False if noindex or robots_status == "blocked_google" else True if robots_status == "allowed" else None, "robots.txt disallows Googlebot for this homepage." if robots_status == "blocked_google" else "Explicit noindex instruction found." if noindex else "No explicit noindex found; robots.txt allows this audit." if robots_status == "allowed" else "No noindex tag found, but robots.txt could not be checked. Indexing is unassessed."),
        "phone_link": (bool(direct), "Tap-to-call or WhatsApp link found." if direct else "No tap-to-call or recognised WhatsApp link found in the retrieved HTML."),
        "booking": (bool(booking), "Recognisable booking or enquiry link found; its flow has not been tested." if booking else "No recognisable booking or enquiry link found in the retrieved HTML."),
        "contact": (bool(contact), "Contact or email link found; its destination has not been tested." if contact else "No recognisable contact or email link found in the retrieved HTML."),
    }
    return [check(key, category, label, weight, "unknown" if answers[key][0] is None else "pass" if answers[key][0] else "review", answers[key][1], fix, page.url) for key, category, label, weight, fix in WEBSITE_RULES]


def audit_website(url, fetcher=fetch_public):
    if not url:
        return {"state": "not_linked", "url": "", "finalUrl": "", "message": "Google did not return a linked website. This report assesses the public profile only."}, unknown_website("No linked website was returned by Google.")
    deadline = time.monotonic() + 14
    parts = urlsplit(url)
    robots_url = urlunsplit((parts.scheme, parts.netloc, "/robots.txt", "", ""))
    robots_status = "unavailable"
    try:
        robots = fetcher(robots_url, deadline=deadline, max_bytes=65536)
        if robots.status == 200:
            robot_parser = RobotFileParser()
            robot_parser.parse(robots.text().splitlines())
            if not robot_parser.can_fetch(USER_AGENT, url):
                checks = unknown_website("The website's robots.txt disallows this audit. No homepage was fetched.", url)
                return {"state": "robots_blocked", "url": url, "finalUrl": "", "message": "The website disallows automated inspection. The homepage was not fetched."}, checks
            # This test does not claim Googlebot access or actual indexing.
            robots_status = "allowed" if robot_parser.can_fetch("Googlebot", url) else "blocked_google"
        elif robots.status in (404, 410):
            robots_status = "allowed"
    except WebsiteFetchError:
        pass
    try:
        page = fetcher(url, deadline=deadline)
    except WebsiteFetchError as error:
        return {"state": "unavailable", "url": url, "finalUrl": "", "message": error.message}, unknown_website(error.message, url)
    if page.status in (401, 403, 429):
        reason = f"Homepage returned HTTP {page.status}; automated inspection may be blocked."
        return {"state": "blocked", "url": url, "finalUrl": page.url, "message": reason}, unknown_website(reason, page.url)
    if not 200 <= page.status < 300 or not any(mime in page.headers.get("content-type", "").lower() for mime in ("text/html", "application/xhtml+xml")):
        checks = unknown_website(f"Homepage returned HTTP {page.status}; usable HTML was not available.", page.url)
        if not 200 <= page.status < 300:
            checks[1].update(status="review", evidence=f"Homepage returned HTTP {page.status}.")
        return {"state": "unavailable", "url": url, "finalUrl": page.url, "message": "Usable homepage HTML was not returned."}, checks
    # A cross-host redirect can have its own robots rules, so do not infer its indexability.
    if urlsplit(page.url).hostname != parts.hostname:
        robots_status = "unavailable"
    return {"state": "checked", "url": url, "finalUrl": page.url, "message": "Homepage HTML and linked-host robots rules checked. JavaScript and link destinations were not executed."}, assess_html(page, robots_status)


def summarise(place, website, checks, *, example=False):
    assessed = [item for item in checks if item["status"] != "unknown"]
    earned = sum(item["weight"] for item in assessed if item["status"] == "pass")
    maximum = sum(item["weight"] for item in assessed)
    categories = []
    for key, label, weight in CATEGORIES:
        items = [item for item in checks if item["category"] == key]
        tested = [item for item in items if item["status"] != "unknown"]
        possible = sum(item["weight"] for item in tested)
        points = sum(item["weight"] for item in tested if item["status"] == "pass")
        categories.append({"key": key, "label": label, "score": round(points / possible * 100) if possible else None, "weight": weight, "assessedWeight": possible, "earnedWeight": points, "assessedChecks": len(tested), "totalChecks": len(items)})
    counts = {key: sum(item["status"] == key for item in checks) for key in ("pass", "review", "unknown")}
    website_issue = None
    if website.get("state") == "not_linked":
        website_issue = {"severity": "high", "title": "No website link found on your Google profile", "message": "Google did not return a website link. Customers may be missing a direct route to your services, booking information and contact options, which can cost website visits and enquiries.", "action": "Add your clinic’s website to Google Business Profile, or verify the existing link if one is already set."}
    elif website.get("state") == "unavailable":
        failed = next((item for item in checks if item["id"] == "available" and item["status"] == "review"), None)
        website_issue = {"severity": "high", "title": "Your linked homepage needs urgent review" if failed else "We couldn’t reach your linked website", "message": "The homepage returned an access error. Customers following the website link may reach a dead end instead of your clinic." if failed else "The website could not be verified from this check. If customers have the same problem, you may lose website visits and booking enquiries. This does not prove the website is down for everyone.", "action": "Open the website on another connection, check the homepage and HTTPS, and confirm that the link on Google is correct."}
    return {
        "version": RUBRIC_VERSION, "example": example, "checkedAt": datetime.now(timezone.utc).isoformat(), "profile": place, "website": website,
        "score": round(earned / maximum * 100) if maximum else None,
        "scoreLabel": "Google profile score" if not any(item["category"] != "google" for item in assessed) else "Partial reach readiness score" if counts["unknown"] else "Reach readiness score",
        "partial": counts["unknown"] > 0, "coverage": maximum,
        "websiteIssue": website_issue,
        "assessedChecks": len(assessed), "totalChecks": len(checks), "counts": counts, "categories": categories, "checks": checks,
        "priorities": sorted([item for item in checks if item["status"] == "review"], key=lambda item: -item["weight"])[:4],
        "methodology": "A weighted checklist of public profile fields (40%), website basics (20%), search signals (20%) and contact paths (20%). Unassessed checks are excluded; missing public fields lower the observed-profile score, but do not prove those details are absent from the business. This does not measure traffic, Google rank, revenue, accessibility compliance or completed bookings.",
    }


def build_report(place):
    website, checks = audit_website(place.get("website", ""))
    return summarise(place, website, google_checks(place) + checks)
