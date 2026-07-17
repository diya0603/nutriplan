from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    preferences = relationship("UserPreferences", back_populates="user", uselist=False)
    meal_plans = relationship("MealPlan", back_populates="user")
    pantry_items = relationship("Pantry", back_populates="user")
    conversations = relationship("Conversation", back_populates="user")


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    height_cm = Column(Float, nullable=False)
    weight_kg = Column(Float, nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String, nullable=False)
    goal = Column(String, nullable=False)
    activity_level = Column(String, nullable=False)

    dietary_restrictions = Column(ARRAY(String), default=list)
    allergies = Column(ARRAY(String), default=list)
    cuisine_preferences = Column(ARRAY(String), default=list)

    meals_per_day = Column(Integer, default=3)
    selected_meal_types = Column(ARRAY(String), nullable=True)
    include_snacks = Column(Boolean, default=False)
    max_cooking_time_minutes = Column(Integer, default=30)
    budget_weekly_usd = Column(Float)

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="preferences")

class MealPlan(Base):
    __tablename__ = "meal_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    week_start_date = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String, default="active")  # active | archived
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="meal_plans")
    meals = relationship("Meal", back_populates="meal_plan", cascade="all, delete-orphan")

class Meal(Base):
    __tablename__ = "meals"

    id = Column(Integer, primary_key=True, index=True)
    meal_plan_id = Column(Integer, ForeignKey("meal_plans.id"), nullable=False)

    day_of_week = Column(String, nullable=False)
    meal_type = Column(String, nullable=False)

    recipe_name = Column(String, nullable=False)
    recipe_instructions = Column(String)
    prep_time_minutes = Column(Integer)
    cook_time_minutes = Column(Integer)
    #servings = Column(Integer, default=1)

    meal_plan = relationship("MealPlan", back_populates="meals")
    ingredients = relationship("MealIngredient", back_populates="meal", cascade="all, delete-orphan")
    nutrition = relationship("MealNutrition", back_populates="meal", uselist=False, cascade="all, delete-orphan")

class MealIngredient(Base):
    __tablename__ = "meal_ingredients"

    id = Column(Integer, primary_key=True, index=True)
    meal_id = Column(Integer, ForeignKey("meals.id"), nullable=False)

    ingredient_name = Column(String, nullable=False)
    quantity = Column(Float)
    unit = Column(String)
    category = Column(String)  # produce | dairy | protein | pantry | frozen | other

    meal = relationship("Meal", back_populates="ingredients")

class MealNutrition(Base):
    __tablename__ = "meal_nutrition"

    id = Column(Integer, primary_key=True, index=True)
    meal_id = Column(Integer, ForeignKey("meals.id"), unique=True, nullable=False)

    calories = Column(Float)
    protein_g = Column(Float)
    carbs_g = Column(Float)
    fat_g = Column(Float)
    fiber_g = Column(Float)

    meal = relationship("Meal", back_populates="nutrition")


class Pantry(Base):
    __tablename__ = "pantry"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    ingredient_name = Column(String, nullable=False)
    quantity = Column(Float, nullable=True)   # null = "I have this, don't track amount"
    unit = Column(String, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="pantry_items")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    conversation = relationship("Conversation", back_populates="messages")