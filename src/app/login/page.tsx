// Relative Path: src/app/login/page.tsx
"use client";

import { useState, Suspense, type SyntheticEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import bgImage from "@/app/image-final.webp";

interface AuthUser {
  name?: string;
  email?: string;
  role?: string;
}

interface LoginApiResponse {
  success?: boolean;
  user?: AuthUser;
  unverified?: boolean;
  email?: string;
  error?: string;
}

interface ResendVerificationApiResponse {
  success?: boolean;
  error?: string;
}

function LoginFormInner() {
  const searchParams = useSearchParams();
  const isKicked =
    searchParams.get("kicked") === "true" || searchParams.get("kicked") === "1";

  // Deep linking: supports ?redirect=... from proxy.ts with open-redirect protection
  const redirectParam = searchParams.get("redirect")?.trim() || "";
  const isSafeRelativeRedirect =
    redirectParam.startsWith("/") && !redirectParam.startsWith("//");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUnverified, setIsUnverified] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const handleLogin = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);
    setIsUnverified(false);
    setResendMessage(null);

    const cleanEmail = email.trim().toLowerCase();

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const data: LoginApiResponse = await res.json();

      // Handle Unverified Email Gate (403 Status)
      if (res.status === 403 && data.unverified) {
        setIsUnverified(true);
        setUnverifiedEmail(data.email || cleanEmail);
        setError("Please verify your email address before logging in.");
        return;
      }

      if (res.ok) {
        if (data.user?.name) {
          localStorage.setItem("cse_user_name", data.user.name);
        }

        // Full window navigation guarantees newly issued cookie is attached to server requests
        const fallbackTarget =
          data.user?.role === "ADMIN" ? "/admin/questions" : "/dashboard";
        const targetUrl = isSafeRelativeRedirect
          ? redirectParam
          : fallbackTarget;

        window.location.href = targetUrl;
      } else {
        setError(data.error || "Invalid email or password.");
      }
    } catch (err: unknown) {
      console.error("Login authentication error:", err);
      setError("Failed to connect to authentication server.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (resending) return;

    setResending(true);
    setResendMessage(null);

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: unverifiedEmail.trim().toLowerCase() }),
      });

      const data: ResendVerificationApiResponse = await res.json();
      if (res.ok && data.success) {
        setResendMessage(
          "A new verification link has been sent to your email!"
        );
      } else {
        setResendMessage(data.error || "Failed to resend link.");
      }
    } catch (err: unknown) {
      console.error("Resend verification email error:", err);
      setResendMessage("Failed to connect to email server.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="relative z-10 w-full max-w-md md:max-w-[560px] -translate-y-4 md:-translate-y-8 transition-transform">
            {/* AMBIENT GLOW BACKDROP AURA (Soft glow framing the card) */}
      <div
        className="absolute -inset-1 md:-inset-1.5 rounded-[2.2rem] bg-gradient-to-r from-blue-600/30 via-indigo-500/20 to-amber-500/20 blur-xl md:blur-2xl opacity-75 animate-pulse -z-10 pointer-events-none"
        aria-hidden="true"
      />

      {/* Main Frosted Translucent Glass Card */}
      <div className="relative bg-slate-950/50 md:bg-slate-950/55 backdrop-blur-2xl border border-white/20 rounded-3xl p-7 sm:p-9 md:p-12 space-y-6 md:space-y-7 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.85),0_0_35px_-5px_rgba(59,130,246,0.2)] ring-1 ring-white/10 animate-in fade-in zoom-in-[0.98] slide-in-from-bottom-2 duration-500 ease-out">
        
        {/* Centered Internal Header Block */}
        <div className="text-center flex flex-col items-center space-y-2 md:space-y-2.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 md:px-3.5 md:py-1.5 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-300 text-[10px] md:text-xs font-black uppercase tracking-wider shadow-[0_0_15px_rgba(59,130,246,0.3)] backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
            <span>Welcome Back</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight drop-shadow-md">
            Sign In to Your Account
          </h1>
          <p className="text-xs md:text-sm text-slate-200/90 font-medium max-w-sm drop-shadow-sm">
            Access your mock exams, drills, and study analytics.
          </p>
        </div>

        {/* Kicked Security Alert */}
        {isKicked && (
          <div className="p-4 md:p-5 bg-amber-500/15 border border-amber-500/40 backdrop-blur-md rounded-2xl flex items-start gap-3 md:gap-4 animate-in fade-in slide-in-from-top-2 duration-300 text-left shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <span className="text-amber-400 text-lg md:text-xl leading-none mt-0.5">
              ⚠️
            </span>
            <div className="text-xs md:text-sm space-y-1">
              <p className="font-extrabold text-amber-300">
                Signed out on this device
              </p>
              <p className="text-slate-200 leading-relaxed font-medium">
                Your account was accessed from another device. To protect account
                security, your previous session was concluded.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 md:space-y-5 text-left">
          {/* Email Input Field */}
          <div className="space-y-1.5 md:space-y-2">
            <label
              htmlFor="login-email"
              className="block text-[11px] md:text-xs font-bold uppercase tracking-wider text-slate-200 drop-shadow-sm"
            >
              Email Address
            </label>
            <div className="relative group">
              <span className="absolute inset-y-0 left-0 pl-3.5 md:pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-400 transition-colors">
                <svg
                  className="w-4 h-4 md:w-5 md:h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                  />
                </svg>
              </span>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                placeholder="juan@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 md:pl-12 pr-4 py-3.5 md:py-4 bg-slate-950/60 backdrop-blur-md border border-white/15 rounded-xl md:rounded-2xl text-sm md:text-base text-white placeholder-slate-400 outline-none transition duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/40 focus:bg-slate-950/80 focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] font-medium"
              />
            </div>
          </div>

          {/* Password Input Field */}
          <div className="space-y-1.5 md:space-y-2">
            <div className="flex justify-between items-center">
              <label
                htmlFor="login-password"
                className="block text-[11px] md:text-xs font-bold uppercase tracking-wider text-slate-200 drop-shadow-sm"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs md:text-sm text-blue-400 hover:text-blue-300 font-bold transition hover:underline underline-offset-4"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative group">
              <span className="absolute inset-y-0 left-0 pl-3.5 md:pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-400 transition-colors">
                <svg
                  className="w-4 h-4 md:w-5 md:h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </span>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 md:pl-12 pr-11 md:pr-12 py-3.5 md:py-4 bg-slate-950/60 backdrop-blur-md border border-white/15 rounded-xl md:rounded-2xl text-sm md:text-base text-white placeholder-slate-400 outline-none transition duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/40 focus:bg-slate-950/80 focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3.5 md:pr-4 flex items-center text-slate-400 hover:text-slate-200 transition cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg
                    className="w-4 h-4 md:w-5 md:h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4 md:w-5 md:h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div
              role="alert"
              className="p-3.5 md:p-4 bg-rose-500/20 border border-rose-500/40 backdrop-blur-md text-rose-200 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold flex items-center gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200 shadow-[0_0_15px_rgba(244,63,94,0.25)]"
            >
              <span className="shrink-0 text-sm md:text-base">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Unverified Email Action Banner */}
          {isUnverified && (
            <div className="p-4 md:p-5 bg-amber-500/15 border border-amber-500/35 backdrop-blur-md rounded-2xl space-y-3 animate-in fade-in duration-200">
              <p className="text-xs md:text-sm text-amber-200 font-medium leading-relaxed">
                📩 We sent a verification link to{" "}
                <strong className="text-white">{unverifiedEmail}</strong>.
                Please check your inbox and confirm your address to log in.
              </p>
              <button
                type="button"
                onClick={() => void handleResendVerification()}
                disabled={resending}
                className="w-full py-2.5 md:py-3 bg-amber-500/25 hover:bg-amber-500/35 border border-amber-500/40 text-amber-200 font-bold text-xs md:text-sm rounded-xl md:rounded-2xl transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                {resending ? (
                  <>
                    <svg
                      className="animate-spin h-3.5 w-3.5 md:h-4 md:w-4 text-amber-200"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
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
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Sending New Link...</span>
                  </>
                ) : (
                  <span>🔄 Resend Verification Email</span>
                )}
              </button>
            </div>
          )}

          {/* Resend Success Message */}
          {resendMessage && (
            <div className="p-3.5 md:p-4 bg-emerald-500/20 border border-emerald-500/40 backdrop-blur-md text-emerald-200 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.25)]">
              <span>✓</span>
              <span>{resendMessage}</span>
            </div>
          )}

          {/* Glowing Primary Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 md:py-4.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:via-indigo-500 hover:to-blue-600 active:scale-[0.98] text-white font-black text-sm md:text-base rounded-xl md:rounded-2xl shadow-[0_0_30px_rgba(59,130,246,0.35)] border border-blue-400/30 transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-2 min-h-[48px] md:min-h-[56px] hover:shadow-[0_0_40px_rgba(59,130,246,0.55)]"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 md:h-5 md:w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <span>&rarr;</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Navigation */}
        <div className="text-center pt-3 md:pt-4 border-t border-white/10 space-y-3">
          <p className="text-xs md:text-sm text-slate-300 font-medium drop-shadow-sm">
            {"Don't have an account? "}
            <Link
              href="/signup"
              className="text-amber-400 hover:text-amber-300 font-bold transition underline underline-offset-4 hover:drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]"
            >
              Register here
            </Link>
          </p>

          <div className="flex justify-center items-center gap-3 text-[11px] md:text-xs font-medium text-slate-400">
            <Link href="/terms" className="hover:text-white transition">
              Terms
            </Link>
            <span>&bull;</span>
            <Link href="/privacy" className="hover:text-white transition">
              Privacy
            </Link>
            <span>&bull;</span>
            <Link href="/contact" className="hover:text-white transition">
              Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-slate-950 flex items-center justify-center p-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center text-slate-400 text-sm font-bold animate-pulse">
            Loading secure sign-in...
          </div>
        </div>
      }
    >
      <main className="relative min-h-[100dvh] bg-slate-950 flex items-center justify-center p-4 sm:p-6 md:p-10 overflow-hidden">
        {/* Fullscreen Photo Background with Cinematic Contrast Overlays */}
        <div className="absolute inset-0 w-full h-full z-0 pointer-events-none">
          <Image
            src={bgImage}
            alt="Candidate study journey towards passing the Civil Service examination"
            fill
            priority
            quality={75}
            sizes="100vw"
            className="object-cover object-[72%_center] sm:object-center"
          />
          {/* Multi-stage depth gradient ensuring high contrast for text while showing the mountain landscape */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/75 via-slate-950/55 to-slate-950/90" />
          <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px]" />
        </div>

        {/* Ambient Radial Glow Lighting */}
        <div className="absolute top-1/4 -left-20 md:-left-10 w-96 md:w-[540px] h-96 md:h-[540px] bg-blue-600/20 rounded-full blur-[130px] md:blur-[170px] pointer-events-none animate-pulse duration-1000 z-1" />
        <div className="absolute bottom-1/4 -right-20 md:-right-10 w-96 md:w-[540px] h-96 md:h-[540px] bg-indigo-600/20 rounded-full blur-[130px] md:blur-[170px] pointer-events-none animate-pulse duration-700 z-1" />

        <LoginFormInner />
      </main>
    </Suspense>
  );
}