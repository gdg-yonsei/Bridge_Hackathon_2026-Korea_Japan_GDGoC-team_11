"""Spotify Web API client — Client Credentials Flow.

App-level credentials only (no user OAuth). Issues a short-lived access token
that's cached in-process until ~1 minute before expiry, then refreshed under
a lock so concurrent callers don't all hit accounts.spotify.com at once.
"""

from __future__ import annotations

import logging
import time
from threading import Lock
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_TOKEN_URL = "https://accounts.spotify.com/api/token"
_API_BASE = "https://api.spotify.com/v1"
_REFRESH_MARGIN = 60.0  # seconds before expiry to refresh proactively

_token: str | None = None
_token_expires_at: float = 0.0
_lock = Lock()


class SpotifyError(RuntimeError):
    """Raised when Spotify rejects our request or credentials are missing."""


def _fetch_token() -> str:
    """Exchange client credentials for an app token. Caller holds `_lock`."""
    if not (settings.spotify_client_id and settings.spotify_client_secret):
        raise SpotifyError(
            "SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are empty. "
            "Get them at https://developer.spotify.com/dashboard"
        )
    global _token, _token_expires_at
    response = httpx.post(
        _TOKEN_URL,
        data={"grant_type": "client_credentials"},
        auth=(settings.spotify_client_id, settings.spotify_client_secret),
        timeout=10.0,
    )
    response.raise_for_status()
    payload = response.json()
    _token = payload["access_token"]
    _token_expires_at = time.monotonic() + float(payload.get("expires_in", 3600))
    logger.info("Spotify token refreshed (expires in %ss)", payload.get("expires_in"))
    return _token  # type: ignore[return-value]


def _access_token() -> str:
    """Return a valid token, refreshing in the background as needed."""
    with _lock:
        if _token is None or time.monotonic() >= _token_expires_at - _REFRESH_MARGIN:
            return _fetch_token()
        return _token


def search_track(query: str, *, prefer_with_preview: bool = True) -> dict[str, Any] | None:
    """Return one Spotify track best matching `query`, or None on miss.

    When `prefer_with_preview` is true, scans up to the first 5 results and
    returns the first one that has a `preview_url`; falls back to the top
    result if none do (so the caller still gets *something* to deep-link to).
    """
    token = _access_token()
    try:
        response = httpx.get(
            f"{_API_BASE}/search",
            params={"q": query, "type": "track", "limit": 5},
            headers={"Authorization": f"Bearer {token}"},
            timeout=10.0,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("Spotify search failed for %r: %s", query, exc)
        return None

    items = response.json().get("tracks", {}).get("items", []) or []
    if not items:
        return None

    if prefer_with_preview:
        for item in items:
            if item.get("preview_url"):
                return item
    return items[0]


def to_song_dict(track: dict[str, Any], reason: str | None = None) -> dict[str, Any]:
    """Project a raw Spotify track into our `SongOut`-shaped dict."""
    artists = track.get("artists") or []
    return {
        "title": track.get("name") or "",
        "artist": ", ".join(a.get("name", "") for a in artists) if artists else "",
        "reason": reason,
        "preview_url": track.get("preview_url"),
        "external_url": (track.get("external_urls") or {}).get("spotify"),
    }
