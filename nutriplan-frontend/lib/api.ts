// lib/api.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Request failed: ${res.status}`);
  }

  if (res.status === 204) {
    return null;
  }

  return res.json();
}
// ---------- Auth ----------

export function signup(data: {
  name: string;
  email: string;
  password: string;
  confirm_password: string;
}) {
  return apiFetch("/auth/signup", { method: "POST", body: JSON.stringify(data) });
}

export function login(data: { email: string; password: string }) {
  return apiFetch("/auth/login", { method: "POST", body: JSON.stringify(data) });
}

export function logout() {
  return apiFetch("/auth/logout", { method: "POST" });
}

export function getMe() {
  return apiFetch("/users/me");
}

// ---------- Preferences ----------

export function createPreferences(data: Record<string, unknown>) {
  return apiFetch("/preferences/", { method: "POST", body: JSON.stringify(data) });
}

export function updatePreferences(data: Record<string, unknown>) {
  return apiFetch("/preferences/", { method: "PUT", body: JSON.stringify(data) });
}

// ---------- Meal plans ----------

export function generateMealPlan(days: number = 7) {
  return apiFetch("/meal-plans/generate", { method: "POST", body: JSON.stringify({ days }) });
}

export function getCurrentMealPlan() {
  return apiFetch("/meal-plans/current");
}


export function getGroceryList() {
  return apiFetch("/meal-plans/current/grocery-list");
}

export function upsertPantryItem(data: {
  ingredient_name: string;
  quantity: number | null;
  unit: string | null;
}) {
  return apiFetch("/pantry/", { method: "POST", body: JSON.stringify(data) });
}


export function getPantry() {
  return apiFetch("/pantry/");
}

export function deletePantryItem(id: number) {
  return apiFetch(`/pantry/${id}`, { method: "DELETE" });
}