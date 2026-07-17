from pydantic import BaseModel, EmailStr, model_validator
from typing import List, Optional, Literal
from typing import Optional
from datetime import datetime


class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    confirm_password: str

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr

    class Config:
        from_attributes = True

class PreferencesSchema(BaseModel):
    height_cm: float
    weight_kg: float
    age: int
    gender: Literal["male", "female", "prefer_not_to_answer"]
    goal: Literal["lose", "gain", "maintain", "bulk_up"]
    activity_level: Literal["sedentary", "light", "moderate", "active"]

    dietary_restrictions: List[str] = []
    allergies: List[str] = []
    cuisine_preferences: List[str] = []

    meals_per_day: int = 3
    selected_meal_types: Optional[List[str]] = None
    include_snacks: bool = False
    max_cooking_time_minutes: int = 30
    budget_weekly_usd: Optional[float] = None

    class Config:
        from_attributes = True

class PreferencesUpdateSchema(BaseModel):
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    age: Optional[int] = None
    gender: Optional[Literal["male", "female", "prefer_not_to_answer"]] = None
    goal: Optional[Literal["lose", "gain", "maintain", "bulk_up"]] = None
    activity_level: Optional[Literal["sedentary", "light", "moderate", "active"]] = None

    dietary_restrictions: Optional[List[str]] = None
    allergies: Optional[List[str]] = None
    cuisine_preferences: Optional[List[str]] = None

    meals_per_day: Optional[int] = None
    selected_meal_types: Optional[List[str]] = None
    include_snacks: Optional[bool] = None
    max_cooking_time_minutes: Optional[int] = None
    budget_weekly_usd: Optional[float] = None


class MeOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    preferences: Optional[PreferencesSchema] = None

    class Config:
        from_attributes = True


class IngredientOut(BaseModel):
    ingredient_name: str
    quantity: Optional[float] = None
    unit: Optional[str] = None
    category: Optional[str] = None

    class Config:
        from_attributes = True


class NutritionOut(BaseModel):
    calories: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    fiber_g: Optional[float] = None

    class Config:
        from_attributes = True


class MealOut(BaseModel):
    id: int
    day_of_week: str
    meal_type: str
    recipe_name: str
    recipe_instructions: Optional[str] = None
    prep_time_minutes: Optional[int] = None
    cook_time_minutes: Optional[int] = None
    #servings: Optional[int] = None
    ingredients: List[IngredientOut] = []
    nutrition: Optional[NutritionOut] = None

    class Config:
        from_attributes = True


class MealPlanOut(BaseModel):
    id: int
    status: str
    week_start_date: Optional[datetime] = None
    meals: List[MealOut] = []

    class Config:
        from_attributes = True


class GeneratePlanRequest(BaseModel):
    days: int = 7


class PantryItemSchema(BaseModel):
    ingredient_name: str
    quantity: Optional[float] = None
    unit: Optional[str] = None

    class Config:
        from_attributes = True


class PantryItemOut(BaseModel):
    id: int
    ingredient_name: str
    quantity: Optional[float] = None
    unit: Optional[str] = None

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    message: str


class ChatMessageOut(BaseModel):
    role: str
    content: str

    class Config:
        from_attributes = True


class ChatResponse(BaseModel):
    reply: str
    action_taken: Optional[str] = None  # e.g. "swapped Monday dinner", None if just a question