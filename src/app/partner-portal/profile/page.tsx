// Relative Path: src/app/partner-portal/profile/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Building2,
  Mail,
  Phone,
  Globe,
  Award,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Save,
} from "lucide-react";
import PartnerPortalNav from "@/components/partner/PartnerPortalNav";

export default function PartnerProfilePage() {
  const router = useRouter();
  const [partner, setPartner] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Form State
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/partner/portal/profile");
      if (res.status === 401) {
        router.push("/partner-portal/login");
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setPartner(json.partner);
        setContactName(json.partner.contactName || "");
        setContactPhone(json.partner.contactPhone || "");
        setTagline(json.partner.tagline || "");
        setDescription(json.partner.description || "");
        setFacebookUrl(json.partner.facebookUrl || "");
        setWebsiteUrl(json.partner.websiteUrl || "");
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const res = await fetch("/api/partner/portal/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName,
          contactPhone,
          tagline,
          description,
          facebookUrl,
          websiteUrl,
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setSaveError(json.error || "Failed to update profile.");
      }
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Loading partner profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PartnerPortalNav partner={partner} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <User className="w-6 h-6 text-emerald-400" />
            <span>Partner Account Profile</span>
          </h1>
          <p className="text-xs text-slate-400">
            View partner organization metadata and customize your contact details.
          </p>
        </div>

        {/* Read-Only Agreement Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400" />
              <span>Official Agreement Details</span>
            </h3>
            <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-black uppercase">
              {partner?.status}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">Partner ID</span>
              <div className="font-mono font-black text-emerald-400 text-sm">{partner?.partnerId}</div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">Partner Type</span>
              <div className="font-bold text-white text-sm">{partner?.type}</div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">Commission Rate</span>
              <div className="font-mono font-black text-purple-400 text-sm">{partner?.commissionRate}%</div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">Holding Period</span>
              <div className="font-mono font-bold text-amber-400 text-sm">{partner?.holdingPeriodDays} Days</div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Note: Commission models and agreement rates are determined by GovStudyX Finance Administration and cannot be modified directly.
          </p>
        </div>

        {/* Editable Profile Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-black text-white">Contact &amp; Public Information</h3>
            <p className="text-xs text-slate-400">
              Update your liaison name, contact phone, and public partner landing details.
            </p>
          </div>

          {saveSuccess && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>Profile information updated successfully!</span>
            </div>
          )}

          {saveError && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-semibold text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold uppercase text-slate-400 mb-1">Partner / Organization Name</label>
                <input
                  type="text"
                  disabled
                  value={partner?.name || ""}
                  className="w-full p-3 bg-slate-950/50 border border-slate-800 rounded-xl text-slate-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-400 mb-1">Registered Contact Email</label>
                <input
                  type="email"
                  disabled
                  value={partner?.contactEmail || ""}
                  className="w-full p-3 bg-slate-950/50 border border-slate-800 rounded-xl text-slate-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-400 mb-1">Contact Person / Liaison</label>
                <input
                  type="text"
                  placeholder="Primary contact name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-400 mb-1">Contact Mobile / Phone</label>
                <input
                  type="text"
                  placeholder="e.g. +63 917 123 4567"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold uppercase text-slate-400 mb-1">Tagline</label>
                <input
                  type="text"
                  placeholder="e.g. Leading Civil Service Exam Community in the Philippines"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold uppercase text-slate-400 mb-1">Description / Bio</label>
                <textarea
                  rows={3}
                  placeholder="Short description displayed on your dedicated partner landing page"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-400 mb-1">Facebook Page / Group URL</label>
                <input
                  type="url"
                  placeholder="https://facebook.com/..."
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-400 mb-1">Official Website URL</label>
                <input
                  type="url"
                  placeholder="https://yourwebsite.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? "Saving Changes..." : "Save Profile Details"}</span>
              </button>
            </div>
          </form>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-slate-600 border-t border-slate-900">
        &copy; {new Date().getFullYear()} GovStudyX Partner Portal. Protected by enterprise security.
      </footer>
    </div>
  );
}
