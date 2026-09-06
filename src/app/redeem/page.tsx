"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfettiCelebration from "@/components/common/ConfettiCelebration";
import { useAuth } from "@/context/AuthContext";

export default function RedeemVoucherPage() {
  const router = useRouter();
  const { user, status: authStatus, refreshAuth } = useAuth();
  const authLoading = authStatus === "loading";
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    accessUntil?: string;
  } | null>(null);

  // Smart auto-formatter for voucher codes (e.g. converts "pnp xkjz 9192" or "pnpxkjz9192" to "PNP-XKJZ-9192")
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    // If user pasted raw without hyphens, auto-format to 3-4-4
    const cleanChars = raw.replace(/-/g, "");
    if (cleanChars.length > 7 && !raw.includes("-")) {
      raw = `${cleanChars.slice(0, 3)}-${cleanChars.slice(3, 7)}-${cleanChars.slice(7, 11)}`;
    }
    setCode(raw);
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/vouchers/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });
      const data = await res.json();
      setResult({
        success: res.ok,
        message: data.message || data.error,
        accessUntil: data.accessUntil,
      });
      if (res.ok) await refreshAuth("entitlement");
    } catch {
      setResult({ success: false, message: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-pulse text-slate-400 text-sm">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">🎟️</div>
          <h1 className="text-xl font-bold text-white mb-2">Redeem Your School Voucher</h1>
          <p className="text-slate-400 text-sm mb-6">
            You need to be logged in to redeem a voucher. Please log in or create a free
            account first.
          </p>
          <button
            onClick={() => router.push("/login?callbackUrl=/redeem")}
            className="w-full py-3 px-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold rounded-xl text-sm hover:opacity-90 transition-opacity"
          >
            Log In to Continue
          </button>
          <button
            onClick={() => router.push("/register?callbackUrl=/redeem")}
            className="w-full mt-3 py-3 px-6 bg-slate-800 text-slate-200 font-semibold rounded-xl text-sm hover:bg-slate-700 transition-colors"
          >
            Create Free Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12 relative">
      {result?.success && <ConfettiCelebration />}
      <div className="max-w-md w-full space-y-6">
        {/* Header card */}
        <div className="bg-gradient-to-br from-violet-900/40 to-indigo-900/40 border border-violet-500/30 rounded-2xl p-6 text-center">
          <div className="text-5xl mb-3">🎟️</div>
          <h1 className="text-2xl font-black text-white mb-1">Redeem School Voucher</h1>
          <p className="text-slate-400 text-sm">
            Enter the voucher code provided by your school, training center, or organization
            to unlock your premium access.
          </p>
        </div>

        {/* Redemption form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <form onSubmit={handleRedeem} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Your Voucher Code
              </label>
              <input
                type="text"
                value={code}
                onChange={handleCodeChange}
                placeholder="e.g. PNP-XKJZ-9192"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono text-lg tracking-widest placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-center"
                disabled={loading || result?.success}
                maxLength={20}
                autoFocus
              />
            </div>

            {result && (
              <div
                className={`rounded-xl px-4 py-3 text-sm font-medium border ${
                  result.success
                    ? "bg-emerald-900/40 border-emerald-500/40 text-emerald-300"
                    : "bg-red-900/40 border-red-500/40 text-red-300"
                }`}
              >
                {result.success ? "🎉 " : "❌ "}
                {result.message}
                {result.success && result.accessUntil && (
                  <div className="mt-1 text-xs text-emerald-400 font-mono">
                    Access until:{" "}
                    {new Date(result.accessUntil).toLocaleDateString("en-PH", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </div>
                )}
              </div>
            )}

            {!result?.success ? (
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="w-full py-3 px-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold rounded-xl text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Validating…
                  </span>
                ) : (
                  "Activate Voucher"
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="w-full py-3 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl text-sm hover:opacity-90 transition-opacity"
              >
                Go to My Dashboard →
              </button>
            )}
          </form>
        </div>

        {/* Help note */}
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-4 text-center">
          <p className="text-slate-500 text-xs">
            Voucher codes are provided by your institution or training center. If you have not
            received a code, please contact your administrator or instructor.
          </p>
          <p className="text-slate-600 text-xs mt-1">
            Logged in as{" "}
            <span className="text-slate-400 font-mono">{user.email}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
