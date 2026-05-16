from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.entity.diary_entry_entity import DiaryEntry, DiaryStatus
from app.entity.user_entity import User
from app.models.diary import (
    DiaryAccepted,
    DiaryCreate,
    DiaryDetail,
    DiaryListItem,
    DiaryUpdate,
)
from app.repository.diary_repo import DiaryRepository
from app.services.diary_analysis_service import trigger_analysis

router = APIRouter()


@router.post("", response_model=DiaryAccepted, status_code=status.HTTP_202_ACCEPTED)
def create_diary(
    payload: DiaryCreate,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DiaryAccepted:
    repo = DiaryRepository(db)
    if repo.get_by_user_and_date(user.id, payload.entry_date) is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Diary entry already exists for this date",
        )

    entry = DiaryEntry(
        user_id=user.id,
        entry_date=payload.entry_date,
        title=payload.title,
        content=payload.content,
        status=DiaryStatus.pending,
    )
    repo.add(entry)
    db.commit()
    db.refresh(entry)

    background.add_task(trigger_analysis, entry.id)
    return DiaryAccepted(
        entry_id=entry.id,
        entry_date=entry.entry_date,
        status=entry.status,
    )


@router.get("", response_model=list[DiaryListItem])
def list_diary(
    year: int = Query(..., ge=2020, le=2100),
    month: int = Query(..., ge=1, le=12),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DiaryListItem]:
    entries = DiaryRepository(db).list_by_month(user.id, year, month)
    return [
        DiaryListItem(
            entry_id=e.id,
            entry_date=e.entry_date,
            primary_emotion=e.analysis.primary_emotion if e.analysis else None,
            status=e.status,
        )
        for e in entries
    ]


@router.get("/{entry_id}", response_model=DiaryDetail)
def get_diary(
    entry_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DiaryEntry:
    entry = DiaryRepository(db).get_with_relations(entry_id)
    if entry is None or entry.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Diary not found")
    return entry


@router.put("/{entry_id}", response_model=DiaryAccepted)
def update_diary(
    entry_id: int,
    payload: DiaryUpdate,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DiaryAccepted:
    repo = DiaryRepository(db)
    entry = repo.get(entry_id)
    if entry is None or entry.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Diary not found")

    if payload.title is not None:
        entry.title = payload.title

    content_changed = payload.content is not None
    if content_changed:
        entry.content = payload.content  # type: ignore[assignment]
        entry.status = DiaryStatus.pending

    db.commit()
    db.refresh(entry)

    if content_changed:
        background.add_task(trigger_analysis, entry.id)

    return DiaryAccepted(
        entry_id=entry.id,
        entry_date=entry.entry_date,
        status=entry.status,
    )


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_diary(
    entry_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    repo = DiaryRepository(db)
    entry = repo.get(entry_id)
    if entry is None or entry.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Diary not found")
    repo.delete(entry)
    db.commit()


@router.post(
    "/{entry_id}/reanalyze",
    response_model=DiaryAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
def reanalyze_diary(
    entry_id: int,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DiaryAccepted:
    repo = DiaryRepository(db)
    entry = repo.get(entry_id)
    if entry is None or entry.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Diary not found")

    repo.set_status(entry, DiaryStatus.pending)
    db.commit()

    background.add_task(trigger_analysis, entry.id)
    return DiaryAccepted(
        entry_id=entry.id,
        entry_date=entry.entry_date,
        status=DiaryStatus.pending,
    )
