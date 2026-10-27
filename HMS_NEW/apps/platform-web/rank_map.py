"""Google base map for live Places observations; key stays on the server.

The map is returned for this response only, never cached or written to disk.
The client overlays observations on Google's map, preserving its attribution.
"""
import base64
import math
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen
from lookup_errors import LookupError
from maps_budget import reserve


def world(lat, lng):
    sine = math.sin(math.radians(max(-85, min(85, lat))))
    return (lng + 180) / 360, .5 - math.log((1 + sine) / (1 - sine)) / (4 * math.pi)


def map_frame(points):
    coordinates = [world(point["latitude"], point["longitude"]) for point in points]
    minx, maxx = min(x for x, _ in coordinates), max(x for x, _ in coordinates)
    miny, maxy = min(y for _, y in coordinates), max(y for _, y in coordinates)
    cx, cy = (minx + maxx) / 2, (miny + maxy) / 2
    width, height = 640, 640
    zoom = min(14, math.floor(math.log2(min((width - 48) / (maxx - minx or .00001), (height - 48) / (maxy - miny or .00001)) / 256)))
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * cy))))
    lng = cx * 360 - 180
    return {"center": {"latitude": lat, "longitude": lng}, "zoom": zoom, "width": width, "height": height}


def render_map(points, key):
    frame = map_frame(points)
    lat, lng = frame["center"]["latitude"], frame["center"]["longitude"]
    reserve("map")
    url = "https://maps.googleapis.com/maps/api/staticmap?" + urlencode({"center": f"{lat},{lng}", "zoom": frame["zoom"], "size": f"{frame['width']}x{frame['height']}", "scale": 2, "maptype": "roadmap", "language": "en", "region": "IN", "style": ["feature:poi|visibility:off", "feature:transit|visibility:off", "feature:road|element:labels|visibility:off", "feature:all|saturation:-80"], "key": key}, doseq=True)
    try:
        with urlopen(url, timeout=10) as response:
            data = response.read(2 * 1024 * 1024 + 1)
            if not data.startswith(b"\x89PNG\r\n\x1a\n") or len(data) > 2 * 1024 * 1024:
                raise LookupError("MAP_UNAVAILABLE", "The Google map image could not be loaded.")
    except (HTTPError, URLError, TimeoutError):
        raise LookupError("MAP_UNAVAILABLE", "The Google map is unavailable. Observed positions are still listed below.") from None
    return {"image": "data:image/png;base64," + base64.b64encode(data).decode(), **frame}
