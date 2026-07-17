# app/agents/meal_planner.py
import os
from dataclasses import dataclass, field
from typing import List, Optional

from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import AIMessage


# ---------- LLM output shape ----------

class LLMIngredient(BaseModel):
    ingredient_name: str
    quantity: float
    unit: Optional[str] = Field(None, description="e.g. cup, tbsp, g. Omit for whole items like '2 eggs'.")
    category: str = Field(..., description="One of: produce, dairy, protein, pantry, frozen, other")


class LLMNutrition(BaseModel):
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: Optional[float] = None


class LLMMeal(BaseModel):
    meal_type: str = Field(..., description="One of: breakfast, lunch, dinner, snack")
    recipe_name: str
    recipe_instructions: str = Field(..., description="Numbered steps, newline separated")
    prep_time_minutes: int
    cook_time_minutes: int
    ingredients: List[LLMIngredient]
    nutrition: LLMNutrition


class LLMDay(BaseModel):
    day_of_week: str
    meals: List[LLMMeal]


class LLMMealPlan(BaseModel):
    days: List[LLMDay]


# ---------- Calorie target (deterministic, not LLM-generated) ----------

def _estimate_calorie_target(preferences) -> int:
    height_cm = preferences.height_cm
    weight_kg = preferences.weight_kg
    age = preferences.age
    gender = preferences.gender

    if gender == "male":
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    elif gender == "female":
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
    else:  # prefer_not_to_answer -> average the two constants
        bmr_male = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
        bmr_female = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
        bmr = (bmr_male + bmr_female) / 2

    activity_multipliers = {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "active": 1.725,
    }
    tdee = bmr * activity_multipliers[preferences.activity_level]

    goal_adjustments = {
        "lose": -500,
        "maintain": 0,
        "gain": 300,
        "bulk_up": 500,
    }
    target = tdee + goal_adjustments[preferences.goal]

    return round(target)


# ---------- Meal types (deterministic, not LLM-guessed) ----------

def _determine_meal_types(preferences) -> List[str]:
    """
    Decides which meal types (breakfast/lunch/dinner/snack) should appear each day.
    - If the user explicitly picked meal types (relevant when meals_per_day < 3), use that.
    - Otherwise, fall back to a sensible default based on the count.
    - include_snacks adds a snack slot if not already present.
    """
    if getattr(preferences, "selected_meal_types", None):
        types = list(preferences.selected_meal_types)
    elif preferences.meals_per_day == 1:
        types = ["dinner"]
    elif preferences.meals_per_day == 2:
        types = ["lunch", "dinner"]
    elif preferences.meals_per_day == 3:
        types = ["breakfast", "lunch", "dinner"]
    else:
        types = ["breakfast", "lunch", "dinner"] + ["snack"] * (preferences.meals_per_day - 3)

    if preferences.include_snacks and "snack" not in types:
        types.append("snack")

    return types


# ---------- Prompt ----------

PROMPT_TEMPLATE = ChatPromptTemplate.from_template("""
You are a professional nutritionist and meal planner.

Generate a {days}-day meal plan for a user with this profile:
- Goal: {goal}
- Daily calorie target: {calorie_target} calories
- Required meal types for each day, in this exact set: {meal_types}
- Typical distribution across meal types: breakfast ~20-25%, lunch ~30-35%, dinner ~30-35%, snacks ~10-15% of the daily total. Use this as a guide, not a strict rule.
- Dietary restrictions: {restrictions}
- Allergies: {allergies}
- Cuisine preferences: {cuisines}
- Max cooking time per meal: {max_time} minutes
- Weekly budget: ${budget}

Rules:
- Each day must contain exactly these meal types, no more, no fewer: {meal_types}
- Respect all dietary restrictions and allergies strictly, this is critical.
- Each day's meals must sum to within 10% of {calorie_target} calories total. Double check your math before finalizing.
- Every ingredient mentioned in the recipe instructions must also appear in the ingredients list, with a quantity. Do not reference an ingredient in the steps that isn't listed. Double check this before finalizing.
- Vary meals across the week, do not repeat the same recipe.
- Reuse overlapping ingredients across meals where possible, to minimize grocery cost and waste.
- Keep recipes achievable for a beginner cook.
- If goal is "bulk_up", prioritize a higher protein target (roughly 1.6-2.2g per kg bodyweight per day) across meals.
""")


# ---------- Validation ----------

RESTRICTION_KEYWORDS = {
    "vegetarian": ["chicken", "beef", "pork", "turkey", "fish", "cod", "salmon", "tuna", "shrimp", "bacon"],
    "vegan": ["chicken", "beef", "pork", "turkey", "fish", "cod", "salmon", "tuna", "shrimp", "bacon",
              "egg", "milk", "cheese", "yogurt", "honey", "butter"],
    "gluten_free": ["wheat", "flour", "bread", "pasta", "barley", "rye"],
}


