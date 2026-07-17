// app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login, getMe } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(form);
      const me = await getMe();
      if (me.preferences === null) {
        router.push("/onboarding");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#FBF9F4] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-[#1B3A2F] tracking-tight">
            NutriPlan
          </h1>
          <p className="mt-1 text-sm text-[#1B3A2F]/60">Log in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1B3A2F] mb-1">
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              value={form.email}
              onChange={handleChange}
              className="w-full rounded-lg border border-[#1B3A2F]/15 bg-white px-3 py-2 text-[#1B3A2F] focus:outline-none focus:ring-2 focus:ring-[#E8935C]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1B3A2F] mb-1">
              Password
            </label>
            <input
              name="password"
              type="password"
              required
              value={form.password}
              onChange={handleChange}
              className="w-full rounded-lg border border-[#1B3A2F]/15 bg-white px-3 py-2 text-[#1B3A2F] focus:outline-none focus:ring-2 focus:ring-[#E8935C]"
            />
          </div>

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
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#1B3A2F]/60">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-[#E8935C] font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}