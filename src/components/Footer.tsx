// Relative Path: src/components/Footer.tsx
import Link from "next/link";
import { siteConfig } from "@/lib/config/site";

export default function Footer() {
  return (
    <footer className="w-full bg-slate-950 border-t border-slate-800 text-slate-400 text-xs mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-10">
        {/* Top 4-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10">
          {/* Brand & Mission (2 Cols on lg) */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="inline-flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-white text-sm shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                GS
              </div>
              <span className="font-extrabold text-base text-white tracking-wide">
                GovStudy<span className="text-blue-400 font-black">X</span>
              </span>
            </Link>

            <p className="text-slate-400 text-xs leading-relaxed max-w-sm font-medium">
              An independent online educational platform providing structured practice questions, timed mock exams, smart elimination drills, and active recall flashcards for the Philippine Civil Service Examination.
            </p>

            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed font-medium">
              <strong className="text-slate-300">Official Disclaimer:</strong> {siteConfig.disclaimer.short}
            </div>
          </div>

          {/* Quick Review Navigation */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
              Reviewer Suite
            </h3>
            <ul className="space-y-2 font-medium">
              <li>
                <Link href="/dashboard" className="hover:text-blue-400 transition">
                  Examinee Dashboard
                </Link>
              </li>
              <li>
                <Link href="/practice" className="hover:text-blue-400 transition">
                  Practice Questions
                </Link>
              </li>
              <li>
                <Link href="/drills" className="hover:text-blue-400 transition">
                  Elimination Drills
                </Link>
              </li>
              <li>
                <Link href="/flashcards" className="hover:text-blue-400 transition">
                  Recall Flashcards
                </Link>
              </li>
              <li>
                <Link href="/social" className="hover:text-blue-400 transition">
                  Study Together Hub 👥
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-blue-400 transition">
                  PRO Passes &amp; Pricing
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Compliance */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
              Legal &amp; Policy
            </h3>
            <ul className="space-y-2 font-medium">
              <li>
                <Link href="/privacy" className="hover:text-blue-400 transition">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-blue-400 transition">
                  Terms &amp; Conditions
                </Link>
              </li>
              <li>
                <Link href="/refund" className="hover:text-blue-400 transition">
                  Refund Policy
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="hover:text-blue-400 transition">
                  Cookie &amp; Consent Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Company & Support */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
              About &amp; Help
            </h3>
            <ul className="space-y-2 font-medium">
              <li>
                <Link href="/about" className="hover:text-blue-400 transition">
                  About GovStudyX
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-blue-400 transition">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/support" className="hover:text-blue-400 transition">
                  Student Support Ticket
                </Link>
              </li>
              <li>
                <a href={`mailto:${siteConfig.emails.support}`} className="hover:text-blue-400 transition">
                  {siteConfig.emails.support}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left text-[11px] text-slate-400">
          <div>
            &copy; 2026 {siteConfig.name} ({siteConfig.domain}). All rights reserved.
          </div>
          <div className="flex items-center gap-4 font-semibold">
            <Link href="/privacy" className="hover:text-white transition">Privacy</Link>
            <span>&bull;</span>
            <Link href="/terms" className="hover:text-white transition">Terms</Link>
            <span>&bull;</span>
            <Link href="/refund" className="hover:text-white transition">Refunds</Link>
            <span>&bull;</span>
            <Link href="/cookies" className="hover:text-white transition">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
