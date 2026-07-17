# app/routers/chat.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas, auth
from app.database import get_db
from app.agents.chat_agent import classify_intent, answer_question, substitute_ingredient, swap_meal
from app.agents.meal_planner import validate_single_meal

router = APIRouter(prefix="/chat", tags=["chat"])


def _get_active_plan(db: Session, user_id: int) -> models.MealPlan:
    plan = (
        db.query(models.MealPlan)
        .filter(models.MealPlan.user_id == user_id, models.MealPlan.status == "active")
        .order_by(models.MealPlan.created_at.desc())
        .first()
    )
    if plan is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active meal plan to chat about")
    return plan


def _build_plan_summary(plan: models.MealPlan) -> str:
    lines = []
    for meal in plan.meals:
        ingredients = ", ".join(i.ingredient_name for i in meal.ingredients)
        cal = round(meal.nutrition.calories) if meal.nutrition else "?"
        lines.append(f"{meal.day_of_week} {meal.meal_type}: {meal.recipe_name} ({cal} cal) — {ingredients}")
    return "\n".join(lines)


def _get_or_create_conversation(db: Session, user_id: int) -> models.Conversation:
    convo = (
        db.query(models.Conversation)
        .filter(models.Conversation.user_id == user_id)
        .order_by(models.Conversation.created_at.desc())
        .first()
    )
    if convo is None:
        convo = models.Conversation(user_id=user_id)
        db.add(convo)
        db.flush()
    return convo


def _save_message(db: Session, conversation_id: int, role: str, content: str):
    db.add(models.Message(conversation_id=conversation_id, role=role, content=content))


