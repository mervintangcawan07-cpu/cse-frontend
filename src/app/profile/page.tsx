"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BadgeDisplay from "@/components/profile/BadgeDisplay";

interface UserProfile {
  name: string;
  email: string;
  role: string;
  isPaid: boolean;
  paidUntil?: string | null;
  planType?: string | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"account" | "achievements" | "subscription" | "faqs" | "about" | "terms">("account");

  // Form states
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updating, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // FAQ Expand state
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();

        if (res.ok && data.user) {
          setUser(data.user);
          setName(data.user.name || "");
        } else {
          router.push("/login");
        }
      } catch (err) {
        console.error("Failed to load user profile:", err);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [router]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match." });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "🎉 Profile updated successfully!" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        if (data.user) {
          setUser((prev) => (prev ? { ...prev, name: data.user.name } : null));
        }
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update profile." });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-20 text-center font-bold text-slate-400 animate-pulse">
        Loading User Profile & Account Settings...
      </div>
    );
  }

  // Calculate Subscription Days Remaining
  let daysRemaining: number | null = null;
  if (user?.paidUntil) {
    const diff = new Date(user.paidUntil).getTime() - new Date().getTime();
    daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  const faqs = [
    {
      q: "How does the Civil Service Exam Reviewer PRO Access work?",
      a: "PRO Access unlocks all practice mock exams, category speed drills, official PDF handbooks, and live study notes created specifically for Philippine Civil Service Exam examinees.",
    },
    {
      q: "Will my subscription automatically renew?",
      a: "No. We use PayMongo (GCash, PayMaya, Card, QRPH) for manual transparent payments. There are no surprise auto-debits when your access duration ends.",
    },
    {
      q: "How do I extend my active subscription?",
      a: "Simply choose a plan on your dashboard or in the Subscription tab. Any newly purchased duration will be automatically added onto your existing remaining days.",
    },
    {
      q: "Who do I contact for payment issues or account support?",
      a: "You can reach our official customer service team directly via email at support@cseonlinereview.com.",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6 text-slate-100">
      {/* HEADER BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-0.5 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
              User Account & Preferences
            </span>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
              user?.isPaid 
                ? "bg-amber-500/20 text-amber-400 border-amber-500/30" 
                : "bg-slate-800 text-slate-400 border-slate-700"
            }`}>
              {user?.isPaid ? "PRO Member" : "Free Preview"}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white mt-2">
            {user?.name || "My Account"}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>
        </div>

        <Link
          href="/dashboard"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700 shrink-0"
        >
          ← Return to Dashboard
        </Link>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800 text-xs font-bold">
        <button
          onClick={() => setActiveTab("account")}
          className={`px-4 py-2.5 rounded-xl transition shrink-0 ${
            activeTab === "account"
              ? "bg-blue-600 text-white shadow-md"
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          ⚙️ Account Settings
        </button>
        <button
          onClick={() => setActiveTab("subscription")}
          className={`px-4 py-2.5 rounded-xl transition shrink-0 ${
            activeTab === "subscription"
              ? "bg-blue-600 text-white shadow-md"
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          💳 My Subscription
        </button>
        <button
          onClick={() => setActiveTab("achievements")}
          className={`px-4 py-2.5 rounded-xl transition shrink-0 ${
            activeTab === "achievements"
              ? "bg-amber-500 text-slate-950 shadow-md font-black"
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          🏆 Achievements
        </button>
        <button
          onClick={() => setActiveTab("faqs")}
          className={`px-4 py-2.5 rounded-xl transition shrink-0 ${
            activeTab === "faqs"
              ? "bg-blue-600 text-white shadow-md"
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          ❓ FAQs & Support
        </button>
        <button
          onClick={() => setActiveTab("about")}
          className={`px-4 py-2.5 rounded-xl transition shrink-0 ${
            activeTab === "about"
              ? "bg-blue-600 text-white shadow-md"
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          ℹ️ About Platform
        </button>
        <button
          onClick={() => setActiveTab("terms")}
          className={`px-4 py-2.5 rounded-xl transition shrink-0 ${
            activeTab === "terms"
              ? "bg-blue-600 text-white shadow-md"
              : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          📜 Terms & Privacy
        </button>
      </div>

      {/* ALERT MESSAGE */}
      {message && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold border ${
            message.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* TAB 1: ACCOUNT SETTINGS (NAME & PASSWORD) */}
      {activeTab === "account" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6">
          <h2 className="text-lg font-black text-white">Profile & Security Settings</h2>

          <form onSubmit={handleProfileSubmit} className="space-y-6 max-w-2xl">
            {/* Change Profile Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:border-blue-500"
                placeholder="Your full name"
                required
              />
            </div>

            {/* Email (Read-Only) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 block">Email Address (Read-Only)</label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 cursor-not-allowed"
              />
            </div>

            <hr className="border-slate-800" />

            {/* Change Password */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-400">
                Change Account Password
              </h3>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:border-blue-500"
                  placeholder="Enter current password to authorize changes"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:border-blue-500"
                    placeholder="At least 6 characters"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:border-blue-500"
                    placeholder="Repeat new password"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={updating}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-lg transition disabled:opacity-50"
            >
              {updating ? "Saving Updates..." : "Save Profile & Password"}
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: MY SUBSCRIPTION */}
      {activeTab === "subscription" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h2 className="text-lg font-black text-white">Subscription Management</h2>
              <p className="text-xs text-slate-400 mt-1">
                View your active reviewer pass and extend your study duration.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition"
            >
              ➕ Add or Extend Subscription
            </Link>
          </div>

          <div className="p-6 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-400">Current Status:</span>
              <span className={`text-xs font-black uppercase px-3 py-1 rounded-full ${
                user?.isPaid ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-800 text-slate-400"
              }`}>
                {user?.isPaid ? "PRO Student Account Active" : "Free Preview Account"}
              </span>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-400">Active Access Duration:</span>
              <span className="text-sm font-black text-amber-400">
                {user?.isPaid && daysRemaining !== null 
                  ? `⏳ ${daysRemaining} Days Remaining` 
                  : user?.isPaid 
                    ? "⏳ Active Access" 
                    : "Locked"}
              </span>
            </div>

            {user?.paidUntil && (
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-slate-400">Access Expiration Date:</span>
                <span className="text-xs font-semibold text-slate-300">
                  {new Date(user.paidUntil).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: ACHIEVEMENTS & BADGES */}
      {activeTab === "achievements" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8">
          <BadgeDisplay />
        </div>
      )}

      {/* TAB 3: CUSTOMER SERVICE & FAQS */}
      {activeTab === "faqs" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6">
          <div>
            <h2 className="text-lg font-black text-white">Frequently Asked Questions</h2>
            <p className="text-xs text-slate-400 mt-1">
              Find answers to common questions regarding review materials and payments.
            </p>
          </div>

          {/* Customer Service Banner */}
          <div className="p-5 bg-blue-600/10 border border-blue-500/30 rounded-2xl flex items-center justify-between flex-wrap gap-4">
            <div>
              <span className="text-[10px] font-black uppercase text-blue-400 block">Customer Service Support</span>
              <span className="text-sm font-extrabold text-white">Need help or extended support?</span>
              <p className="text-xs text-slate-400 mt-0.5">Email us anytime at: <span className="text-blue-400 font-bold">support@cseonlinereview.com</span></p>
            </div>
            <a
              href="mailto:support@cseonlinereview.com"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition"
            >
              ✉️ Contact Customer Service
            </a>
          </div>

          {/* Accordion List */}
          <div className="space-y-3 pt-2">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden transition"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full text-left p-4 flex justify-between items-center text-xs font-bold text-white hover:text-blue-400 transition"
                >
                  <span>{faq.q}</span>
                  <span className="text-slate-400 text-base">{openFaq === idx ? "−" : "+"}</span>
                </button>
                {openFaq === idx && (
                  <div className="p-4 pt-0 text-xs text-slate-400 leading-relaxed border-t border-slate-800/40">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: ABOUT PLATFORM */}
      {activeTab === "about" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-4">
          <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
            About CSE Reviewer
          </span>
          <h2 className="text-xl font-black text-white">Comprehensive Philippine Civil Service Review Platform</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            CSE Reviewer is an interactive web-based exam prep platform designed to help examinees pass both the Professional and Sub-Professional Philippine Civil Service Examinations (CSC).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
              <h4 className="text-xs font-bold text-blue-400">⚡ Timed Mock Exams</h4>
              <p className="text-[11px] text-slate-400 mt-1">Full-length timed examinations simulating actual Civil Service Commission standards.</p>
            </div>
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
              <h4 className="text-xs font-bold text-emerald-400">🎯 Category Speed Drills</h4>
              <p className="text-[11px] text-slate-400 mt-1">5-minute rapid drills to master Verbal Ability, Numerical Reasoning, and General Info.</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: TERMS & PRIVACY POLICY */}
      {activeTab === "terms" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-4">
          <h2 className="text-lg font-black text-white">Terms of Service & Privacy Policy</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            By creating an account and utilizing CSE Reviewer services, you agree to the following terms and guidelines:
          </p>

          <div className="space-y-3 pt-2 text-xs text-slate-300 leading-relaxed">
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
              <h4 className="font-bold text-white">1. Account Security & Usage</h4>
              <p className="text-slate-400 text-[11px]">
                Accounts are registered to individual reviewees. Sharing accounts across multiple devices simultaneously may result in session invalidation.
              </p>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
              <h4 className="font-bold text-white">2. Payments & Access Duration</h4>
              <p className="text-slate-400 text-[11px]">
                All subscription passes (1-Month, 6-Month, 1-Year) grant non-transferable access for the specified duration from the payment confirmation date.
              </p>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
              <h4 className="font-bold text-white">3. Privacy & Data Protection</h4>
              <p className="text-slate-400 text-[11px]">
                We respect your personal privacy. User credentials and study progress metrics are stored securely and never shared with third parties.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}