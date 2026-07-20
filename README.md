# NutriPlan

An AI-powered nutrition assistant for people who are suddenly on their own for the first time — new grads, new movers, anyone who has to figure out food, on a budget, without much time to cook.

Given a user's goals, dietary restrictions, budget, and time constraints, NutriPlan generates a personalized weekly meal plan, an automatically aggregated grocery list (pantry-aware), and a chat interface for making changes — swap a meal, substitute an ingredient, or ask a question — all backed by real validation, not just LLM output taken at face value.

## Why this exists

Most "AI wrapper" apps make a single LLM call and display whatever comes back. NutriPlan is built around a different principle: **use the LLM where genuine judgment or generation is needed, and use deterministic code everywhere else** — especially anywhere a wrong answer has real consequences (an unnoticed allergen, a calorie target that's silently off).

Concretely, that means:
- Calorie targets are computed with the Mifflin-St Jeor formula in Python, not guessed by the model.
- Meal-type assignment (breakfast/lunch/dinner/snack for a given day) is rule-based, not left to the LLM to infer.
- Every generated plan is checked — calorie tolerance, allergy safety, dietary restriction compliance — before it ever reaches the user, and failures are fed back to the LLM as specific, structured feedback in a real retry loop.
- The chat agent can actually modify the stored plan (ingredient substitutions, full meal swaps), but every change is validated the same way, before being written to the database.

## Architecture

```
Next.js frontend
        │
        ▼
FastAPI backend
├── Meal Planning Agent (LangChain + Gemini)
│     generates the week's plan from user preferences
├── Chat Agent (LangChain + Gemini)
│     classifies intent, resolves ambiguity, edits meals/ingredients
└── Deterministic logic (no LLM)
      calorie target (Mifflin-St Jeor), validation, meal-type assignment,
      grocery aggregation
        │                       │
        ▼                       ▼
   Gemini API              Postgres (Neon)
   (LLM calls)         users, plans, pantry, chat history
```

Two real LLM-backed agents, not four — the "Nutrition Agent" and "Grocery Agent" from early design sketches ended up as deterministic Python functions, deliberately, since arithmetic and aggregation don't benefit from being run through a model.

## Features

**Auth & onboarding**
- Signup / login / logout with bcrypt password hashing and httpOnly JWT cookies
- Full preferences form on first onboarding; partial (patch-style) editing afterward
- A meal-type picker appears when a user selects fewer than 3 meals/day, since "1 meal" is genuinely ambiguous without knowing which one

**AI meal generation**
- Structured LLM output (Pydantic-constrained) — the model returns validated objects, not raw text to parse
- Deterministic validation after every generation: calorie tolerance (±10% of target), allergy check, dietary restriction check, meal-type match
- Automatic retry (up to 2x) with the model's own prior attempt and the specific validation failures fed back in, when a generation fails validation

**Grocery & pantry**
- Grocery list computed on-the-fly from the current plan's ingredients, grouped by ingredient+unit and by store category
- A persistent, user-driven pantry — nothing auto-decrements (a plan being generated isn't the same real-world event as a meal being cooked), so pantry only changes when the user explicitly confirms it
- Pantry entries created directly from the grocery list's own ingredient/unit values, eliminating "cup" vs "cups"-style mismatches for the common path

**Chat**
- Intent classification into three categories: question, ingredient substitution, full meal swap — plus explicit ambiguity handling (the model can say "I'm not sure" and ask a clarifying question instead of guessing)
- Substitutions and swaps write real changes to the database (ingredients, recipe name/instructions, recalculated nutrition), which is why the grocery list reflects them automatically afterward
- Every swap is re-validated (allergies, restrictions) before being committed; a failed validation is reported honestly rather than silently retried

## Tech stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind
- **Backend:** FastAPI, SQLAlchemy ORM, Pydantic
- **Database:** PostgreSQL (Neon)
- **AI:** LangChain + Google Gemini (`gemini-flash-lite-latest`)
- **Auth:** JWT in httpOnly cookies, bcrypt password hashing

## Local setup

**Backend**
```bash
cd nutriplan-backend
python -m venv venv
venv\Scripts\activate   # or source venv/bin/activate on macOS/Linux
pip install -r requirements.txt
# create .env with DATABASE_URL, JWT_SECRET, GEMINI_API_KEY
uvicorn app.main:app --reload --port 8000
```

**Frontend**
```bash
cd nutriplan-frontend
npm install
# create .env.local with NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

## Known limitations

These are deliberate, scoped-out decisions given the build timeline, not oversights — noted here for transparency:

- **Allergy/dietary-restriction matching** is a curated keyword list, not a full ingredient ontology — it won't catch synonyms it hasn't been told about (e.g. "groundnut" vs "peanut").
- **No nutrition grounding (RAG)** — calorie/macro values are LLM-estimated, not looked up against a reference nutrition database.
- **No Alembic migrations** — schema changes currently require manual `ALTER TABLE` statements against the live database.
- **Pantry unit mismatches** are possible if entered manually (mitigated for the grocery-list-driven entry flow, which never requires free-text unit entry).
- **No retry-with-backoff** for transient Gemini failures (timeouts, momentary errors) — only validation failures trigger a retry today.
- **Chat actions don't share memory across turns** — a substitution made in one meal doesn't inform a later, unrelated swap of a different meal.
- **Old meal plans are never archived** — every regeneration creates a new row; nothing currently marks previous plans as inactive.
- **Rate limiting is in-memory**, not distributed — resets on restart, wouldn't hold up across multiple server instances.

## What I'd build next

- Ground nutrition facts against a real reference database (e.g. USDA FoodData Central) instead of trusting LLM estimates
- Expand the restriction/allergy keyword list into a fuller ingredient ontology
- Price-aware grocery list optimization and store/vendor comparison
- Streaming chat responses
- Alembic-based migrations