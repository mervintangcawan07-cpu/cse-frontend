import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: `Refund Policy | ${siteConfig.name}`,
  description: `Learn how refund requests, duplicate payments, and billing inquiries are handled on ${siteConfig.name} (${siteConfig.domain}).`,
  alternates: {
    canonical: `${siteConfig.url}/refund`,
  },
};

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb & Navigation */}
        <div className="mb-6 flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link href="/" className="hover:text-blue-600 transition">
            Home
          </Link>
          <span>/</span>
          <span className="text-slate-900">Refund Policy</span>
        </div>

        {/* Header Banner */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-xs mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-black uppercase tracking-wider mb-4">
            <span>💳 Billing &amp; Refunds</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Refund Policy
          </h1>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500 font-medium border-t border-slate-100 pt-3">
            <span><strong>Effective Date:</strong> {siteConfig.effectiveDate}</span>
            <span>&bull;</span>
            <span><strong>Last Updated:</strong> {siteConfig.lastUpdated}</span>
            <span>&bull;</span>
            <span><strong>Platform:</strong> {siteConfig.domain}</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-xs space-y-8 text-slate-700 text-sm leading-relaxed">
          <section className="space-y-3">
            <p className="font-medium">
              This Refund Policy outlines how refund requests, billing errors, and payment issues are handled for digital passes and services purchased through <strong>{siteConfig.name}</strong> ({siteConfig.domain}).
            </p>
            <p className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 text-xs text-emerald-950 font-medium">
              Please review this policy before purchasing a PRO Reviewer Pass.
            </p>
          </section>

          {/* Section 1 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs">1</span>
              What You Are Purchasing
            </h2>
            <p>
              When you purchase a PRO pass on {siteConfig.name}, you are purchasing temporary, direct digital access to premium educational features:
            </p>
            <ul className="list-disc list-inside text-xs space-y-1 text-slate-600 pl-2">
              <li>Full 170-item timed mock examination sets with category breakdowns</li>
              <li>Complete step-by-step rationalizations, elimination hints, and traps</li>
              <li>Smart elimination drills and interactive flashcards</li>
              <li>Personalized mistake notebook and weak-topic analysis</li>
              <li>Collaborative Study Together rooms and virtual whiteboard tools</li>
            </ul>
            <p className="text-xs text-slate-500">
              The exact pricing, included benefits, and access duration are clearly presented before you complete checkout.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs">2</span>
              Digital Access Nature
            </h2>
            <p>
              Because premium access unlocks instantaneous access to proprietary educational materials and question banks, refunds are generally not granted merely because a user changes their mind or no longer wishes to study after substantial access has occurred, subject to applicable Philippine consumer protection laws.
            </p>
            <p className="font-semibold text-xs text-slate-800">
              However, we review all genuine, legitimate refund requests fairly and transparently.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs">3</span>
              Eligible Circumstances for Refund Review
            </h2>
            <p>You may request a refund under the following verified circumstances:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="font-extrabold text-slate-900">1. Duplicate Charges</span>
                <p className="text-slate-600">You were charged more than once for the same upgrade transaction.</p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="font-extrabold text-slate-900">2. Activation Failure</span>
                <p className="text-slate-600">Payment succeeded at the gateway but your PRO access was not activated after verification.</p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="font-extrabold text-slate-900">3. Major Technical Inaccessibility</span>
                <p className="text-slate-600">A persistent server failure prevented access to purchased materials and could not be resolved in a timely manner.</p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="font-extrabold text-slate-900">4. Processing Errors</span>
                <p className="text-slate-600">The transaction was processed with an incorrect amount due to a technical error.</p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs">4</span>
              Duplicate Payments
            </h2>
            <p>
              If a network glitch or multiple button clicks caused duplicate payments for the same pass, please email us with:
            </p>
            <ul className="list-disc list-inside text-xs space-y-1 text-slate-600 pl-2">
              <li>Account email address</li>
              <li>Transaction reference IDs from PayMongo / GCash / Maya</li>
              <li>Date and time of transactions</li>
              <li>Amounts debited</li>
            </ul>
            <p className="text-xs text-slate-600 font-medium">
              Upon confirmation, we will promptly refund duplicate charges via the original payment channel.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs">5</span>
              Technical Problems &amp; Resolution First
            </h2>
            <p>
              If you experience trouble accessing your PRO pass after purchase, please contact our support team first before disputing the charge. We will prioritize resolving the issue by:
            </p>
            <ul className="list-disc list-inside text-xs space-y-1 text-slate-600 pl-2">
              <li>Manually syncing the PayMongo webhook transaction to your account</li>
              <li>Extending your PRO access period to compensate for any downtime</li>
              <li>Fixing any browser/session cache synchronization issues</li>
            </ul>
            <p className="text-xs text-slate-500">
              If the technical problem cannot be resolved within a reasonable timeframe, a full refund will be granted.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs">6</span>
              Refund Request Process
            </h2>
            <p>To submit a refund request, send an email to <a href={`mailto:${siteConfig.emails.support}`} className="text-emerald-600 underline font-bold">{siteConfig.emails.support}</a> with the following details:</p>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-mono text-slate-800 space-y-1">
              <p>Subject: Refund Request - [Your Registered Email]</p>
              <p>1. Registered Email Address</p>
              <p>2. Transaction Reference Number (from PayMongo / GCash receipt)</p>
              <p>3. Date and Amount of Purchase</p>
              <p>4. Reason for Refund Request</p>
              <p>5. Attached Screenshot / Payment Confirmation (if available)</p>
            </div>
          </section>

          {/* Section 7 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs">7</span>
              Evaluation &amp; Processing
            </h2>
            <p>
              Every request is evaluated individually based on activity logs, transaction verification, and applicable terms. You will receive an email response regarding the outcome of your request within 1 to 3 business days.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs">8</span>
              Payment Provider Timeframes
            </h2>
            <p>
              Approved refunds are credited back via PayMongo to the originating payment method (e.g. GCash wallet, Maya, credit/debit card). Actual posting times depend on your bank or e-wallet issuer (typically 1–5 business days for e-wallets, 5–15 days for bank cards).
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs">9</span>
              Unauthorized or Fraudulent Activity
            </h2>
            <p>
              If you suspect an unauthorized charge was made on your card or e-wallet on our platform, please notify us immediately at <a href={`mailto:${siteConfig.emails.billing}`} className="text-emerald-600 underline font-bold">{siteConfig.emails.billing}</a> so we can block the fraudulent account and assist in reversing the charge.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs">10</span>
              Policy Updates
            </h2>
            <p>
              We may update this Refund Policy to reflect adjustments in payment processor terms or statutory requirements. Changes become effective upon publication on this page.
            </p>
          </section>

          {/* Section 11 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs">11</span>
              Contact Support
            </h2>
            <p>For refund questions, payment verification, or billing assistance, please reach out to:</p>
            <div className="p-5 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 text-xs text-slate-800 space-y-1.5">
              <p className="font-black text-sm text-slate-900">{siteConfig.name} Billing Support</p>
              <p><strong>Website:</strong> <a href={siteConfig.url} className="text-emerald-700 underline font-semibold">{siteConfig.domain}</a></p>
              <p><strong>Email:</strong> <a href={`mailto:${siteConfig.emails.support}`} className="text-emerald-700 underline font-semibold">{siteConfig.emails.support}</a></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
