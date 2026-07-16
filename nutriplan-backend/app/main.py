# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import auth_routes, users, preferences, meal_plans

Base.metadata.create_all(bind=engine)

app = FastAPI(title="NutriPlan API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(users.router)
app.include_router(preferences.router)
app.include_router(meal_plans.router)


@app.get("/health")
def health():
    return {"status": "ok"}