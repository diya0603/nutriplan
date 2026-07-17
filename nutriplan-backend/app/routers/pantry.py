from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app import models, schemas, auth
from app.database import get_db

router = APIRouter(prefix="/pantry", tags=["pantry"])


@router.get("/", response_model=List[schemas.PantryItemOut])
def list_pantry(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.Pantry)
        .filter(models.Pantry.user_id == current_user.id)
        .all()
    )


@router.post("/", response_model=schemas.PantryItemOut)
def upsert_pantry_item(
    payload: schemas.PantryItemSchema,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    existing = (
        db.query(models.Pantry)
        .filter(
            models.Pantry.user_id == current_user.id,
            models.Pantry.ingredient_name == payload.ingredient_name,
            models.Pantry.unit == payload.unit,
        )
        .first()
    )

    if existing:
        existing.quantity = payload.quantity
        db.commit()
        db.refresh(existing)
        return existing

    item = models.Pantry(
        user_id=current_user.id,
        ingredient_name=payload.ingredient_name,
        quantity=payload.quantity,
        unit=payload.unit,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pantry_item(
    item_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    item = (
        db.query(models.Pantry)
        .filter(models.Pantry.id == item_id, models.Pantry.user_id == current_user.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pantry item not found")

    db.delete(item)
    db.commit()