"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface UserSession {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  isPaid: boolean;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserSession | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user) setUser(data.user);
        }
      } catch (err) {
        console.error("Sidebar auth check error:", err);
      }
    }
    fetchUser();
  }, [pathname]);

  const isPaid = user?.isPaid || user?.role === "ADMIN";

  const handlePayMongoCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/paymongo/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType: "6_MONTHS" }),
      });
      const data = await res.json();

      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert(data.error || "Failed to launch PayMongo checkout gateway.");
      }
    } catch (err) {
      console.error(err);
      alert("Error connecting to payment server.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: "📊", public: true },
    { href: "/exam", label: "Mock Exam", icon: "⏱️", public: false },
    { href: "/drills", label: "Speed Drills", icon: "⚡", public: false },
    { href: "/duels", label: "1v1 Duels", icon: "⚔️", public: false },
    { href: "/flashcards", label: "Flashcards", icon: "🎴", public: false },
    { href: "/bookmarks", label: "Bookmarks", icon: "🔖", public: false },
    { href: "/reviewer", label: "Study Notes", icon: "📝", public: false },
    { href: "/reading-materials", label: "Handbooks", icon: "📚", public: false },
  ];

  return (
    <aside className="hidden lg:flex w-64 bg-slate-950 border-r border-slate-800 text-white min-h-screen flex-col justify-between p-4 shrink-0">
      <div className="space-y-6">
        <div className="flex items-center gap-2.5 px-3 py-2">
          <span className="p-2 bg-blue-600 rounded-xl text-xs font-black">CSE</span>
          <div>
            <h2 className="font-black text-sm tracking-wide text-white">Platform</h2>
            <span className="text-[10px] text-slate-400 font-bold block">
              {isPaid ? "PRO Active" : "Free Preview"}
            </span>
          </div>
        </div>

        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const isExamRoute =
              item.href === "/exam" &&
              (pathname === "/exam" || pathname.startsWith("/mock-exam"));
            const isActive =
              isExamRoute ||
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));

            const canAccess = item.public || isPaid;

            if (canAccess) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                      : "text-slate-400 hover:text-white hover:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            }

            return (
              <button
                key={item.href}
                onClick={handlePayMongoCheckout}
                disabled={checkoutLoading}
                className="w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold text-slate-400 hover:text-amber-400 hover:bg-slate-900/80 transition text-left group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="opacity-70 group-hover:opacity-100">{item.icon}</span>
                  <span className="group-hover:text-white">{item.label}</span>
                </div>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
                  🔒 PRO
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {!isPaid && (
        <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-slate-900 border border-amber-500/30 p-4 rounded-3xl space-y-3 mt-6">
          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-md border border-amber-500/30 inline-block">
              Unlock Access
            </span>
            <h3 className="text-sm font-black text-white">Full Reviewer PRO</h3>
            <p className="text-[11px] text-slate-400 leading-tight">
              Get unlimited practice exams, handbooks, and study notes.
            </p>
          </div>

          <button
            onClick={handlePayMongoCheckout}
            disabled={checkoutLoading}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition shadow-md disabled:opacity-50"
          >
            {checkoutLoading ? "Connecting..." : "Unlock Access 💳"}
          </button>
        </div>
      )}
    </aside>
  );
}