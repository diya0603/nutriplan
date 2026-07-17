"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPantry, upsertPantryItem, deletePantryItem } from "@/lib/api";

type PantryItem = {
  id: number;
  ingredient_name: string;
  quantity: number | null;
  unit: string | null;
};

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ ingredient_name: "", quantity: "", unit: "" });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await getPantry();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pantry");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await upsertPantryItem({
        ingredient_name: form.ingredient_name.trim(),
        quantity: form.quantity ? Number(form.quantity) : null,
        unit: form.unit.trim() || null,
      });
      setForm({ ingredient_name: "", quantity: "", unit: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    }
  }

  async function handleDelete(id: number) {
    try {
      await deletePantryItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete item");
    }
  }

  const inputClass =
    "rounded-lg border border-[#1B3A2F]/15 bg-white px-3 py-2 text-sm text-[#1B3A2F] focus:outline-none focus:ring-2 focus:ring-[#E8935C]";

  return (
    <main className="min-h-screen bg-[#FBF9F4] px-4 py-10">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold text-[#1B3A2F] tracking-tight">
            Your pantry
          </h1>
          <Link href="/dashboard" className="text-sm text-[#1B3A2F]/60 hover:text-[#1B3A2F]">
            Back to plan
          </Link>
        </div>

        <form onSubmit={handleAdd} className="flex gap-2 mb-6">
          <input
            placeholder="Ingredient"
            value={form.ingredient_name}
            onChange={(e) => setForm({ ...form, ingredient_name: e.target.value })}
            required
            className={`${inputClass} flex-1`}
          />
          <input
            placeholder="Qty (optional)"
            type="number"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            className={`${inputClass} w-28`}
          />
          <input
            placeholder="Unit"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            className={`${inputClass} w-24`}
          />
          <button
            type="submit"
            className="rounded-lg bg-[#1B3A2F] text-white px-4 py-2 text-sm font-medium hover:bg-[#1B3A2F]/90"
          >
            Add
          </button>
        </form>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        {loading && <p className="text-[#1B3A2F]/60">Loading...</p>}

        {!loading && (
          <div className="bg-white rounded-xl border border-[#1B3A2F]/10 divide-y divide-[#1B3A2F]/10">
            {items.length === 0 && (
              <p className="p-4 text-sm text-[#1B3A2F]/50">Your pantry is empty.</p>
            )}
            {items.map((item) => (
              <div key={item.id} className="p-3 flex items-center justify-between">
                <div className="text-[#1B3A2F]">
                  <span className="font-medium">{item.ingredient_name}</span>
                  <span className="text-sm text-[#1B3A2F]/50 ml-2">
                    {item.quantity != null ? `${item.quantity} ${item.unit || ""}` : "have it"}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}