// Relative Path: src/app/terms/referral/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/config/site";
import { ShieldCheck, Gift, Clock, Wallet, AlertTriangle, Scale, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: `Referral & Reward Program Terms | ${siteConfig.name}`,
  description: `Official terms, calculation rules, holding periods, and payout guidelines for the ${siteConfig.name} Referral & Reward Program.`,
  alternates: {
    canonical: `${siteConfig.url}/terms/referral`,
  },
};

export default function ReferralTermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 py-10 px-4 sm:px-6 lg:px-8 text-slate-100">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <Link href="/" className="hover:text-emerald-400 transition">
            Home
          </Link>
          <span>/</span>
          <Link href="/terms" className="hover:text-emerald-400 transition">
            Terms
          </Link>
          <span>/</span>
          <span className="text-white">Referral Program Terms</span>
        </div>

        {/* Header Card */}
        <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-indigo-950/80 rounded-3xl p-6 sm:p-10 border border-emerald-500/20 shadow-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-black uppercase tracking-wider">
            <Gift className="w-3.5 h-3.5" />
            <span>Official Policy</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Referral &amp; Reward Program Terms
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            These terms govern the participation of registered students and educators in the GovStudyX Referral &amp; Reward Program.
          </p>
          <div className="flex flex-wrap gap-4 text-xs text-slate-400 border-t border-slate-800/80 pt-4 font-mono">
            <span><strong>Effective Date:</strong> {siteConfig.effectiveDate}</span>
            <span>&bull;</span>
            <span><strong>Default Reward:</strong> 20.0% Cash Reward</span>
            <span>&bull;</span>
            <span><strong>Holding Period:</strong> 7 Days</span>
          </div>
        </div>

        {/* Core Rules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase">
              <CheckCircle2 className="w-4 h-4" />
              <span>Reward Calculation Base</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Rewards are calculated from the <strong>actual verified payment amount paid by the customer</strong> for qualifying Premium Reviewer passes. <strong>PayMongo payment processing fees are NOT deducted</strong> from your reward base.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase">
              <Clock className="w-4 h-4" />
              <span>7-Day Verification Holding Period</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Earned rewards enter a <strong>7-day holding period</strong> upon payment confirmation. Once this period elapses without a refund or payment dispute, the balance transitions to <strong>AVAILABLE</strong> for withdrawal.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase">
              <Wallet className="w-4 h-4" />
              <span>₱150.00 Minimum Payout</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              The minimum payout threshold is <strong>₱150.00 PHP</strong>. Withdrawals are processed via GCash, Maya, or Philippine Domestic Bank Transfer within 1–3 business days.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase">
              <ShieldCheck className="w-4 h-4" />
              <span>30-Day Attribution Window</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              When a visitor clicks your referral link, attribution persists for <strong>30 days</strong>. Once the referred student registers their account, the referral relationship is permanently locked.
            </p>
          </div>
        </div>

        {/* Detailed Sections */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 space-y-8 text-sm text-slate-300 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs">1</span>
              <span>Eligibility and Account Standing</span>
            </h2>
            <p>
              To participate in the program, referrers must have an active, verified account in good standing. GovStudyX reserves the right to withhold rewards or suspend referral privileges for accounts involved in terms violations, bot traffic, automated spamming, or fraudulent activity.
            </p>
          </section>

          <section className="space-y-3 border-t border-slate-800 pt-6">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs">2</span>
              <span>Discounts and Promotional Pricing</span>
            </h2>
            <p>
              If a referred user purchases a discounted or promotional pass (e.g. ₱199 instead of ₱299 list price), the referral reward is calculated solely on the discounted purchase amount actually collected (₱199 $\times$ 20% = ₱39.80).
            </p>
          </section>

          <section className="space-y-3 border-t border-slate-800 pt-6">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs">3</span>
              <span>Refunds, Chargebacks, and Reward Reversals</span>
            </h2>
            <p>
              If a referred customer requests a refund or initiates a payment chargeback within the statutory or platform refund period, the associated referral reward is reversed from the financial ledger. Historical records are preserved for accounting audit purposes.
            </p>
          </section>

          <section className="space-y-3 border-t border-slate-800 pt-6">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs">4</span>
              <span>Self-Referral and Abuse Prohibition</span>
            </h2>
            <p>
              Self-referrals (including creating duplicate accounts, using alias emails, or redeeming your own referral code) are strictly prohibited and automatically detected by our anti-fraud engine. Violations will result in the immediate forfeiture of unreleased rewards.
            </p>
          </section>

          <section className="space-y-3 border-t border-slate-800 pt-6">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs">5</span>
              <span>Historical Rate Immutability</span>
            </h2>
            <p>
              When an administrator modifies the standard referral reward percentage (e.g., from 20% to 25%), rewards earned prior to the change remain permanently locked to the rate in effect at the moment of the qualifying transaction.
            </p>
          </section>
        </div>

        {/* Back Link */}
        <div className="text-center pt-4">
          <Link href="/referrals" className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-black text-xs uppercase tracking-wider">
            <span>Back to User Referral Dashboard ➔</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