@dataclass
class ValidationResult:
    passed: bool
    issues: List[str] = field(default_factory=list)


def _check_restrictions(ingredient_text: str, restrictions_lower: List[str]) -> List[str]:
    issues = []
    for restriction in restrictions_lower:
        if restriction in RESTRICTION_KEYWORDS:
            for word in RESTRICTION_KEYWORDS[restriction]:
                if word in ingredient_text:
                    issues.append(f"contains '{word}', violating restriction '{restriction}'")
        else:
            if restriction in ingredient_text:
                issues.append(f"contains '{restriction}', which was listed as a restriction")
    return issues


def validate_meal_plan(
    plan: LLMMealPlan,
    calorie_target: int,
    allergies: List[str],
    restrictions: List[str],
    expected_meal_types: List[str],
) -> ValidationResult:
    issues = []
    allergies_lower = [a.strip().lower() for a in allergies if a.strip()]
    restrictions_lower = [r.strip().lower() for r in restrictions if r.strip()]
    expected_set = set(expected_meal_types)

    for day in plan.days:
        daily_total = sum(meal.nutrition.calories for meal in day.meals)
        lower_bound = calorie_target * 0.9
        upper_bound = calorie_target * 1.1
        if not (lower_bound <= daily_total <= upper_bound):
            issues.append(
                f"{day.day_of_week}: total {daily_total:.0f} cal is outside target range "
                f"({lower_bound:.0f}-{upper_bound:.0f})"
            )

        actual_meal_types = {meal.meal_type for meal in day.meals}
        if actual_meal_types != expected_set:
            issues.append(
                f"{day.day_of_week}: meal types {sorted(actual_meal_types)} "
                f"do not match expected {sorted(expected_set)}"
            )

        for meal in day.meals:
            ingredient_text = " ".join(ing.ingredient_name.lower() for ing in meal.ingredients)

            for allergen in allergies_lower:
                if allergen in ingredient_text:
                    issues.append(
                        f"{day.day_of_week} {meal.meal_type} ('{meal.recipe_name}') "
                        f"contains possible allergen '{allergen}'"
                    )

            for issue in _check_restrictions(ingredient_text, restrictions_lower):
                issues.append(f"{day.day_of_week} {meal.meal_type} ('{meal.recipe_name}') {issue}")

    return ValidationResult(passed=len(issues) == 0, issues=issues)


# ---------- Agent construction + generation with validation retry ----------

def build_agent():
    api_key = os.getenv("GEMINI_API_KEY")
    llm = ChatGoogleGenerativeAI(model="gemini-flash-lite-latest", google_api_key=api_key, temperature=0.7)
    return llm.with_structured_output(LLMMealPlan)


def generate_meal_plan(preferences, days: int = 7, max_retries: int = 2) -> LLMMealPlan:
    """
    preferences: a UserPreferences SQLAlchemy object (or anything with matching attributes)
    """
    agent = build_agent()
    calorie_target = _estimate_calorie_target(preferences)
    allergies = preferences.allergies or []
    restrictions = preferences.dietary_restrictions or []
    meal_types = _determine_meal_types(preferences)

    base_prompt = PROMPT_TEMPLATE.format_messages(
        days=days,
        goal=preferences.goal,
        calorie_target=calorie_target,
        meal_types=", ".join(meal_types),
        restrictions=", ".join(restrictions) or "none",
        allergies=", ".join(allergies) or "none",
        cuisines=", ".join(preferences.cuisine_preferences) or "no preference",
        max_time=preferences.max_cooking_time_minutes,
        budget=preferences.budget_weekly_usd or "flexible",
    )

    messages = list(base_prompt)
    plan = None

    for attempt in range(max_retries + 1):
        plan = agent.invoke(messages)
        result = validate_meal_plan(plan, calorie_target, allergies, restrictions, meal_types)

        if result.passed:
            return plan

        if attempt < max_retries:
            feedback = (
                "The previous plan had these issues, please fix them and regenerate the full plan:\n"
                + "\n".join(f"- {issue}" for issue in result.issues)
            )
            messages = messages + [
                AIMessage(content=plan.model_dump_json()),
                ("human", feedback),
            ]

    return plan

def validate_single_meal(meal: LLMMeal, allergies: List[str], restrictions: List[str]) -> ValidationResult:
    issues = []
    allergies_lower = [a.strip().lower() for a in allergies if a.strip()]
    restrictions_lower = [r.strip().lower() for r in restrictions if r.strip()]
    ingredient_text = " ".join(ing.ingredient_name.lower() for ing in meal.ingredients)

    for allergen in allergies_lower:
        if allergen in ingredient_text:
            issues.append(f"contains possible allergen '{allergen}'")

    for issue in _check_restrictions(ingredient_text, restrictions_lower):
        issues.append(issue)

    return ValidationResult(passed=len(issues) == 0, issues=issues)