@router.get("/history", response_model=list[schemas.ChatMessageOut])
def get_history(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    convo = _get_or_create_conversation(db, current_user.id)
    db.commit()
    return convo.messages


@router.post("/", response_model=schemas.ChatResponse)
def chat(
    payload: schemas.ChatRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.preferences is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Complete onboarding first")

    plan = _get_active_plan(db, current_user.id)
    convo = _get_or_create_conversation(db, current_user.id)
    _save_message(db, convo.id, "user", payload.message)

    plan_summary = _build_plan_summary(plan)
    result = classify_intent(payload.message, plan_summary)

    # Step 1: the LLM itself flagged genuine uncertainty
    if result.needs_clarification:
        reply = result.clarification_question or "Could you clarify what you'd like me to do?"
        _save_message(db, convo.id, "assistant", reply)
        db.commit()
        return schemas.ChatResponse(reply=reply, action_taken=None)

    # Step 2: plain question, no DB change
    if result.intent == "question":
        reply = answer_question(payload.message, plan_summary)
        _save_message(db, convo.id, "assistant", reply)
        db.commit()
        return schemas.ChatResponse(reply=reply, action_taken=None)

    # Step 3: ingredient substitution
    if result.intent == "substitute_ingredient":
        if not result.ingredient_name:
            reply = "Which ingredient would you like to replace?"
            _save_message(db, convo.id, "assistant", reply)
            db.commit()
            return schemas.ChatResponse(reply=reply, action_taken=None)

        matches = [
            meal for meal in plan.meals
            if any(result.ingredient_name.lower() in ing.ingredient_name.lower() for ing in meal.ingredients)
        ]

        if not matches:
            reply = f"I don't see {result.ingredient_name} in any of your current meals."
            _save_message(db, convo.id, "assistant", reply)
            db.commit()
            return schemas.ChatResponse(reply=reply, action_taken=None)

        if len(matches) > 1 and result.scope == "unspecified":
            options = ", ".join(f"{m.day_of_week} {m.meal_type}" for m in matches)
            reply = (
                f"You have {result.ingredient_name} in: {options}. "
                f"Should I replace it in one of these, or all of them?"
            )
            _save_message(db, convo.id, "assistant", reply)
            db.commit()
            return schemas.ChatResponse(reply=reply, action_taken=None)

        if result.scope == "specific_meal" and result.day_of_week and result.meal_type:
            matches = [
                m for m in matches
                if m.day_of_week == result.day_of_week and m.meal_type == result.meal_type
            ]
            if not matches:
                reply = f"I couldn't find {result.ingredient_name} in {result.day_of_week} {result.meal_type}."
                _save_message(db, convo.id, "assistant", reply)
                db.commit()
                return schemas.ChatResponse(reply=reply, action_taken=None)

        # at this point: either exactly one match, or scope == "all_meals" with multiple
        changed_meals = []
        for meal in matches:
            sub = substitute_ingredient(meal, result.ingredient_name, current_user.preferences)
            old_ing = next(
                (i for i in meal.ingredients if result.ingredient_name.lower() in i.ingredient_name.lower()),
                None,
            )
            if old_ing:
                old_ing.ingredient_name = sub.new_ingredient_name
                old_ing.quantity = sub.quantity
                old_ing.unit = sub.unit
            meal.recipe_instructions = sub.updated_instructions
            changed_meals.append(f"{meal.day_of_week} {meal.meal_type}")

        db.commit()
        reply = f"Replaced {result.ingredient_name} with a substitute in: {', '.join(changed_meals)}."
        _save_message(db, convo.id, "assistant", reply)
        db.commit()
        return schemas.ChatResponse(reply=reply, action_taken=f"substituted in {len(changed_meals)} meal(s)")

    # Step 4: full meal swap
    if result.intent == "swap_meal":
        if not (result.day_of_week and result.meal_type):
            reply = "Which day and meal would you like me to swap? (e.g. 'Monday dinner')"
            _save_message(db, convo.id, "assistant", reply)
            db.commit()
            return schemas.ChatResponse(reply=reply, action_taken=None)

        target_meal = next(
            (m for m in plan.meals if m.day_of_week == result.day_of_week and m.meal_type == result.meal_type),
            None,
        )
        if target_meal is None:
            reply = f"I couldn't find {result.meal_type} on {result.day_of_week} in your plan."
            _save_message(db, convo.id, "assistant", reply)
            db.commit()
            return schemas.ChatResponse(reply=reply, action_taken=None)

        other_meals_that_day = [
            m for m in plan.meals
            if m.day_of_week == result.day_of_week and m.id != target_meal.id
        ]
        current_day_total = sum(m.nutrition.calories for m in other_meals_that_day if m.nutrition)

        new_meal = swap_meal(result.day_of_week, result.meal_type, current_user.preferences, current_day_total)
        validation = validate_single_meal(
            new_meal,
            current_user.preferences.allergies or [],
            current_user.preferences.dietary_restrictions or [],
        )
        if not validation.passed:
            reply = "I couldn't find a suitable replacement that respects your restrictions — please try again."
            _save_message(db, convo.id, "assistant", reply)
            db.commit()
            return schemas.ChatResponse(reply=reply, action_taken=None)

        # overwrite the existing meal's fields and replace its ingredients/nutrition
        target_meal.recipe_name = new_meal.recipe_name
        target_meal.recipe_instructions = new_meal.recipe_instructions
        target_meal.prep_time_minutes = new_meal.prep_time_minutes
        target_meal.cook_time_minutes = new_meal.cook_time_minutes

        for old_ing in list(target_meal.ingredients):
            db.delete(old_ing)
        for ing in new_meal.ingredients:
            db.add(models.MealIngredient(
                meal_id=target_meal.id,
                ingredient_name=ing.ingredient_name,
                quantity=ing.quantity,
                unit=ing.unit,
                category=ing.category,
            ))

        if target_meal.nutrition:
            db.delete(target_meal.nutrition)
        db.flush()
        db.add(models.MealNutrition(
            meal_id=target_meal.id,
            calories=new_meal.nutrition.calories,
            protein_g=new_meal.nutrition.protein_g,
            carbs_g=new_meal.nutrition.carbs_g,
            fat_g=new_meal.nutrition.fat_g,
            fiber_g=new_meal.nutrition.fiber_g,
        ))

        db.commit()
        reply = f"Swapped {result.day_of_week} {result.meal_type} for {new_meal.recipe_name}."
        _save_message(db, convo.id, "assistant", reply)
        db.commit()
        return schemas.ChatResponse(reply=reply, action_taken=f"swapped {result.day_of_week} {result.meal_type}")

    # fallback, shouldn't be reachable given the Literal type
    raise HTTPException(status_code=500, detail="Unhandled intent")