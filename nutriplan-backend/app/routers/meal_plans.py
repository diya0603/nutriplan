
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas, auth
from app.database import get_db
from app.agents.meal_planner import generate_meal_plan

router = APIRouter(prefix="/meal-plans", tags=["meal-plans"])


@router.post("/generate", response_model=schemas.MealPlanOut, status_code=status.HTTP_201_CREATED)
def generate_plan(
    payload: schemas.GeneratePlanRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.preferences is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Complete onboarding before generating a meal plan.",
        )

    llm_plan = generate_meal_plan(current_user.preferences, days=payload.days)

    meal_plan = models.MealPlan(user_id=current_user.id, status="active")
    db.add(meal_plan)
    db.flush()  # get meal_plan.id before we attach meals to it

    for day in llm_plan.days:
        for llm_meal in day.meals:
            meal = models.Meal(
                meal_plan_id=meal_plan.id,
                day_of_week=day.day_of_week,
                meal_type=llm_meal.meal_type,
                recipe_name=llm_meal.recipe_name,
                recipe_instructions=llm_meal.recipe_instructions,
                prep_time_minutes=llm_meal.prep_time_minutes,
                cook_time_minutes=llm_meal.cook_time_minutes,
            )
            db.add(meal)
            db.flush()  # get meal.id before attaching ingredients/nutrition

            for ing in llm_meal.ingredients:
                db.add(models.MealIngredient(
                    meal_id=meal.id,
                    ingredient_name=ing.ingredient_name,
                    quantity=ing.quantity,
                    unit=ing.unit,
                    category=ing.category,
                ))

            db.add(models.MealNutrition(
                meal_id=meal.id,
                calories=llm_meal.nutrition.calories,
                protein_g=llm_meal.nutrition.protein_g,
                carbs_g=llm_meal.nutrition.carbs_g,
                fat_g=llm_meal.nutrition.fat_g,
                fiber_g=llm_meal.nutrition.fiber_g,
            ))

    db.commit()
    db.refresh(meal_plan)
    return meal_plan


@router.get("/current", response_model=schemas.MealPlanOut)
def get_current_plan(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    plan = (
        db.query(models.MealPlan)
        .filter(models.MealPlan.user_id == current_user.id, models.MealPlan.status == "active")
        .order_by(models.MealPlan.created_at.desc())
        .first()
    )
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active meal plan found")
    return plan