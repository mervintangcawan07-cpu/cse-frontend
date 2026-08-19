import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: `Cookie & Consent Policy | ${siteConfig.name}`,
  description: `Understand how cookies, local storage, analytics, and advertising technologies work on ${siteConfig.name} (${siteConfig.domain}) and manage your preferences.`,
  alternates: {
    canonical: `${siteConfig.url}/cookies`,
  },
};

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb & Navigation */}
        <div className="mb-6 flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link href="/" className="hover:text-blue-600 transition">
            Home
          </Link>
          <span>/</span>
          <span className="text-slate-900">Cookie &amp; Consent Policy</span>
        </div>

        {/* Header Banner */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-xs mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full text-xs font-black uppercase tracking-wider mb-4">
            <span>🍪 Cookie Transparency</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Cookie &amp; Consent Policy
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
              This Cookie &amp; Consent Policy explains how <strong>{siteConfig.name}</strong> (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) utilizes cookies, web storage, and similar technologies when you visit <strong>{siteConfig.domain}</strong>.
            </p>
            <p>
              We believe in complete transparency regarding the data we store on your browser and the technical tools that make your examination study experience seamless.
            </p>
          </section>

          {/* Section 1 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-600 text-white flex items-center justify-center text-xs">1</span>
              What Are Cookies and Local Storage?
            </h2>
            <p>
              Cookies are small data files placed on your device by websites you visit. They help sites remember your preferences, keep you securely authenticated, safeguard against unauthorized requests, and analyze how features are used.
            </p>
            <p className="text-xs text-slate-600">
              Modern web applications also utilize <em>Local Storage</em> and <em>IndexedDB</em> to cache offline quiz answers, user interface settings, and study progress without burdening network bandwidth.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-600 text-white flex items-center justify-center text-xs">2</span>
              Categories of Technologies We Use
            </h2>
            <p>Depending on your usage of {siteConfig.domain}, we may employ the following categories:</p>

            <div className="space-y-4">
              {/* Essential */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider text-blue-700">
                    1. Strictly Essential Technologies (Always Active)
                  </h3>
                  <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-extrabold rounded-full uppercase">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Required for the Website to operate securely and deliver core requested services. These cannot be switched off in our systems.
                </p>
                <ul className="list-disc list-inside text-xs space-y-1 text-slate-600 pl-1">
                  <li><strong>Auth JWT Session Cookies:</strong> Keep you logged in as you navigate between practice drills and mock exams.</li>
                  <li><strong>CSRF &amp; Security Tokens:</strong> Prevent cross-site request forgery attacks and safeguard payment flows.</li>
                  <li><strong>Offline IndexedDB &amp; Service Workers:</strong> Cache questions and enable offline synchronization during network drops.</li>
                </ul>
              </div>

              {/* Functional / Preferences */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider text-indigo-700">
                    2. Preference &amp; Functionality Technologies
                  </h3>
                  <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-extrabold rounded-full uppercase">
                    Functional
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Allow the Website to remember choices you make and provide personalized review settings.
                </p>
                <ul className="list-disc list-inside text-xs space-y-1 text-slate-600 pl-1">
                  <li><strong>Question Filter Settings:</strong> Remember your selected category, difficulty level, and drill preferences.</li>
                  <li><strong>Cookie Consent State:</strong> Store your consent choices so you aren&apos;t prompted on every page load.</li>
                </ul>
              </div>

              {/* Analytics */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider text-emerald-700">
                    3. Performance &amp; Analytics Technologies
                  </h3>
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-full uppercase">
                    Optional
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Help us understand how examinees interact with the platform, which questions have high error rates, and where UI bottlenecks exist.
                </p>
                <ul className="list-disc list-inside text-xs space-y-1 text-slate-600 pl-1">
                  <li>Aggregated traffic counts and page navigation flows</li>
                  <li>Client-side error reporting and diagnostic traces</li>
                </ul>
              </div>

              {/* Advertising */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider text-purple-700">
                    4. Advertising &amp; Marketing Technologies (AdSense Ready)
                  </h3>
                  <span className="px-2.5 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-extrabold rounded-full uppercase">
                    Optional
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  If third-party advertising partners (such as Google AdSense) are active, they may set cookies to serve relevant ads, prevent repetitive ads, and measure campaign effectiveness.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-600 text-white flex items-center justify-center text-xs">3</span>
              Third-Party Cookies
            </h2>
            <p>
              When you use third-party features (such as PayMongo for checkout or LiveKit for collaborative Study Together audio rooms), those providers may set their own technical cookies to guarantee secure transactions and low-latency audio streams.
            </p>
            <p className="text-xs text-slate-500">
              We recommend reviewing the individual cookie policies of our integrated partners for their direct handling practices.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-600 text-white flex items-center justify-center text-xs">4</span>
              Managing Your Cookie Preferences
            </h2>
            <p>You have full control over cookie storage:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="font-extrabold text-slate-900">Via Our Consent Banner</span>
                <p className="text-slate-600">
                  You can accept all, reject non-essential cookies, or fine-tune specific categories directly on our platform.
                </p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="font-extrabold text-slate-900">Via Browser Settings</span>
                <p className="text-slate-600">
                  You can configure Chrome, Edge, Safari, or Firefox to block or alert you about cookies.
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500 italic">
              Note: Disabling strictly essential cookies will prevent login sessions, exam progress tracking, and payment validation from functioning properly.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-600 text-white flex items-center justify-center text-xs">5</span>
              Updates to This Policy
            </h2>
            <p>
              We may update this policy as we incorporate new reviewer features, add advertising partners, or adjust data practices. The most recent version will always be posted here.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-600 text-white flex items-center justify-center text-xs">6</span>
              Questions &amp; Contact
            </h2>
            <p>If you have questions about how cookies are used on {siteConfig.name}, please email us at:</p>
            <div className="p-5 bg-amber-50/60 rounded-2xl border border-amber-200/80 text-xs text-slate-800 space-y-1.5">
              <p className="font-black text-sm text-slate-900">{siteConfig.name} Privacy Team</p>
              <p><strong>Website:</strong> <a href={siteConfig.url} className="text-amber-800 underline font-semibold">{siteConfig.domain}</a></p>
              <p><strong>Email:</strong> <a href={`mailto:${siteConfig.emails.privacy}`} className="text-amber-800 underline font-semibold">{siteConfig.emails.privacy}</a></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
