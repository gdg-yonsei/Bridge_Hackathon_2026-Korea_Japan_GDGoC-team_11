from pydantic import BaseModel, ConfigDict


class SongRecOut(BaseModel):
    rank: int
    title: str
    artist: str
    reason: str | None = None
    external_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class SongRecCreate(BaseModel):
    """Used when a service node creates a song recommendation."""

    rank: int
    title: str
    artist: str
    reason: str | None = None
    external_url: str | None = None
