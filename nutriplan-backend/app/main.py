# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.requests import Request
import logging

from app.database import Base, engine
from app.routers import auth_routes, users, preferences, meal_plans, pantry, chat

Base.metadata.create_all(bind=engine)

app = FastAPI(title="NutriPlan API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger = logging.getLogger("uvicorn.error")
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error on {request.method} {request.url.path}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong. Please try again."},
    )

app.include_router(auth_routes.router)
app.include_router(users.router)
app.include_router(preferences.router)
app.include_router(meal_plans.router)
app.include_router(pantry.router)
app.include_router(chat.router)

@app.get("/health")
def health():
    return {"status": "ok"}