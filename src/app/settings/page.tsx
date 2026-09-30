"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.SyntheticEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");

    const trimmedEmail = email.trim();

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Invalid credentials");
      }

      // Save user info in localStorage for client-side session state
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("cse_user", JSON.stringify(data.user));
      }

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (err: unknown) {
      console.error("Login attempt error:", err);
      const message =
        err instanceof Error ? err.message : "Invalid credentials";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Account Login</h1>
          <p className="text-slate-500 text-sm mt-1">
            Enter your credentials to access your CSE portal.
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-600 text-sm p-3 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="block text-sm font-semibold text-slate-600 mb-1"
            >
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-xl p-3 outline-none focus:border-blue-500 transition"
              placeholder="maria@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-sm font-semibold text-slate-600 mb-1"
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-xl p-3 outline-none focus:border-blue-500 transition"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-blue-600 font-semibold hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}