// app/grocery/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getGroceryList, upsertPantryItem } from "@/lib/api";

type GroceryItem = {
  ingredient_name: string;
  quantity: number;
  unit: string | null;
};

type GroceryList = {
  categories: Record<string, GroceryItem[]>;
};

type Selection = { type: "have_it" } | { type: "have_some"; amount: string };

export default function GroceryPage() {
  const [list, setList] = useState<GroceryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, Selection>>({});

  useEffect(() => {
    loadList();
  }, []);

  async function loadList() {
    setLoading(true);
    setError(null);
    try {
      const data = await getGroceryList();
      setList(data);
      setSelections({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "No grocery list found. Generate a meal plan first.");
    } finally {
      setLoading(false);
    }
  }

  function keyFor(item: GroceryItem) {
    return `${item.ingredient_name}__${item.unit ?? ""}`;
  }

  function selectHaveIt(key: string) {
    setSelections((prev) => ({ ...prev, [key]: { type: "have_it" } }));
  }

  function selectHaveSome(key: string) {
    setSelections((prev) => ({ ...prev, [key]: { type: "have_some", amount: "" } }));
  }

  function setAmount(key: string, amount: string) {
    setSelections((prev) => ({ ...prev, [key]: { type: "have_some", amount } }));
  }

  function clearSelection(key: string) {
    setSelections((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit() {
    setError(null);

    // validate all "have_some" entries have a real number before sending anything
    for (const [key, selection] of Object.entries(selections)) {
      if (selection.type === "have_some") {
        const amount = Number(selection.amount);
        if (!selection.amount || isNaN(amount) || amount < 0) {
          setError(`Enter a valid amount for ${key.split("__")[0]}`);
          return;
        }
      }
    }

    if (!list) return;
    setSubmitting(true);
    try {
      const allItems = Object.values(list.categories).flat();
      for (const [key, selection] of Object.entries(selections)) {
        const item = allItems.find((i) => keyFor(i) === key);
        if (!item) continue;
        await upsertPantryItem({
          ingredient_name: item.ingredient_name,
          quantity: selection.type === "have_it" ? null : Number(selection.amount),
          unit: item.unit,
        });
      }
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update pantry");
    } finally {
      setSubmitting(false);
    }
  }

  const selectionCount = Object.keys(selections).length;

  return (
    <main className="min-h-screen bg-[#FBF9F4] px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold text-[#1B3A2F] tracking-tight">
            Grocery list
          </h1>
          <div className="flex items-center gap-4">
            <button onClick={loadList} className="text-sm text-[#1B3A2F]/60 hover:text-[#1B3A2F]">
              Refresh
            </button>
            <Link href="/dashboard" className="text-sm text-[#1B3A2F]/60 hover:text-[#1B3A2F]">
              Back to plan
            </Link>
          </div>
        </div>

        {loading && <p className="text-[#1B3A2F]/60">Loading...</p>}
        {error && !loading && <p className="text-sm text-red-600 mb-4">{error}</p>}

        {!loading && list && (
          <div className="space-y-6 pb-20">
            {Object.entries(list.categories).map(([category, items]) => (
              <div key={category}>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[#E8935C] mb-2">
                  {category}
                </h2>
                <div className="bg-white rounded-xl border border-[#1B3A2F]/10 divide-y divide-[#1B3A2F]/10">
                  {items.map((item) => {
                    const key = keyFor(item);
                    const selection = selections[key];

                    return (
                      <div key={key} className="p-3 flex items-center justify-between gap-3">
                        <div className="text-[#1B3A2F]">
                          <span className="font-medium">{item.ingredient_name}</span>
                          <span className="text-sm text-[#1B3A2F]/50 ml-2">
                            {item.quantity} {item.unit || ""}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {selection?.type === "have_some" ? (
                            <>
                              <input
                                type="number"
                                value={selection.amount}
                                onChange={(e) => setAmount(key, e.target.value)}
                                placeholder={item.unit || "amount"}
                                className="w-20 rounded-lg border border-[#1B3A2F]/15 px-2 py-1 text-sm"
                                autoFocus
                              />
                              <button
                                onClick={() => clearSelection(key)}
                                className="text-xs text-[#1B3A2F]/50 hover:underline"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() =>
                                  selection?.type === "have_it" ? clearSelection(key) : selectHaveIt(key)
                                }
                                className={
                                  selection?.type === "have_it"
                                    ? "text-xs rounded-lg bg-[#1B3A2F] text-white px-2 py-1.5"
                                    : "text-xs rounded-lg border border-[#1B3A2F]/20 text-[#1B3A2F] px-2 py-1.5 hover:bg-[#1B3A2F]/5"
                                }
                              >
                                {selection?.type === "have_it" ? "✓ Have it" : "I have this"}
                              </button>
                              <button
                                onClick={() => selectHaveSome(key)}
                                className="text-xs rounded-lg border border-[#1B3A2F]/20 text-[#1B3A2F] px-2 py-1.5 hover:bg-[#1B3A2F]/5"
                              >
                                I have some
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {Object.keys(list.categories).length === 0 && (
              <p className="text-[#1B3A2F]/60 text-center py-12">
                Nothing to buy — your pantry covers everything!
              </p>
            )}
          </div>
        )}
      </div>

      {selectionCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#1B3A2F]/10 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <span className="text-sm text-[#1B3A2F]/60">
              {selectionCount} item{selectionCount > 1 ? "s" : ""} selected
            </span>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-lg bg-[#1B3A2F] text-white px-5 py-2 text-sm font-medium hover:bg-[#1B3A2F]/90 disabled:opacity-50"
            >
              {submitting ? "Updating pantry..." : "Update pantry"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}