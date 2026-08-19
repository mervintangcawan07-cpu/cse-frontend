import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: `Privacy Policy | ${siteConfig.name}`,
  description: `Learn how ${siteConfig.name} (${siteConfig.domain}) collects, uses, protects, and handles your personal information, exam history, and account data.`,
  alternates: {
    canonical: `${siteConfig.url}/privacy`,
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb & Navigation */}
        <div className="mb-6 flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link href="/" className="hover:text-blue-600 transition">
            Home
          </Link>
          <span>/</span>
          <span className="text-slate-900">Privacy Policy</span>
        </div>

        {/* Header Banner */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-xs mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-xs font-black uppercase tracking-wider mb-4">
            <span>🛡️ Legal & Privacy</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Privacy Policy
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
              Welcome to <strong>{siteConfig.name}</strong> (&ldquo;we,&rdquo; &ldquo;our,&rdquo; &ldquo;us,&rdquo; or &ldquo;the Website&rdquo;).
            </p>
            <p>
              <strong>{siteConfig.domain}</strong> is an independent online educational platform created to help individuals prepare for the Philippine Civil Service Examination (CSE) through practice questions, study materials, mock examinations, explanations, learning tools, active recall flashcards, and related educational resources.
            </p>
            <p>
              We respect your privacy and are committed to handling personal information responsibly in accordance with applicable Philippine data privacy principles and regulations, including Republic Act No. 10173 (Data Privacy Act of 2012). This Privacy Policy explains what information we may collect, why we collect it, how we use it, and the choices available to you.
            </p>
            <p className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 font-medium">
              By using <strong>{siteConfig.domain}</strong>, you acknowledge that you have read and understood this Privacy Policy.
            </p>
          </section>

          {/* Section 1 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs">1</span>
              Information We May Collect
            </h2>
            <p>Depending on how you use the Website, we may collect information such as:</p>

            <div className="space-y-4 pl-2">
              <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/70 space-y-1.5">
                <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider text-blue-700">
                  A. Account Information
                </h3>
                <p className="text-xs">When you create an account, we may collect:</p>
                <ul className="list-disc list-inside text-xs space-y-1 text-slate-600 pl-1">
                  <li>Full name or display name</li>
                  <li>Email address</li>
                  <li>Password credentials in securely processed/hashed form</li>
                  <li>Account type or membership status (Free or PRO)</li>
                  <li>Account creation and login timestamp information</li>
                </ul>
              </div>

              <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/70 space-y-1.5">
                <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider text-blue-700">
                  B. Learning and Examination Information
                </h3>
                <p className="text-xs">When you use our reviewer and examination features, we may process information such as:</p>
                <ul className="list-disc list-inside text-xs space-y-1 text-slate-600 pl-1">
                  <li>Practice-question responses and elimination drill activity</li>
                  <li>Mock examination results, elapsed time, and sub-category scores</li>
                  <li>Exam history and completed exam attempt logs</li>
                  <li>Learning progress and mistake notebook entries</li>
                  <li>Selected answers and study milestone achievements</li>
                  <li>Performance statistics across Numerical, Verbal, Analytical, and General Information categories</li>
                </ul>
                <p className="text-[11px] text-slate-500 italic mt-1">
                  This information allows us to provide personalized learning features, identify weak topic areas, and display your historical progress.
                </p>
              </div>

              <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/70 space-y-1.5">
                <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider text-blue-700">
                  C. Payment Information
                </h3>
                <p className="text-xs">
                  When you purchase premium access or another paid service, payment processing is handled through third-party payment providers such as PayMongo.
                </p>
                <p className="text-xs font-semibold text-slate-800">
                  We do not store your complete credit card numbers, CVV codes, or sensitive e-wallet authentication credentials on our own servers.
                </p>
                <p className="text-xs text-slate-600">
                  Payment-related information made available to us by the payment gateway includes transaction reference IDs, payment status (paid/pending), amount paid, currency, timestamp, and metadata necessary to verify, activate, and manage your purchase.
                </p>
              </div>

              <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/70 space-y-1.5">
                <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider text-blue-700">
                  D. Technical Information
                </h3>
                <p className="text-xs">When you access the Website, certain technical information may be automatically collected:</p>
                <ul className="list-disc list-inside text-xs space-y-1 text-slate-600 pl-1">
                  <li>IP address (used for session security, rate limiting, and approximate geography)</li>
                  <li>Browser type and version</li>
                  <li>Device type and operating system</li>
                  <li>Pages visited, referring URLs, and navigation paths</li>
                  <li>Date and time of access</li>
                  <li>Diagnostic, error, and security logs</li>
                </ul>
              </div>

              <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/70 space-y-1.5">
                <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider text-blue-700">
                  E. Cookies and Similar Technologies
                </h3>
                <p className="text-xs">
                  We may use cookies, local storage, session technologies, or similar mechanisms to operate the Website, remember preferences, maintain authentication sessions, analyze usage, improve performance, and, where applicable, display advertising.
                </p>
                <p className="text-xs">
                  Please consult our <Link href="/cookies" className="text-blue-600 underline font-bold">Cookie &amp; Consent Policy</Link> for detailed specifics.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs">2</span>
              How We Use Information
            </h2>
            <p>We may use collected information to:</p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-medium text-slate-700">
              <li className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">✓ Create and maintain user accounts</li>
              <li className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">✓ Authenticate users securely</li>
              <li className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">✓ Provide access to free and PRO reviewer features</li>
              <li className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">✓ Deliver timed practice and mock examinations</li>
              <li className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">✓ Record examination progress and calculate scores</li>
              <li className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">✓ Display learning analytics and mistake notebooks</li>
              <li className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">✓ Process and verify purchases with payment gateways</li>
              <li className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">✓ Provide examinee customer support</li>
              <li className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">✓ Prevent fraud, account sharing, and platform abuse</li>
              <li className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">✓ Protect Website security and integrity</li>
              <li className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">✓ Improve educational materials and explanations</li>
              <li className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">✓ Communicate important account or service updates</li>
              <li className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">✓ Comply with applicable legal obligations</li>
              <li className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">✓ Display advertising where applicable and permitted</li>
            </ul>
            <p className="font-bold text-xs text-slate-900 bg-blue-50/70 p-3 rounded-xl border border-blue-200">
              We do not sell your personal information to third parties.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs">3</span>
              Educational Performance Information
            </h2>
            <p>
              Your practice results, quiz answers, and examination history are processed to provide platform features such as progress tracking, performance summaries, weak-area identification, and study recommendations.
            </p>
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-bold">⚠️ Non-Official Educational Indicator</p>
              <p>
                We do not represent these practice scores as official Civil Service Commission results. Your performance on {siteConfig.name} is solely an indicator of your activity within our independent reviewer platform.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs">4</span>
              Third-Party Service Providers
            </h2>
            <p>
              We may utilize trusted third-party service providers to support essential functions of the Website, including:
            </p>
            <ul className="list-disc list-inside text-xs space-y-1.5 text-slate-600 pl-2">
              <li><strong>Payment Processing:</strong> PayMongo (Philippines) for secure GCash, Maya, QRPH, and card payments</li>
              <li><strong>Hosting &amp; Compute:</strong> Cloud infrastructure and content delivery networks</li>
              <li><strong>Database Infrastructure:</strong> Managed cloud database providers</li>
              <li><strong>Email Delivery:</strong> Transactional email services for account verification and password resets</li>
              <li><strong>Live Stage &amp; Audio:</strong> Real-time media services for collaborative Study Together rooms</li>
              <li><strong>Analytics &amp; Error Monitoring:</strong> Platform performance and crash diagnosis</li>
            </ul>
            <p className="text-xs text-slate-500">
              These providers process information strictly according to their respective privacy policies, security standards, and applicable data processing agreements.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs">5</span>
              Advertising Practices
            </h2>
            <p>
              If Google AdSense or another advertising network is enabled, advertising providers may use cookies, web beacons, or similar technologies to deliver, measure, personalize, or frequency-cap advertisements according to their applicable policies and user settings.
            </p>
            <p className="text-xs text-slate-600">
              You may manage your advertising personalization preferences via your Google account ad settings or through our cookie consent controls.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs">6</span>
              Data Security
            </h2>
            <p>
              We implement reasonable technical, administrative, and organizational safeguards designed to protect personal information against unauthorized access, destruction, loss, alteration, or disclosure.
            </p>
            <p className="text-xs text-slate-600">
              These measures include SSL/TLS encryption for data in transit, cryptographic password hashing (bcrypt), role-based access control, session timeouts, and rate-limited endpoints. However, no internet transmission or electronic storage method is 100% secure. You are responsible for keeping your login credentials confidential.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs">7</span>
              Data Retention
            </h2>
            <p>
              We retain personal information only for as long as reasonably necessary to fulfill the purposes outlined in this Privacy Policy—including providing reviewer access, maintaining study records, preventing fraud, resolving disputes, and complying with statutory record-keeping obligations.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs">8</span>
              Your Choices and Data Subject Rights
            </h2>
            <p>
              Under applicable law (including the Philippine Data Privacy Act of 2012), you have certain rights regarding your personal data:
            </p>
            <ul className="list-disc list-inside text-xs space-y-1.5 text-slate-600 pl-2">
              <li><strong>Right to Access:</strong> Request a copy of personal information we maintain about your account.</li>
              <li><strong>Right to Rectification:</strong> Request correction of inaccurate or outdated profile details.</li>
              <li><strong>Right to Erasure / Deletion:</strong> Request account closure and deletion of associated personal data where legally permissible.</li>
              <li><strong>Right to Withdraw Consent:</strong> Update cookie or marketing preferences at any time.</li>
            </ul>
            <p className="text-xs text-slate-600">
              To exercise any of these rights, please reach out to us at <a href={`mailto:${siteConfig.emails.privacy}`} className="text-blue-600 font-bold underline">{siteConfig.emails.privacy}</a>.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs">9</span>
              Children&apos;s Privacy
            </h2>
            <p>
              The Website is an examination preparation tool intended primarily for adult examinees and students preparing for professional career eligibility. We do not knowingly collect personal information from individuals under the age of 16 without appropriate parental or legal guardian consent.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs">10</span>
              External Links
            </h2>
            <p>
              Our Website may contain links to external websites, including official government portals (such as CSC announcements or exam calendars). We are not responsible for the privacy practices, content, or security of external third-party sites.
            </p>
          </section>

          {/* Section 11 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs">11</span>
              Independent Educational Platform Disclaimer
            </h2>
            <div className="p-4 bg-slate-100 rounded-2xl border border-slate-300/80 text-xs text-slate-800 leading-relaxed font-medium">
              <p>
                <strong>{siteConfig.name}</strong> ({siteConfig.domain}) is an independent educational platform. We are <strong>not the Civil Service Commission</strong> and are not affiliated with, sponsored by, or endorsed by the CSC or any Philippine government agency.
              </p>
            </div>
          </section>

          {/* Section 12 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs">12</span>
              Changes to This Privacy Policy
            </h2>
            <p>
              We may periodically update this Privacy Policy to reflect improvements to our services, changes in technology, or legal requirements. Updated versions will be posted on this page with a revised &ldquo;Last Updated&rdquo; date.
            </p>
          </section>

          {/* Section 13 */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs">13</span>
              Contact Information
            </h2>
            <p>For any privacy questions, data subject requests, or security concerns, please contact:</p>
            <div className="p-5 bg-blue-50/60 rounded-2xl border border-blue-200/80 text-xs text-slate-800 space-y-1.5">
              <p className="font-black text-sm text-slate-900">{siteConfig.name}</p>
              <p><strong>Website:</strong> <a href={siteConfig.url} className="text-blue-600 underline font-semibold">{siteConfig.domain}</a></p>
              <p><strong>Privacy Inquiries:</strong> <a href={`mailto:${siteConfig.emails.privacy}`} className="text-blue-600 underline font-semibold">{siteConfig.emails.privacy}</a></p>
              <p><strong>General Support:</strong> <a href={`mailto:${siteConfig.emails.support}`} className="text-blue-600 underline font-semibold">{siteConfig.emails.support}</a></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
