from fastapi import APIRouter, Depends
from app import models, schemas, auth

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=schemas.MeOut)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user