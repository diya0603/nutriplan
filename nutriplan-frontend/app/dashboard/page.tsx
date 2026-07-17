// app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentMealPlan, generateMealPlan, logout } from "@/lib/api";

type Ingredient = {
  ingredient_name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
};

type Nutrition = {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
};

type Meal = {
  id: number;
  day_of_week: string;
  meal_type: string;
  recipe_name: string;
  recipe_instructions: string | null;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  ingredients: Ingredient[];
  nutrition: Nutrition | null;
};

type MealPlan = {
  id: number;
  status: string;
  meals: Meal[];
};

const DAY_ORDER = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

export default function DashboardPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedMealId, setExpandedMealId] = useState<number | null>(null);

  useEffect(() => {
    loadPlan();
  }, []);

  async function loadPlan() {
    setLoading(true);
    setError(null);
    try {
      const data = await getCurrentMealPlan();
      setPlan(data);
    } catch (err) {
      // 404 just means no plan yet, not a real error
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const data = await generateMealPlan(2); // TODO: bump to 7 before demo
      setPlan(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setGenerating(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  function toggleExpand(mealId: number) {
    setExpandedMealId(expandedMealId === mealId ? null : mealId);
  }

  const mealsByDay: Record<string, Meal[]> = {};
  if (plan) {
    for (const meal of plan.meals) {
      if (!mealsByDay[meal.day_of_week]) mealsByDay[meal.day_of_week] = [];
      mealsByDay[meal.day_of_week].push(meal);
    }
  }

  return (
    <main className="min-h-screen bg-[#FBF9F4] px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold text-[#1B3A2F] tracking-tight">
            Your meal plan
          </h1>
          <div className="flex items-center gap-4">
            <Link href="/grocery" className="text-sm text-[#1B3A2F]/60 hover:text-[#1B3A2F]">
            Grocery list
            </Link>
            <Link href="/pantry" className="text-sm text-[#1B3A2F]/60 hover:text-[#1B3A2F]">
            Pantry
            </Link>
            <Link
              href="/onboarding"
              className="text-sm text-[#1B3A2F]/60 hover:text-[#1B3A2F]"
            >
              Edit preferences
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm text-[#1B3A2F]/60 hover:text-[#1B3A2F]"
            >
              Log out
            </button>
          </div>
        </div>

        {loading && <p className="text-[#1B3A2F]/60">Loading...</p>}

        {!loading && !plan && (
          <div className="text-center py-16 bg-white rounded-xl border border-[#1B3A2F]/10">
            <p className="text-[#1B3A2F] mb-4">
              You don&apos;t have a meal plan yet.
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="rounded-lg bg-[#1B3A2F] text-white px-5 py-2.5 font-medium hover:bg-[#1B3A2F]/90 disabled:opacity-50 transition"
            >
              {generating ? "Generating your plan..." : "Generate my meal plan"}
            </button>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </div>
        )}

        {!loading && plan && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-[#1B3A2F]/60">
                Changed your preferences? Regenerate to see an updated plan.
              </p>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="text-sm rounded-lg border border-[#1B3A2F]/20 text-[#1B3A2F] px-3 py-1.5 hover:bg-[#1B3A2F]/5 disabled:opacity-50 transition"
              >
                {generating ? "Regenerating..." : "Regenerate plan"}
              </button>
            </div>

            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

            <div className="space-y-8">
              {DAY_ORDER.filter((day) => mealsByDay[day]).map((day) => (
                <div key={day}>
                  <h2 className="text-lg font-semibold text-[#1B3A2F] mb-3">
                    {day}
                  </h2>
                  <div className="grid gap-3">
                    {mealsByDay[day].map((meal) => {
                      const isExpanded = expandedMealId === meal.id;
                      return (
                        <div
                          key={meal.id}
                          className="bg-white rounded-xl border border-[#1B3A2F]/10 p-4"
                        >
                          <button
                            onClick={() => toggleExpand(meal.id)}
                            className="w-full text-left"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs uppercase tracking-wide text-[#E8935C] font-medium">
                                {meal.meal_type}
                              </span>
                              {meal.nutrition?.calories != null && (
                                <span className="text-xs text-[#1B3A2F]/50">
                                  {Math.round(meal.nutrition.calories)} cal
                                </span>
                              )}
                            </div>
                            <h3 className="font-medium text-[#1B3A2F]">
                              {meal.recipe_name}
                            </h3>
                            {(meal.prep_time_minutes != null ||
                              meal.cook_time_minutes != null) && (
                              <p className="mt-1 text-xs text-[#1B3A2F]/50">
                                {meal.prep_time_minutes != null &&
                                  `${meal.prep_time_minutes} min prep`}
                                {meal.prep_time_minutes != null &&
                                  meal.cook_time_minutes != null &&
                                  " · "}
                                {meal.cook_time_minutes != null &&
                                  `${meal.cook_time_minutes} min cook`}
                              </p>
                            )}
                          </button>

                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t border-[#1B3A2F]/10 space-y-4">
                              {meal.nutrition && (
                                <div className="flex gap-4 text-xs text-[#1B3A2F]/70">
                                  <span>
                                    {Math.round(meal.nutrition.protein_g ?? 0)}g protein
                                  </span>
                                  <span>
                                    {Math.round(meal.nutrition.carbs_g ?? 0)}g carbs
                                  </span>
                                  <span>
                                    {Math.round(meal.nutrition.fat_g ?? 0)}g fat
                                  </span>
                                  {meal.nutrition.fiber_g != null && (
                                    <span>
                                      {Math.round(meal.nutrition.fiber_g)}g fiber
                                    </span>
                                  )}
                                </div>
                              )}

                              {meal.ingredients.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-[#1B3A2F] mb-1">
                                    Ingredients
                                  </p>
                                  <ul className="text-sm text-[#1B3A2F]/70 space-y-0.5">
                                    {meal.ingredients.map((ing, i) => (
                                      <li key={i}>
                                        {ing.quantity && ing.unit
                                          ? `${ing.quantity} ${ing.unit} ${ing.ingredient_name}`
                                          : ing.quantity
                                          ? `${ing.quantity} ${ing.ingredient_name}`
                                          : ing.ingredient_name}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {meal.recipe_instructions && (
                                <div>
                                  <p className="text-xs font-medium text-[#1B3A2F] mb-1">
                                    Instructions
                                  </p>
                                  <p className="text-sm text-[#1B3A2F]/70 whitespace-pre-line">
                                    {meal.recipe_instructions}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}