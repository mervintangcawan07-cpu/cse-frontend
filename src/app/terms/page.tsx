import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: `Terms & Conditions | ${siteConfig.name}`,
  description: `Read the Terms and Conditions governing your use of the ${siteConfig.name} (${siteConfig.domain}) online Philippine Civil Service Examination reviewer platform.`,
  alternates: {
    canonical: `${siteConfig.url}/terms`,
  },
};

export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb & Navigation */}
        <div className="mb-6 flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link href="/" className="hover:text-blue-600 transition">
            Home
          </Link>
          <span>/</span>
          <span className="text-slate-900">Terms &amp; Conditions</span>
        </div>

        {/* Header Banner */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-xs mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full text-xs font-black uppercase tracking-wider mb-4">
            <span>📜 Terms of Service</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Terms &amp; Conditions
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
              Welcome to <strong>{siteConfig.name}</strong>.
            </p>
            <p>
              These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your access to and use of <strong>{siteConfig.domain}</strong>, including its website, user accounts, practice questions, study materials, mock examinations, elimination drills, flashcards, Study Together features, premium access, and related educational services.
            </p>
            <p className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-200/80 text-xs text-indigo-950 font-semibold">
              By creating an account, making a purchase, or using the Website, you agree to these Terms. If you do not agree with them, please do not access or use the Website.
            </p>
          </section>

          {/* Section 1 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs">1</span>
              About the Website
            </h2>
            <p>
              <strong>{siteConfig.domain}</strong> is an independent educational platform designed to assist users in preparing for the Philippine Civil Service Examination (CSE). Our services may include:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-medium">
              <span className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">• Practice questions &amp; quizzes</span>
              <span className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">• Review lessons &amp; study guides</span>
              <span className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">• Full-length timed mock examinations</span>
              <span className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">• Smart elimination strategy drills</span>
              <span className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">• Active recall flashcards</span>
              <span className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">• Mistake notebook &amp; weak area drill</span>
              <span className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">• Study Together rooms &amp; whiteboard</span>
              <span className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">• Premium educational tools &amp; passes</span>
            </div>
            <p className="text-xs text-slate-500">
              We may add, update, modify, suspend, or discontinue platform features as the service develops.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs">2</span>
              Independent Educational Status Disclaimer
            </h2>
            <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-950 space-y-2">
              <p className="font-extrabold text-sm">⚠️ Not an Official Government Agency</p>
              <p>
                <strong>{siteConfig.domain}</strong> is an independent examination-preparation platform. We are <strong>not the Philippine Civil Service Commission (&ldquo;CSC&rdquo;)</strong> and are not affiliated with, authorized by, sponsored by, or endorsed by the CSC or any government agency.
              </p>
              <p>
                We do not claim to represent, speak for, or act on behalf of the CSC. Official examination schedules, eligibility requirements, application filing dates, testing center assignments, and CSC resolutions should always be verified directly through the official Civil Service Commission website (<a href="https://csc.gov.ph" target="_blank" rel="noopener noreferrer" className="underline font-bold text-amber-900">csc.gov.ph</a>).
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs">3</span>
              Eligibility &amp; Acceptable Use
            </h2>
            <p>You must provide accurate and truthful information when registering for an account. You agree NOT to:</p>
            <ul className="list-disc list-inside text-xs space-y-1.5 text-slate-600 pl-2">
              <li>Register an account using false, deceptive, or misleading information</li>
              <li>Impersonate another examinee, administrator, or individual</li>
              <li>Share or distribute login credentials with third parties</li>
              <li>Attempt to bypass paywalls, feature gates, or role authorization restrictions</li>
              <li>Use automated scrapers, bots, or extraction scripts against our question database</li>
              <li>Interfere with server operation, websocket connections, or platform security</li>
              <li>Upload malicious scripts, abusive comments, or prohibited materials</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs">4</span>
              Account Security &amp; Responsibility
            </h2>
            <p>
              You are responsible for maintaining the secrecy and confidentiality of your login credentials. You must notify us immediately at <a href={`mailto:${siteConfig.emails.support}`} className="text-indigo-600 underline font-bold">{siteConfig.emails.support}</a> if you suspect unauthorized access to your account.
            </p>
            <p className="text-xs text-slate-500">
              We reserve the right to suspend or restrict accounts that exhibit fraudulent activity, credential sharing, automated scraping, or violations of these Terms.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs">5</span>
              Free vs. Premium (PRO) Services
            </h2>
            <p>
              Certain educational materials and sample challenges may be accessed without payment. Full mock examinations, advanced elimination drills, extensive question banks, detailed rationalizations, mistake notebook features, and specialized Study Together tools require paid PRO access.
            </p>
            <p className="text-xs text-slate-600">
              The exact access duration, included features, and one-time pricing for each PRO plan are clearly disclosed on our <Link href="/pricing" className="text-indigo-600 font-bold underline">Pricing page</Link> prior to purchase.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs">6</span>
              Payment Processing
            </h2>
            <p>
              Payments for PRO passes are processed securely through accredited third-party payment gateways, including PayMongo (supporting GCash, Maya, GrabPay, QRPH, and major debit/credit cards).
            </p>
            <p className="text-xs text-slate-600">
              A successful payment grants the non-transferable right to access the purchased digital educational services for the stated duration. Payment does not confer copyright ownership or redistribution rights over our materials.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs">7</span>
              Premium Access Limitations
            </h2>
            <p>PRO access is personal and granted strictly to the registered account holder. You agree NOT to:</p>
            <ul className="list-disc list-inside text-xs space-y-1 text-slate-600 pl-2">
              <li>Resell, rent, or lease access to {siteConfig.name}</li>
              <li>Distribute question banks, answer keys, or rationalizations in bulk</li>
              <li>Rip, screenshot, or mass-download full examination sets for commercial review centers</li>
              <li>Bypass technical limits or digital rights mechanisms</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs">8</span>
              Educational Content &amp; No Guarantee of Exam Results
            </h2>
            <p>
              Our reviewer questions, step-by-step solutions, elimination hints, flashcards, and drills are created strictly for educational preparation.
            </p>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-1">
              <p className="font-bold text-slate-900">Important Academic Notice:</p>
              <p>Practice results and mock exam scores on {siteConfig.name} do not guarantee:</p>
              <ul className="list-disc list-inside pl-1 space-y-0.5 text-slate-600">
                <li>Passing the Civil Service Examination (Professional or Sub-Professional)</li>
                <li>Achieving any specific score or percentile ranking</li>
                <li>Government employment, appointment, or civil service eligibility</li>
              </ul>
              <p className="pt-1 text-[11px] text-slate-500">
                Individual examination performance depends on personal study discipline, actual exam conditions, and factors outside our control.
              </p>
            </div>
          </section>

          {/* Section 9 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs">9</span>
              Accuracy of Information
            </h2>
            <p>
              While we make diligent efforts to maintain high-quality, up-to-date educational materials, civil service guidelines, constitutional jurisprudence, and administrative policies may evolve. We do not warrant that all practice content or informational articles will remain free of errors or instantly reflective of late-breaking policy announcements.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs">10</span>
              Intellectual Property Rights
            </h2>
            <p>
              Unless otherwise indicated, all original materials published by {siteConfig.name}—including question formulations, rationalizations, step-by-step explanations, elimination algorithms, illustrations, interface designs, codebase, and database structures—are the intellectual property of {siteConfig.legalName} and protected under Philippine and international copyright laws.
            </p>
            <p className="text-xs text-slate-600">
              You are granted a limited, revocable, non-exclusive, non-transferable license to access the content solely for your personal, non-commercial examination preparation.
            </p>
          </section>

          {/* Section 11 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs">11</span>
              User-Submitted Content &amp; Study Hub Conduct
            </h2>
            <p>
              When utilizing community study features (such as the Study Together Hub, whiteboard notes, and support tickets), you agree not to submit or broadcast content that is defamatory, abusive, offensive, infringing, unlawful, or intended to disrupt study sessions. We reserve the right to remove non-compliant content without prior notice.
            </p>
          </section>

          {/* Section 12 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs">12</span>
              Prohibited Technical Activities
            </h2>
            <p>You may not:</p>
            <ul className="list-disc list-inside text-xs space-y-1 text-slate-600 pl-2">
              <li>Launch denial-of-service (DoS/DDoS) attacks against our infrastructure</li>
              <li>Scan, probe, or test vulnerabilities without explicit written authorization</li>
              <li>Reverse engineer or decompile client-side code or proprietary evaluation logic</li>
              <li>Forge headers or manipulate identifiers to disguise origin</li>
            </ul>
          </section>

          {/* Section 13 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs">13</span>
              Website Availability &amp; Maintenance
            </h2>
            <p>
              We strive to deliver high uptime and dependable service; however, the platform may experience scheduled maintenance, updates, hosting provider outages, or network interruptions. We are not liable for temporary service interruptions.
            </p>
          </section>

          {/* Section 14 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs">14</span>
              Third-Party Integrations
            </h2>
            <p>
              Certain functions rely on third-party services (payment gateways, cloud hosting, email delivery). We are not responsible for outages, policies, or operational failures originating exclusively from third-party infrastructure.
            </p>
          </section>

          {/* Section 15 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs">15</span>
              Account Suspension &amp; Termination
            </h2>
            <p>
              We reserve the right to suspend or terminate accounts that engage in payment fraud, abuse of examinee collaboration tools, mass scraping, or severe breach of these Terms.
            </p>
          </section>

          {/* Section 16 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs">16</span>
              Changes to These Terms
            </h2>
            <p>
              We may modify these Terms periodically as our offerings or regulatory requirements change. The revised Terms will take effect upon posting with an updated &ldquo;Last Updated&rdquo; date.
            </p>
          </section>

          {/* Section 17 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs">17</span>
              Contact Information
            </h2>
            <p>For questions or notices regarding these Terms, please contact:</p>
            <div className="p-5 bg-indigo-50/60 rounded-2xl border border-indigo-200/80 text-xs text-slate-800 space-y-1.5">
              <p className="font-black text-sm text-slate-900">{siteConfig.name}</p>
              <p><strong>Website:</strong> <a href={siteConfig.url} className="text-indigo-600 underline font-semibold">{siteConfig.domain}</a></p>
              <p><strong>Email:</strong> <a href={`mailto:${siteConfig.emails.support}`} className="text-indigo-600 underline font-semibold">{siteConfig.emails.support}</a></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
