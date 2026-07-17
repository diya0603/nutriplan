// app/signup/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signup } from "@/lib/api";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm_password: "",
  });
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
      await signup(form);
      router.push("/login");
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
          <p className="mt-1 text-sm text-[#1B3A2F]/60">
            Create your account to get started
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1B3A2F] mb-1">
              Name
            </label>
            <input
              name="name"
              type="text"
              required
              value={form.name}
              onChange={handleChange}
              className="w-full rounded-lg border border-[#1B3A2F]/15 bg-white px-3 py-2 text-[#1B3A2F] focus:outline-none focus:ring-2 focus:ring-[#E8935C]"
            />
          </div>

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

          <div>
            <label className="block text-sm font-medium text-[#1B3A2F] mb-1">
              Confirm password
            </label>
            <input
              name="confirm_password"
              type="password"
              required
              value={form.confirm_password}
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
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#1B3A2F]/60">
          Already have an account?{" "}
           <Link href="/login" className="text-[#E8935C] font-medium hover:underline">
                Log in
            </Link>
        </p>
      </div>
    </main>
  );
}