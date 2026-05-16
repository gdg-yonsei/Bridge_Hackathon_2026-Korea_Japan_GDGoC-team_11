from pydantic import BaseModel, ConfigDict


class SongRecOut(BaseModel):
    rank: int
    title: str
    artist: str
    reason: str | None = None
    external_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class SongRecCreate(BaseModel):
    """LangGraph 노드가 추천 결과를 만들 때 사용."""

    rank: int
    title: str
    artist: str
    reason: str | None = None
    external_url: str | None = None
