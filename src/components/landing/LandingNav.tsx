"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function LandingNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* TOP NAVIGATION BAR */}
      <nav className="w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-50 px-4 sm:px-8 py-3.5 flex justify-between items-center shadow-xs">
        <Link href="/" className="flex items-center gap-2 font-black text-lg text-slate-900 tracking-tight">
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg">
            <Image
              src="/brand/govstudyx-icon.png"
              alt=""
              width={32}
              height={32}
              className="h-full w-full object-cover"
            />
          </div>
          <span className="font-extrabold text-slate-900">
            GovStudy<span className="text-blue-600">X</span>
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden lg:flex items-center gap-7 text-xs font-bold text-slate-600">
          <a href="#challenge" className="hover:text-blue-600 transition">Sample Challenge</a>
          <a href="#scope" className="hover:text-blue-600 transition">Review Scope</a>
          <a href="#features" className="hover:text-blue-600 transition">Features</a>
          <a href="#classmates" className="hover:text-blue-600 transition">Study Classmates</a>
          <a href="#pricing" className="hover:text-blue-600 transition">Pricing Plans</a>
          <a href="#faqs" className="hover:text-blue-600 transition">FAQs</a>
        </div>

        {/* Action Buttons */}
        <div className="hidden sm:flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 font-bold text-xs text-slate-700 hover:text-blue-600 transition"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 font-extrabold text-xs text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:opacity-95 transition shadow-sm"
          >
            Start Reviewing
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
          aria-label="Toggle Navigation Menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </nav>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-slate-200 px-6 py-5 space-y-4 shadow-xl animate-fade-in sticky top-14 z-40">
          <div className="flex flex-col space-y-3 text-sm font-bold text-slate-700">
            <a href="#challenge" onClick={() => setMobileMenuOpen(false)} className="py-1 hover:text-blue-600">Sample Challenge</a>
            <a href="#scope" onClick={() => setMobileMenuOpen(false)} className="py-1 hover:text-blue-600">Review Scope</a>
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="py-1 hover:text-blue-600">Features</a>
            <a href="#classmates" onClick={() => setMobileMenuOpen(false)} className="py-1 hover:text-blue-600">Study Classmates</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="py-1 hover:text-blue-600">Pricing Plans</a>
            <a href="#faqs" onClick={() => setMobileMenuOpen(false)} className="py-1 hover:text-blue-600">FAQs</a>
          </div>
          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 font-bold text-xs text-slate-700 bg-slate-100 rounded-xl"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 font-bold text-xs text-white bg-blue-600 rounded-xl shadow-xs"
            >
              Start Reviewing Free
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
