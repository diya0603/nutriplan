
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas, auth
from app.database import get_db

router = APIRouter(prefix="/preferences", tags=["preferences"])


@router.post("/", response_model=schemas.PreferencesSchema, status_code=status.HTTP_201_CREATED)
def create_preferences(
    payload: schemas.PreferencesSchema,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.preferences is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Preferences already exist. Use PUT to update them.",
        )

    prefs = models.UserPreferences(
        user_id=current_user.id,
        **payload.model_dump(),
    )
    db.add(prefs)
    db.commit()
    db.refresh(prefs)
    return prefs


@router.put("/", response_model=schemas.PreferencesSchema)
def update_preferences(
    payload: schemas.PreferencesUpdateSchema,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.preferences is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No preferences found. Use POST to create them first.",
        )

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(current_user.preferences, field, value)

    db.commit()
    db.refresh(current_user.preferences)
    return current_user.preferences