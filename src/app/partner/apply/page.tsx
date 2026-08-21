// Relative Path: src/app/partner/apply/page.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Award,
  Sparkles,
  TrendingUp,
  DollarSign,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Users,
  Layers,
} from "lucide-react";

export default function PartnerApplyPage() {
  const [formData, setFormData] = useState({
    applicantName: "",
    organizationName: "",
    email: "",
    phone: "",
    type: "CONTENT_CREATOR",
    socialUrl: "",
    audienceSize: "10K - 50K followers",
    proposedSlug: "",
    pitchReason: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/partner/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setSuccess(true);
        setSuccessMsg(json.message);
      } else {
        setError(json.error || "Failed to submit application.");
      }
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-black text-slate-950 text-base shadow-lg shadow-emerald-500/20">
              G
            </div>
            <span className="font-extrabold text-base tracking-tight text-white">GovStudyX</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/partner/login"
              className="text-xs font-bold text-slate-300 hover:text-emerald-400 transition"
            >
              Already a Partner? Login ➔
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-14 space-y-10">
        {/* Header Hero */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-black uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Official Partner Program</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Partner with GovStudyX &amp; Empower Filipino CSE Reviewers
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Join content creators, review centers, and educational communities earning{" "}
            <strong className="text-emerald-400">10% – 20% recurring commission</strong> with their own
            co-branded landing page and dedicated live accounting portal.
          </p>
        </div>

        {/* 3 Pillar Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-white text-sm">High-Trust Co-Branding</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your custom URL (<code>govstudyx.com/p/your-name</code>) displays your official endorsement and verified trust seals.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-white text-sm">Live Accounting Portal</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Log in anytime to see real-time student enrollments, total revenue generated, and accrued commissions.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-white text-sm">Fast Cash Payouts</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Withdraw directly to GCash, Maya, or Philippine bank accounts with a low ₱150.00 minimum threshold.
            </p>
          </div>
        </div>

        {/* Application Form */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6">
          {success ? (
            <div className="py-12 text-center space-y-4 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto text-3xl">
                ✓
              </div>
              <h3 className="text-xl font-black text-white">Application Received!</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{successMsg}</p>
              <div className="pt-4">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition"
                >
                  <span>Return to Homepage</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-slate-800 pb-4">
                <h3 className="text-lg font-black text-white">Partner Application Form</h3>
                <p className="text-xs text-slate-400">
                  Please provide details about your community or channel. Applications are reviewed within 24–48 hours.
                </p>
              </div>

              {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold uppercase text-slate-400 mb-1">
                      Your Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Juan Dela Cruz"
                      value={formData.applicantName}
                      onChange={(e) => setFormData({ ...formData, applicantName: e.target.value })}
                      className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold uppercase text-slate-400 mb-1">
                      Page / Channel / Organization Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CSE Reviewers Philippines"
                      value={formData.organizationName}
                      onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                      className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold uppercase text-slate-400 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="your.email@gmail.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold uppercase text-slate-400 mb-1">
                      Mobile / WhatsApp / Viber Number
                    </label>
                    <input
                      type="text"
                      placeholder="09171234567"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold uppercase text-slate-400 mb-1">
                      Partner Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none"
                    >
                      <option value="CONTENT_CREATOR">Content Creator / Vlogger</option>
                      <option value="FACEBOOK_PAGE">Facebook Page / Group Admin</option>
                      <option value="SCHOOL">School / University Org</option>
                      <option value="HOST">Host / Event Collaborator</option>
                      <option value="AFFILIATE">Individual Educator / Reviewer</option>
                      <option value="OTHER">Other Organization</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold uppercase text-slate-400 mb-1">
                      Estimated Community Size
                    </label>
                    <select
                      value={formData.audienceSize}
                      onChange={(e) => setFormData({ ...formData, audienceSize: e.target.value })}
                      className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none"
                    >
                      <option value="Under 5K followers">Under 5,000 followers</option>
                      <option value="5K - 20K followers">5,000 – 20,000 followers</option>
                      <option value="20K - 100K followers">20,000 – 100,000 followers</option>
                      <option value="100K+ followers">100,000+ followers</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-400 mb-1">
                    Facebook Page / YouTube / TikTok Channel URL *
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://facebook.com/yourpage or https://youtube.com/@channel"
                    value={formData.socialUrl}
                    onChange={(e) => setFormData({ ...formData, socialUrl: e.target.value })}
                    className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-400 mb-1">
                    Desired Custom URL Slug (e.g. <code>govstudyx.com/p/your-slug</code>)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. prof-juan or cse-guide-ph"
                    value={formData.proposedSlug}
                    onChange={(e) => setFormData({ ...formData, proposedSlug: e.target.value })}
                    className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-xl font-mono text-emerald-300 outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-400 mb-1">
                    How do you plan to promote GovStudyX? (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Posting video tutorials on YouTube, sharing review items in our FB group of 40k CSE takers..."
                    value={formData.pitchReason}
                    onChange={(e) => setFormData({ ...formData, pitchReason: e.target.value })}
                    className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full sm:w-auto px-8 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black uppercase tracking-wider rounded-xl shadow-xl shadow-emerald-500/25 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <span>Submitting Application...</span>
                    ) : (
                      <>
                        <span>Submit Partner Application</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
