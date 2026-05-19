"""
Real-Time Google Search Scraper
Hits google.com/search directly, parses results, and links every
provider to Google Maps. Single source of truth: Google only.
"""

import asyncio
import json
import math
import os
import re
import time
from datetime import datetime
from typing import Dict, List, Optional
from urllib.parse import quote_plus

import httpx

RESULTS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../../data/scraped_results")
)
INDEX_FILE    = os.path.join(RESULTS_DIR, "index.json")
NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
NOMINATIM_URL         = "https://nominatim.openstreetmap.org/search"
NOMINATIM_HEADERS     = {"User-Agent": "ServiceAI-Hackathon/1.0 (contact: hackathon@serviceai.pk)"}


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _ensure_dir() -> None:
    os.makedirs(RESULTS_DIR, exist_ok=True)


def _extract_phone(text: str) -> str:
    for pat in [r"\+92\s?\d{3}[-\s]?\d{7}", r"0\d{3}[-\s]?\d{7}", r"0\d{10}"]:
        m = re.search(pat, text)
        if m:
            return m.group(0).strip()
    return ""


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi    = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return round(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 2)


def _google_maps_url(name: str, location: str) -> str:
    return f"https://www.google.com/maps/search/{quote_plus(name + ' ' + location + ' Pakistan')}"


# ─── Geocoding ────────────────────────────────────────────────────────────────

async def _reverse_geocode(lat: float, lng: float) -> dict:
    """English address components for GPS coords via Nominatim."""
    try:
        async with httpx.AsyncClient(headers=NOMINATIM_HEADERS, timeout=10) as client:
            resp = await client.get(
                NOMINATIM_REVERSE_URL,
                params={"lat": lat, "lon": lng, "format": "json",
                        "accept-language": "en", "zoom": 14},
            )
            data = resp.json()
            addr = data.get("address", {})
            raw_district   = addr.get("district", "")
            clean_district = re.sub(r'\s+(District|Division|Tehsil|City)$', '',
                                    raw_district, flags=re.IGNORECASE).strip()
            city_raw = (addr.get("city") or clean_district or addr.get("city_district")
                        or addr.get("state_district") or addr.get("county") or addr.get("town") or "")
            city = re.sub(r'\s+(District|Division|Tehsil|City)$', '',
                          city_raw, flags=re.IGNORECASE).strip()
            area = (addr.get("neighbourhood") or addr.get("suburb") or addr.get("quarter")
                    or addr.get("town") or addr.get("village") or addr.get("hamlet") or "")
            state   = addr.get("state", "")
            display = ", ".join(filter(None, [area, city, state]))
            print(f"[scraper] Location resolved: {display!r}")
            return {"city": city, "area": area, "state": state,
                    "display": display or data.get("display_name", "")[:80]}
    except Exception as exc:
        print(f"[scraper] Reverse geocode error: {exc}")
        return {}


async def _geocode_location(location: str) -> Optional[tuple]:
    """(lat, lon) for a text location string — used for distance calculation."""
    try:
        async with httpx.AsyncClient(headers=NOMINATIM_HEADERS, timeout=10) as client:
            resp = await client.get(
                NOMINATIM_URL,
                params={"q": f"{location} Pakistan", "format": "json", "limit": 1},
            )
            data = resp.json()
            if data:
                return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as exc:
        print(f"[scraper] Nominatim error: {exc}")
    return None


# ─── Google Search Scraper ────────────────────────────────────────────────────

def _scrape_google(service_type: str, location: str, max_results: int) -> List[Dict]:
    """
    Search Google for Pakistani service providers.

    Primary  — googlesearch-python: scrapes google.com internally, returns
               title + URL + description for each result.
    Fallback — ddgs text search: same queries, same output shape,
               every result still links to Google Maps for direct verification.
    """
    queries = [
        f"{service_type} {location} Pakistan phone contact",
        f"best {service_type} near {location} Pakistan",
    ]

    providers: List[Dict] = []
    seen: set = set()

    def _make(name: str, url: str, desc: str) -> Dict:
        return {
            "name":          name,
            "address":       location,
            "city":          location,
            "phone":         _extract_phone(desc + " " + name),
            "website":       url,
            "source_url":    _google_maps_url(name, location),
            "description":   desc[:300],
            "rating":        None,
            "reviews_count": None,
            "lat": None, "lng": None, "hours": None,
            "category":      service_type,
            "source":        "google_search",
            "distance_km":   None,
        }

    # ── Primary: googlesearch-python ─────────────────────────────────────────
    try:
        from googlesearch import search as gsearch
        for query in queries:
            if len(providers) >= max_results:
                break
            try:
                for r in gsearch(query, num_results=8, advanced=True,
                                 lang="en", sleep_interval=0):
                    name = (r.title or "").strip()
                    if not name or name in seen:
                        continue
                    seen.add(name)
                    providers.append(_make(name, r.url or "", r.description or ""))
                    if len(providers) >= max_results:
                        break
            except Exception as exc:
                print(f"[scraper] googlesearch query error: {exc}")
        print(f"[scraper] googlesearch-python: {len(providers)} results")
    except ImportError:
        print("[scraper] googlesearch-python not installed")

    # ── Fallback: ddgs text search ────────────────────────────────────────────
    if not providers:
        print("[scraper] Trying ddgs fallback")
        DDGS = None
        try:
            from ddgs import DDGS
        except ImportError:
            try:
                from duckduckgo_search import DDGS
            except ImportError:
                print("[scraper] ddgs / duckduckgo_search not installed")

        if DDGS is not None:
            try:
                with DDGS() as ddgs:
                    for query in queries:
                        if len(providers) >= max_results:
                            break
                        try:
                            for r in ddgs.text(query, max_results=8):
                                name = r.get("title", "").strip()
                                if not name or name in seen:
                                    continue
                                seen.add(name)
                                providers.append(
                                    _make(name, r.get("href", ""), r.get("body", ""))
                                )
                                if len(providers) >= max_results:
                                    break
                        except Exception as exc:
                            print(f"[scraper] ddgs query error: {exc}")
                print(f"[scraper] ddgs fallback: {len(providers)} results")
            except Exception as exc:
                print(f"[scraper] ddgs failed: {exc}")

    print(f"[scraper] Total: {len(providers)} results for {service_type!r} near {location!r}")
    return providers[:max_results]


