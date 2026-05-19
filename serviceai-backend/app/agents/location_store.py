"""
In-memory store for the user's most-recently-reported live location.
Updated automatically by every scrape or SSE stream request that carries GPS coords.
"""

from datetime import datetime
from typing import Optional, Dict

_location: Dict = {}


def set_location(
    lat: float,
    lng: float,
    city: str = "",
    area: str = "",
    state: str = "",
    display: str = "",
) -> None:
    global _location
    _location = {
        "lat":        lat,
        "lng":        lng,
        "city":       city,
        "area":       area,
        "state":      state,
        "display":    display or ", ".join(filter(None, [area, city, state])),
        "updated_at": datetime.now().isoformat(),
    }
    print(f"[location_store] Stored: ({lat:.5f}, {lng:.5f}) → {_location['display']!r}")


def get_location() -> Optional[Dict]:
    """Returns the stored location dict, or None if no location has been set yet."""
    return _location if _location else None


def clear_location() -> None:
    global _location
    _location = {}
