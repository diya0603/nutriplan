# app/agents/chat_agent.py
import os
from typing import List, Literal, Optional

from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

from app import models
from app.agents.meal_planner import (
    LLMMeal, LLMIngredient, LLMNutrition,
    _estimate_calorie_target, validate_meal_plan, LLMMealPlan, LLMDay,
)


class ChatIntent(BaseModel):
    intent: Literal["question", "substitute_ingredient", "swap_meal"]
    day_of_week: Optional[str] = Field(
        None,
        description="e.g. Monday. Fill in only if the user named or clearly implied a specific day."
    )
    meal_type: Optional[str] = Field(
        None,
        description="breakfast/lunch/dinner/snack. Fill in only if the user named or clearly implied a specific meal type."
    )
    ingredient_name: Optional[str] = Field(
        None,
        description="The ingredient being replaced. Only relevant for substitute_ingredient."
    )
    scope: Literal["specific_meal", "all_meals", "unspecified"] = Field(
        "unspecified",
        description=(
            "Only relevant for substitute_ingredient. Use 'all_meals' if the user implies this "
            "applies broadly (e.g. 'I'm out of basil', 'no basil this week', 'replace basil everywhere'). "
            "Use 'specific_meal' if they clearly named one day/meal. "
            "Use 'unspecified' if it's genuinely unclear which they mean."
        )
    )
    needs_clarification: bool = Field(
        False,
        description="Set true if you cannot confidently determine what the user wants at all, even the general intent category."
    )
    clarification_question: Optional[str] = Field(
        None,
        description="If needs_clarification is true, a short, specific question to ask the user to resolve the ambiguity."
    )


class IngredientSubstitution(BaseModel):
    new_ingredient_name: str
    quantity: float
    unit: Optional[str] = None
    updated_instructions: str = Field(..., description="...")
    updated_recipe_name: str = Field(
        ...,
        description="The recipe name, updated only if the old ingredient was part of the name (e.g. 'Honey Garlic Salmon' -> 'Maple Garlic Salmon'). Otherwise return the name unchanged."
    )


def _build_llm():
    api_key = os.getenv("GEMINI_API_KEY")
    return ChatGoogleGenerativeAI(model="gemini-flash-lite-latest", google_api_key=api_key, temperature=0.5)


INTENT_PROMPT = ChatPromptTemplate.from_template("""
You are a nutritionist assistant helping a user manage their weekly meal plan.

Current plan (by day and meal type):
{plan_summary}

The user said: "{user_message}"

Classify what they want:
- "question": they're asking something, not requesting a change (e.g. "how much protein is in Monday's lunch?")
- "substitute_ingredient": they want to replace one ingredient (e.g. "I don't have basil", "can I skip the cilantro", "I'm out of basil this week")
- "swap_meal": they want an entirely different recipe for a specific meal (e.g. "swap Monday dinner", "give me something else for Wednesday lunch")

For substitute_ingredient, also determine the scope:
- If they named or clearly implied one specific day/meal, set scope to "specific_meal" and fill in day_of_week/meal_type.
- If they imply it applies broadly (e.g. "I don't have basil", "no basil this week", "replace it everywhere"), set scope to "all_meals" and leave day_of_week/meal_type null.
- If it's genuinely unclear, set scope to "unspecified" and leave day_of_week/meal_type null.

Do not guess a specific day/meal if the user didn't imply one — leave it null instead.

If you cannot confidently tell which of the three categories (question, substitute_ingredient, swap_meal) the user even means — not just which meal, but the general request itself is unclear or could plausibly be more than one category — set needs_clarification to true and write a short, specific clarification_question to ask them. In that case, still provide your best guess for the other fields, but the clarification_question will be shown to the user instead of acting on your guess.
""")

SUBSTITUTION_PROMPT = ChatPromptTemplate.from_template("""
The user wants to replace "{old_ingredient}" in this recipe:

Recipe: {recipe_name}
Current instructions: {instructions}
Current ingredients: {ingredients}

User's dietary restrictions: {restrictions}
User's allergies: {allergies}

Suggest a single reasonable substitute for "{old_ingredient}" that fits the recipe and respects restrictions/allergies.
Update the instructions to reference the new ingredient wherever the old one was mentioned; otherwise leave instructions unchanged.
""")

SWAP_PROMPT = ChatPromptTemplate.from_template("""
You are a professional nutritionist and meal planner.

The user wants a completely different {meal_type} for {day_of_week}.
Their specific request for this swap: "{user_request}"
If this request specifies a cuisine, style, or other preference, prioritize it over the general cuisine preference below.

Their profile:
- Goal: {goal}
- Dietary restrictions: {restrictions}
- Allergies: {allergies}
- General cuisine preference: {cuisines}
- Max cooking time: {max_time} minutes

This new meal should have approximately {target_calories} calories, so that {day_of_week}'s total stays close to their daily target.

Generate one replacement recipe for this meal, in the same structured format as before (name, instructions, ingredients with quantities/units/categories, and nutrition).
""")

QUESTION_PROMPT = ChatPromptTemplate.from_template("""
You are a helpful nutritionist assistant. Answer the user's question using this context about their current meal plan.

Plan:
{plan_summary}

User's question: {user_message}

Answer concisely and directly.
""")


def classify_intent(user_message: str, plan_summary: str) -> ChatIntent:
    llm = _build_llm().with_structured_output(ChatIntent)
    prompt = INTENT_PROMPT.format_messages(plan_summary=plan_summary, user_message=user_message)
    return llm.invoke(prompt)


def answer_question(user_message: str, plan_summary: str) -> str:
    llm = _build_llm()
    prompt = QUESTION_PROMPT.format_messages(plan_summary=plan_summary, user_message=user_message)
    response = llm.invoke(prompt)

    content = response.content
    if isinstance(content, list):
        # Gemini sometimes returns a list of content blocks instead of a plain string
        content = "".join(
            block.get("text", "") for block in content if isinstance(block, dict)
        )
    return content


def substitute_ingredient(meal: models.Meal, ingredient_name: str, preferences) -> IngredientSubstitution:
    llm = _build_llm().with_structured_output(IngredientSubstitution)
    ingredients_text = ", ".join(
        f"{i.quantity} {i.unit or ''} {i.ingredient_name}" for i in meal.ingredients
    )
    prompt = SUBSTITUTION_PROMPT.format_messages(
        old_ingredient=ingredient_name,
        recipe_name=meal.recipe_name,
        instructions=meal.recipe_instructions or "",
        ingredients=ingredients_text,
        restrictions=", ".join(preferences.dietary_restrictions or []) or "none",
        allergies=", ".join(preferences.allergies or []) or "none",
    )
    return llm.invoke(prompt)


def swap_meal(day_of_week: str, meal_type: str, preferences, current_day_total: float, user_request: str = "") -> LLMMeal:
    calorie_target = _estimate_calorie_target(preferences)
    target_calories = max(calorie_target - current_day_total, 100)

    llm = _build_llm().with_structured_output(LLMMeal)
    prompt = SWAP_PROMPT.format_messages(
        day_of_week=day_of_week,
        meal_type=meal_type,
        goal=preferences.goal,
        restrictions=", ".join(preferences.dietary_restrictions or []) or "none",
        allergies=", ".join(preferences.allergies or []) or "none",
        cuisines=", ".join(preferences.cuisine_preferences or []) or "no preference",
        max_time=preferences.max_cooking_time_minutes,
        target_calories=round(target_calories),
        user_request=user_request or "no specific request beyond a different recipe",
    )
    return llm.invoke(prompt)