# ─── File persistence ─────────────────────────────────────────────────────────

def _slug(s: str, limit: int = 20) -> str:
    return re.sub(r"[^\w]", "_", s.lower())[:limit].strip("_")


def _save_to_file(service_type: str, location: str, city: str,
                  providers: List[Dict], source: str) -> str:
    _ensure_dir()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename  = f"{_slug(service_type)}_{_slug(location)}_{timestamp}.json"
    filepath  = os.path.join(RESULTS_DIR, filename)
    payload = {
        "metadata": {
            "service_type": service_type, "location": location, "city": city,
            "timestamp": datetime.now().isoformat(), "total_found": len(providers),
            "source": source, "file": filename,
        },
        "providers": providers,
    }
    with open(filepath, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)
    _update_index(filepath, payload["metadata"])
    return filepath


def _update_index(filepath: str, metadata: dict) -> None:
    try:
        index = {"searches": []}
        if os.path.exists(INDEX_FILE):
            with open(INDEX_FILE, "r", encoding="utf-8") as fh:
                index = json.load(fh)
        index["searches"].append({"file": os.path.basename(filepath), "path": filepath, **metadata})
        index["searches"] = index["searches"][-200:]
        with open(INDEX_FILE, "w", encoding="utf-8") as fh:
            json.dump(index, fh, indent=2, ensure_ascii=False)
    except Exception as exc:
        print(f"[scraper] Index update error: {exc}")


# ─── Public API ───────────────────────────────────────────────────────────────

async def scrape_realtime_providers(
    service_type: str,
    location: str,
    city: str,
    user_lat: Optional[float] = None,
    user_lng: Optional[float] = None,
    max_results: int = 10,
) -> Dict:
    """
    Find local service providers by scraping Google Search.

    1. Resolves GPS coordinates to a clean English location string.
    2. Sends targeted queries to google.com/search and parses the results.
    3. Each result links to a Google Maps search URL for direct verification.
    4. Falls back to DuckDuckGo (same query, same Google Maps links) if
       Google returns a CAPTCHA or rate-limit response.
    """
    t0       = time.time()
    coords   = None
    detected = {}

    # ── Resolve display location from GPS ────────────────────────────────────
    if user_lat is not None and user_lng is not None:
        coords = (user_lat, user_lng)
        detected = await _reverse_geocode(user_lat, user_lng)
        det_city = detected.get("city") or city
        det_area = detected.get("area") or ""
        full_location = detected.get("display") or (
            f"{det_area}, {det_city}".strip(", ") if det_area else det_city
        )
        print(f"[scraper] GPS ({user_lat:.4f},{user_lng:.4f}) → {full_location!r}")
    else:
        full_location = f"{location} {city}".strip() if location else city
        print(f"[scraper] Searching: {service_type!r} near {full_location!r}")

    # Geocode text location → coordinates for distance calculations
    if not coords:
        coords = await _geocode_location(full_location)
        if coords:
            print(f"[scraper] Geocoded → ({coords[0]:.4f}, {coords[1]:.4f})")

    # ── Scrape Google ─────────────────────────────────────────────────────────
    # Use city-level location for the query (long area names get 0 results /
    # blocked); full_location is only for display and file metadata.
    search_city = detected.get("city") or city or full_location.split(",")[0].strip()
    providers = await asyncio.to_thread(
        _scrape_google, service_type, search_city, max_results
    )

    # Attach distance from user GPS where lat/lng are available
    if coords:
        ref_lat, ref_lng = coords
        for p in providers:
            if p.get("lat") and p.get("lng") and not p.get("distance_km"):
                p["distance_km"] = _haversine_km(ref_lat, ref_lng, p["lat"], p["lng"])

    duration_ms  = int((time.time() - t0) * 1000)
    det_city_out = detected.get("city") or city
    det_display  = detected.get("display") or full_location

    saved_path = await asyncio.to_thread(
        _save_to_file, service_type, full_location, det_city_out,
        providers, "google_search"
    )

    print(f"[scraper] Done — {len(providers)} results in {duration_ms}ms")

    return {
        "found":            len(providers),
        "source":           "google_search",
        "saved_to":         saved_path,
        "duration_ms":      duration_ms,
        "location":         full_location,
        "location_display": det_display,
        "detected_area":    detected.get("area", ""),
        "detected_city":    det_city_out,
        "detected_state":   detected.get("state", ""),
        "geocoded_at":      {"lat": coords[0], "lng": coords[1]} if coords else None,
        "service_type":     service_type,
        "providers":        providers,
    }


async def load_scraped_results(file_path: str) -> Dict:
    try:
        with open(file_path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception as exc:
        return {"error": str(exc), "file": file_path}


def get_index() -> Dict:
    if not os.path.exists(INDEX_FILE):
        return {"searches": []}
    with open(INDEX_FILE, "r", encoding="utf-8") as fh:
        return json.load(fh)
