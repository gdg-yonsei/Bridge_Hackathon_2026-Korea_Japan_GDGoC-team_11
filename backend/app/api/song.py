"""Standalone song search / play endpoint.

Independent of the diary flow — given any free-form query, returns one
Spotify track with playable URLs. Frontend uses this for ad-hoc "play this
song" UX (search box, replay button, etc.).
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.core.dependencies import get_current_user
from app.core.rate_limit import limiter
from app.core.spotify_client import SpotifyError, search_track
from app.entity.user_entity import User
from app.models.diary import SongOut

router = APIRouter(prefix="/songs", tags=["songs"])


@router.get("/search", response_model=SongOut)
@limiter.limit("60/hour")
def search_song(
    request: Request,
    q: str = Query(..., min_length=1, max_length=200, description="Free-form search query."),
    _user: User = Depends(get_current_user),
) -> SongOut:
    """Resolve a search query to one Spotify track + preview URL.

    Prefers tracks that ship a `preview_url` so `expo-av` Audio.Sound can
    play in-app. Returns 404 if Spotify returns no hits; 502 if credentials
    are missing or the request fails.
    """
    try:
        track = search_track(q, prefer_with_preview=True)
    except SpotifyError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc

    if track is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No matching track")

    artists = track.get("artists") or []
    return SongOut(
        rank=1,
        title=track.get("name") or "",
        artist=", ".join(a.get("name", "") for a in artists) if artists else "",
        reason=None,
        preview_url=track.get("preview_url"),
        external_url=(track.get("external_urls") or {}).get("spotify"),
    )
