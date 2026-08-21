"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({ email, password });

    setLoading(false);
    if (error) return setError(error.message);

    router.push("/app");
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Create account</h1>
        <p className="mt-1 text-sm text-neutral-600">Start using ATELIA OS.</p>

        <form onSubmit={onRegister} className="mt-6 space-y-3">
          <input
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-200"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-200"
            placeholder="Password (min 6 chars)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-neutral-900 px-3 py-2 text-white disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create account"}
          </button>

          <p className="text-sm text-neutral-600">
            Already have an account?{" "}
            <Link className="text-neutral-900 underline" href="/auth/login">
              Login
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}