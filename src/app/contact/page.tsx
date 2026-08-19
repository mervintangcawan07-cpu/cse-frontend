import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: `Contact Us | ${siteConfig.name}`,
  description: `Get in touch with the ${siteConfig.name} (${siteConfig.domain}) support team for account help, payment verification, refund requests, privacy questions, or general inquiries.`,
  alternates: {
    canonical: `${siteConfig.url}/contact`,
  },
};

export default function ContactPage() {
  const contactChannels = [
    {
      title: "Account & Technical Support",
      icon: "🛠️",
      description: "Assistance with logins, passwords, question display, mock exam timers, or technical errors.",
      email: siteConfig.emails.support,
      subject: "[Account Support] Issue Description",
    },
    {
      title: "Payment & PRO Pass Activation",
      icon: "💳",
      description: "Assistance verifying PayMongo, GCash, Maya, or Card transactions and activating PRO reviewer passes.",
      email: siteConfig.emails.billing,
      subject: "[Payment Verification] Transaction Reference",
    },
    {
      title: "Refund Requests",
      icon: "🧾",
      description: "Review of duplicate payments or technical issues. Please consult our Refund Policy before filing.",
      email: siteConfig.emails.billing,
      subject: "[Refund Request] Order Details",
    },
    {
      title: "Privacy & Data Subject Rights",
      icon: "🛡️",
      description: "Requests for data access, profile correction, account deletion, or cookie inquiries under the Philippine DPA.",
      email: siteConfig.emails.privacy,
      subject: "[Privacy Inquiry] Data Request",
    },
    {
      title: "General Inquiries & Suggestions",
      icon: "💡",
      description: "Feedback on question quality, reviewer suggestions, partnerships, or general questions.",
      email: siteConfig.emails.general,
      subject: "[General Inquiry] Hello GovStudyX Team",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link href="/" className="hover:text-blue-600 transition">
            Home
          </Link>
          <span>/</span>
          <span className="text-slate-900">Contact Us</span>
        </div>

        {/* HERO BANNER */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-xs space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-xs font-black uppercase tracking-wider">
            <span>📫 We&apos;re Here to Help</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Contact {siteConfig.name}
          </h1>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-medium">
            Have questions about your reviewer pass, mock exam scoring, account access, or educational features? Reach out directly to our dedicated support team.
          </p>
        </div>

        {/* IN-APP TICKET SYSTEM BANNER */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-md flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center sm:text-left">
            <span className="px-2.5 py-0.5 bg-blue-500/30 border border-blue-400/40 text-blue-200 text-[10px] font-black uppercase rounded-full">
              Registered Examinees
            </span>
            <h2 className="text-xl sm:text-2xl font-black">Student Support Ticket Portal</h2>
            <p className="text-xs text-blue-100 max-w-lg leading-relaxed">
              Already have an active account? You can submit and track support tickets directly inside your dashboard.
            </p>
          </div>
          <Link
            href="/support"
            className="shrink-0 px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg transition text-center w-full sm:w-auto"
          >
            Open Ticket Portal →
          </Link>
        </div>

        {/* DIRECT EMAIL DIRECTORY */}
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-black text-slate-900">Direct Email Channels</h2>
            <p className="text-xs text-slate-500 font-medium">
              Choose the category that matches your inquiry to help us route your message faster.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contactChannels.map((c, i) => (
              <div
                key={i}
                className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-4 hover:border-blue-300 transition"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{c.icon}</span>
                    <h3 className="font-extrabold text-sm text-slate-900">{c.title}</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    {c.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <a
                    href={`mailto:${c.email}?subject=${encodeURIComponent(c.subject)}`}
                    className="inline-flex items-center gap-2 text-xs font-extrabold text-blue-600 hover:text-blue-800 transition"
                  >
                    <span>Email {c.email}</span>
                    <span>&rarr;</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TIPS BEFORE CONTACTING */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-4">
          <h2 className="text-lg font-black text-slate-900">Tips for Faster Resolution</h2>
          <p className="text-xs text-slate-600 font-medium leading-relaxed">
            When reporting an issue or inquiring about an order, including the following details helps us resolve your request quickly:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700 font-medium">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex items-start gap-2">
              <span className="text-blue-600 font-black">1.</span>
              <span>Your registered account email address</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex items-start gap-2">
              <span className="text-blue-600 font-black">2.</span>
              <span>PayMongo or GCash transaction reference number (for billing)</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex items-start gap-2">
              <span className="text-blue-600 font-black">3.</span>
              <span>The device type (PC, Android, iPhone, Tablet) and browser used</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex items-start gap-2">
              <span className="text-blue-600 font-black">4.</span>
              <span>Screenshot or description of the error message displayed</span>
            </div>
          </div>

          <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-xs text-rose-900 font-semibold">
            🔒 Security Notice: Never include your password, complete card number, or OTP security codes in email messages.
          </div>
        </div>

        {/* RESPONSE TIMEFRAME & OPERATING INFO */}
        <div className="p-6 bg-slate-100 rounded-3xl border border-slate-200 text-xs text-slate-700 space-y-2">
          <div className="flex items-center gap-2 font-black text-slate-900 text-sm">
            <span>⏱️</span>
            <span>Response Timeframe</span>
          </div>
          <p className="leading-relaxed">
            We aim to review and respond to legitimate inquiries within <strong>1 to 24 hours</strong> (Philippine Standard Time). Response times may vary slightly during peak examination review months and weekends.
          </p>
          <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 font-medium">
            <strong>GovStudyX Online Services</strong> &bull; {siteConfig.domain} &bull; <a href={`mailto:${siteConfig.emails.general}`} className="underline text-slate-700">{siteConfig.emails.general}</a>
          </div>
        </div>
      </div>
    </div>
  );
}
