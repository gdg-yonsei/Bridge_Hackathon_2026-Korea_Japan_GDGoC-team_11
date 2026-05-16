from sqlalchemy import delete, select

from app.entity.song_recommendation_entity import SongRecommendation
from app.repository.base_repo import BaseRepository


class SongRepository(BaseRepository[SongRecommendation]):
    model = SongRecommendation

    def list_by_entry(self, entry_id: int) -> list[SongRecommendation]:
        stmt = (
            select(SongRecommendation)
            .where(SongRecommendation.entry_id == entry_id)
            .order_by(SongRecommendation.rank)
        )
        return list(self.session.scalars(stmt).all())

    def replace_for_entry(
        self, entry_id: int, songs: list[SongRecommendation]
    ) -> list[SongRecommendation]:
        """해당 entry의 기존 추천을 모두 지우고 새 리스트로 교체."""
        self.session.execute(
            delete(SongRecommendation).where(SongRecommendation.entry_id == entry_id)
        )
        for song in songs:
            song.entry_id = entry_id
            self.session.add(song)
        self.session.flush()
        return songs
