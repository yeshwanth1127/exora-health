"""On-demand Places discovery observations. No simulated prominence, SERP claims,
stored provider content, pagination, background scans, or per-competitor details.
Cities are data; provider observations have an explicit source and status.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import math
from pathlib import Path
from lookup_errors import LookupError

CITIES = json.loads(Path(__file__).with_name("rank_cities.json").read_text())
DEPTH = 20
# Pro fields only: adding rating/hours/website here changes the SKU and free cap.
SEARCH_FIELDS = "places.id,places.displayName,places.location,places.googleMapsUri,places.businessStatus,places.attributions"
HEALTH_QUERIES = {"hospital": "hospitals near me", "dental_clinic": "dental clinics near me", "dentist": "dentists near me", "physiotherapist": "physiotherapy clinics near me", "doctor": "doctors near me", "medical_clinic": "medical clinics near me"}


def city_for(place):
    # Location presence is validated, but the city is selected from the returned
    # public address, not inferred from a polygon or manufactured city-wide rank.
    address = place.get("address", "").casefold()
    return next((key for key, city in CITIES.items() if any(alias.casefold() in address for alias in city["aliases"])), None)


def keyword_for(place):
    primary = place.get("primaryType", "")
    if primary in HEALTH_QUERIES:
        return HEALTH_QUERIES[primary]
    types = set(place.get("types", []))
    return next((query for kind, query in HEALTH_QUERIES.items() if kind in types), None)


def observation(point, query, city, request):
    result = {**point, "status": "unavailable", "results": [], "error": None}
    try:
        response = request("places:searchText", SEARCH_FIELDS, {
            "textQuery": query, "languageCode": city["language"], "regionCode": city["country"],
            "pageSize": DEPTH, "rankPreference": "RELEVANCE",
            "locationBias": {"circle": {"center": {"latitude": point["latitude"], "longitude": point["longitude"]}, "radius": city["radiusMetres"]}},
        })
        seen = set()
        for index, place in enumerate(response.get("places", [])[:DEPTH]):
            pid = place.get("id")
            if not pid or pid in seen:
                continue
            seen.add(pid)
            # Keep Google's original position; never rerank by rating or name.
            result["results"].append({"id": pid, "name": place.get("displayName", {}).get("text", "Business name unavailable"), "position": index + 1,
                                       "mapsUrl": place.get("googleMapsUri", ""), "attributions": place.get("attributions", [])})
        result.update(status="checked", checkedAt=datetime.now(timezone.utc).isoformat())
    except LookupError as error:
        result["error"] = {"code": error.code, "message": error.message}
    return result


def leaderboard(points, target_id):
    checked = [point for point in points if point["status"] == "checked"]
    businesses = {}
    for point in checked:
        for item in point["results"]:
            businesses.setdefault(item["id"], item)
    board = []
    for pid, business in businesses.items():
        ranks = [next((item["position"] for item in point["results"] if item["id"] == pid), None) for point in checked]
        found = [rank for rank in ranks if rank is not None]
        board.append({"id": pid, "name": business["name"], "mapsUrl": business["mapsUrl"], "found": len(found),
                      "top3": sum(rank <= 3 for rank in found), "top3Share": round(sum(rank <= 3 for rank in found) / len(checked) * 100),
                      "averagePosition": round(sum(found) / len(found), 1),
                      # Missing observations are excluded; checked-but-not-found
                      # gets depth+1 so a single good result cannot dominate.
                      "visibility": round(sum((DEPTH + 1 - rank) / DEPTH if rank is not None else 0 for rank in ranks) / len(checked) * 100, 1),
                      "target": pid == target_id})
    return sorted(board, key=lambda item: (-item["visibility"], -item["top3Share"], item["id"]))


def nearby_points(place, city):
    """Use the selected business origin, with a stable ID tie-breaker."""
    location = place.get("location") or {}
    lat, lng = location.get("latitude"), location.get("longitude")
    if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)) or not math.isfinite(lat) or not math.isfinite(lng):
        return city["points"], False
    factor = math.cos(math.radians(lat))
    points = [{**point, "distanceKm": round(111.32 * math.hypot(point["latitude"] - lat, (point["longitude"] - lng) * factor), 3)} for point in city["points"]]
    return sorted(points, key=lambda point: (point["distanceKm"], point["id"])), True


def scan(place, request):
    city_id, query = city_for(place), keyword_for(place)
    base = {"category": next((kind for kind, value in HEALTH_QUERIES.items() if value == query), None), "provider": "google_places", "measurement": "Places API discovery positions", "depth": DEPTH,
            "checkedAt": datetime.now(timezone.utc).isoformat(), "targetId": place.get("id"), "points": [], "leaderboard": [],
            "methodology": "Observed relevance order from Google Places Text Search, first 20 results, English, India, 5 km location bias. The bias is not a hard boundary. This is not a consumer Google Maps rank, a city-wide rank, traffic or clinical quality. Unavailable points are excluded; absent means not returned in this observation. Visibility averages (21-position)/20 over checked points, assigning zero when absent. Average position uses appearances only."}
    if not city_id or not query:
        return {**base, "status": "unsupported", "message": "Area comparisons currently support healthcare businesses with a Bengaluru or Bangalore public address. More cities can be added through the city configuration."}
    city = CITIES[city_id]
    ordered, nearby = nearby_points(place, city)
    selected = ordered[:len(city["initialAreas"])] if nearby else [point for point in ordered if point["id"] in city["initialAreas"]]
    by_id = {point["id"]: point for point in ordered}
    with ThreadPoolExecutor(max_workers=3) as pool:
        observed = {point["id"]: point for point in pool.map(lambda point: observation(point, query, city, request), selected)}
    points = [observed.get(point["id"], {**by_id[point["id"]], "status": "not_checked", "results": [], "error": None}) for point in city["points"]]
    for point in points:
        match = next((item for item in point["results"] if item["id"] == place.get("id")), None)
        point["targetPosition"] = match["position"] if match else None
        point["resultsAbove"] = match["position"] - 1 if match else None
    checked = sum(point["status"] == "checked" for point in points)
    return {**base, "city": city_id, "cityName": city["name"], "query": query, "points": points,
            "leaderboard": leaderboard(points, place.get("id")), "checkedPoints": checked, "totalPoints": len(points),
            "sampleDescription": "Initial searches use the nine nearest configured neighbourhood origins to this business." if nearby else "Initial searches use nine city sample origins because the business coordinates were unavailable.",
            "status": "sampled" if checked == len(selected) else "partial" if checked else "unavailable",
            "message": f"{checked} of {len(points)} neighbourhood locations checked. Unchecked areas have no rank; select one to check it."}


def scan_areas(city_id, category, area_ids, request):
    city = CITIES.get(city_id)
    query = HEALTH_QUERIES.get(category)
    if not city or not query or not area_ids or len(area_ids) > 120 or len(set(area_ids)) != len(area_ids):
        raise LookupError("INVALID_SCAN", "Choose a supported city, clinic category and neighbourhood.", 400)
    points = {point["id"]: point for point in city["points"]}
    if any(area not in points for area in area_ids):
        raise LookupError("INVALID_SCAN", "Choose a neighbourhood from this city.", 400)
    with ThreadPoolExecutor(max_workers=3) as pool:
        return list(pool.map(lambda area: observation(points[area], query, city, request), area_ids))
