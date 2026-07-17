// app/onboarding/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPreferences, updatePreferences, getMe } from "@/lib/api";

const MEAL_TYPE_OPTIONS = ["breakfast", "lunch", "dinner"];

const initialForm = {
  height_cm: "",
  weight_kg: "",
  age: "",
  gender: "prefer_not_to_answer",
  goal: "maintain",
  activity_level: "sedentary",
  dietary_restrictions: "",
  allergies: "",
  cuisine_preferences: "",
  meals_per_day: "3",
  include_snacks: false,
  max_cooking_time_minutes: "30",
  budget_weekly_usd: "",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [selectedMealTypes, setSelectedMealTypes] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadExistingPreferences();
  }, []);

 async function loadExistingPreferences() {
  try {
    const me = await getMe();
    console.log("getMe() returned:", me); // TEMP — remove after debugging
    if (me.preferences) {
      const p = me.preferences;
      setForm({
        height_cm: String(p.height_cm),
        weight_kg: String(p.weight_kg),
        age: String(p.age),
        gender: p.gender,
        goal: p.goal,
        activity_level: p.activity_level,
        dietary_restrictions: (p.dietary_restrictions || []).join(", "),
        allergies: (p.allergies || []).join(", "),
        cuisine_preferences: (p.cuisine_preferences || []).join(", "),
        meals_per_day: String(p.meals_per_day),
        include_snacks: p.include_snacks,
        max_cooking_time_minutes: String(p.max_cooking_time_minutes),
        budget_weekly_usd: p.budget_weekly_usd != null ? String(p.budget_weekly_usd) : "",
      });
      setSelectedMealTypes(p.selected_meal_types || []);
      setIsEditing(true);
    } else {
      console.log("me.preferences is null/falsy"); // TEMP
    }
  } catch (err) {
    console.error("getMe() failed:", err); // TEMP — was silently swallowed before
  } finally {
    setPageLoading(false);
  }
}

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setForm({ ...form, [name]: checked });
    } else {
      setForm({ ...form, [name]: value });
      if (name === "meals_per_day") {
        // reset meal-type selection whenever the count changes, to avoid a stale mismatch
        setSelectedMealTypes([]);
      }
    }
  }

  function toggleMealType(mealType: string) {
    setSelectedMealTypes((prev) =>
      prev.includes(mealType)
        ? prev.filter((t) => t !== mealType)
        : [...prev, mealType]
    );
  }

  function splitList(value: string): string[] {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const mealsPerDay = Number(form.meals_per_day);
    if (mealsPerDay < 3 && selectedMealTypes.length !== mealsPerDay) {
      setError(`Please select exactly ${mealsPerDay} meal type(s).`);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        height_cm: Number(form.height_cm),
        weight_kg: Number(form.weight_kg),
        age: Number(form.age),
        gender: form.gender,
        goal: form.goal,
        activity_level: form.activity_level,
        dietary_restrictions: splitList(form.dietary_restrictions),
        allergies: splitList(form.allergies),
        cuisine_preferences: splitList(form.cuisine_preferences),
        meals_per_day: mealsPerDay,
        include_snacks: form.include_snacks,
        max_cooking_time_minutes: Number(form.max_cooking_time_minutes),
        budget_weekly_usd: form.budget_weekly_usd
          ? Number(form.budget_weekly_usd)
          : null,
        selected_meal_types: mealsPerDay < 3 ? selectedMealTypes : null,
      };

      if (isEditing) {
        await updatePreferences(payload);
      } else {
        await createPreferences(payload);
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-[#1B3A2F]/15 bg-white px-3 py-2 text-[#1B3A2F] focus:outline-none focus:ring-2 focus:ring-[#E8935C]";
  const labelClass = "block text-sm font-medium text-[#1B3A2F] mb-1";
  const mealsPerDayNum = Number(form.meals_per_day);

  if (pageLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#FBF9F4]">
        <p className="text-[#1B3A2F]/60">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FBF9F4] px-4 py-12">
      <div className="w-full max-w-lg mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-[#1B3A2F] tracking-tight">
            {isEditing ? "Edit your preferences" : "Tell us about you"}
          </h1>
          <p className="mt-1 text-sm text-[#1B3A2F]/60">
            {isEditing
              ? "Update anything below, then save"
              : "We'll use this to build your first meal plan"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Height (cm)</label>
              <input
                name="height_cm"
                type="number"
                required
                value={form.height_cm}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Weight (kg)</label>
              <input
                name="weight_kg"
                type="number"
                required
                value={form.weight_kg}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Age</label>
              <input
                name="age"
                type="number"
                required
                value={form.age}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Gender</label>
              <select
                name="gender"
                value={form.gender}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="prefer_not_to_answer">Prefer not to answer</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Goal</label>
              <select
                name="goal"
                value={form.goal}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="lose">Lose weight</option>
                <option value="maintain">Maintain weight</option>
                <option value="gain">Gain weight</option>
                <option value="bulk_up">Bulk up (build muscle)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Activity level</label>
              <select
                name="activity_level"
                value={form.activity_level}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="sedentary">Sedentary</option>
                <option value="light">Lightly active</option>
                <option value="moderate">Moderately active</option>
                <option value="active">Very active</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>
              Dietary restrictions{" "}
              <span className="text-[#1B3A2F]/40 font-normal">
                (comma-separated, e.g. vegetarian, gluten-free)
              </span>
            </label>
            <input
              name="dietary_restrictions"
              type="text"
              value={form.dietary_restrictions}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              Allergies{" "}
              <span className="text-[#1B3A2F]/40 font-normal">
                (comma-separated)
              </span>
            </label>
            <input
              name="allergies"
              type="text"
              value={form.allergies}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              Cuisine preferences{" "}
              <span className="text-[#1B3A2F]/40 font-normal">
                (comma-separated, e.g. italian, thai)
              </span>
            </label>
            <input
              name="cuisine_preferences"
              type="text"
              value={form.cuisine_preferences}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Meals per day</label>
              <input
                name="meals_per_day"
                type="number"
                min={1}
                max={6}
                required
                value={form.meals_per_day}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Max cooking time (min)</label>
              <input
                name="max_cooking_time_minutes"
                type="number"
                required
                value={form.max_cooking_time_minutes}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>

          {mealsPerDayNum > 0 && mealsPerDayNum < 3 && (
            <div>
              <label className={labelClass}>
                Which meals? (choose {mealsPerDayNum})
              </label>
              <div className="flex gap-4">
                {MEAL_TYPE_OPTIONS.map((type) => {
                  const checked = selectedMealTypes.includes(type);
                  const atLimit = selectedMealTypes.length >= mealsPerDayNum;
                  return (
                    <label
                      key={type}
                      className="flex items-center gap-2 text-sm text-[#1B3A2F] capitalize"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMealType(type)}
                        disabled={!checked && atLimit}
                        className="h-4 w-4 rounded border-[#1B3A2F]/30 text-[#E8935C] focus:ring-[#E8935C]"
                      />
                      {type}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>
              Weekly grocery budget ($){" "}
              <span className="text-[#1B3A2F]/40 font-normal">(optional)</span>
            </label>
            <input
              name="budget_weekly_usd"
              type="number"
              value={form.budget_weekly_usd}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-[#1B3A2F]">
            <input
              name="include_snacks"
              type="checkbox"
              checked={form.include_snacks}
              onChange={handleChange}
              className="h-4 w-4 rounded border-[#1B3A2F]/30 text-[#E8935C] focus:ring-[#E8935C]"
            />
            Include snacks in my plan
          </label>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#1B3A2F] text-white py-2.5 font-medium hover:bg-[#1B3A2F]/90 disabled:opacity-50 transition"
          >
            {loading ? "Saving..." : isEditing ? "Save changes" : "Save and continue"}
          </button>
        </form>
      </div>
    </main>
  );
}