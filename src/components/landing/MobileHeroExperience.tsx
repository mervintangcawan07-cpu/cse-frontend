// Relative Path: src/components/landing/MobileHeroExperience.tsx
"use client";

import { useState, useRef, type TouchEvent, type ReactNode } from "react";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import defaultMobileBg from "@/app/image-final.webp";

interface MobileHeroExperienceProps {
  readonly heroImage?: StaticImageData | string;
}

const keyExamPills = [
  { icon: "🌟", label: "CSE Professional & Sub-Professional" },
  { icon: "☑️", label: "Practice Mock Exam, Custom Practice Quiz" },
  { icon: "☑️", label: "Strategy & Technique Drills" },
  { icon: "☑️", label: "Study Notes & Cheat Sheets" },
] as const;

export default function MobileHeroExperience({
  heroImage = defaultMobileBg,
}: MobileHeroExperienceProps): ReactNode {
  const [screenStep, setScreenStep] = useState<1 | 2>(1);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartY.current === null) return;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchStartY.current - touchEndY;

    // Upward swipe threshold (35px)
    if (deltaY > 35 && screenStep === 1) {
      setScreenStep(2);
    }
    touchStartY.current = null;
  };

  return (
    <section
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="relative w-full h-[100dvh] overflow-hidden bg-slate-950 text-white select-none"
      aria-label="Mobile and Portrait Tablet Showcase"
    >
      {/* FULLSCREEN BACKGROUND IMAGE */}
      <div className="absolute inset-0 w-full h-full z-0 pointer-events-none">
        <Image
          src={heroImage}
          alt="Candidate study journey towards passing the Civil Service examination"
          fill
          priority
          quality={75}
          sizes="100vw"
          className="object-cover object-[72%_center] sm:object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/40 to-slate-950/95" />
      </div>

      {/* ========================================================================= */}
      {/* SCREEN 1: INSPIRATIONAL INTRO SCREEN                                      */}
      {/* ========================================================================= */}
      <div
        className={`absolute inset-0 z-10 flex flex-col justify-between p-6 sm:p-12 transition-all duration-500 ease-out ${
          screenStep === 1
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-12 pointer-events-none"
        }`}
      >
       {/* ========================================================================= */}
        {/* TOP BLOCK: Headline & Subtext                                             */}
        {/* ========================================================================= */}
        {/* 🎛️ KNOB 1: VERTICAL POSITION (Downward shift)                           */}
        {/* - Mobile: `pt-24` or `pt-[14dvh]` pushes it downward toward the center.   */}
        {/* - Tablet (`md:`): `md:pt-28` or `md:pt-[12dvh]` independently sets tablet */}
        <div className="pt-40 md:pt-40 space-y-4 text-center">
          <div className="space-y-3 md:space-y-5 text-center px-4 max-w-sm md:max-w-2xl mx-auto">
            
            {/* 🎛️ KNOB 2: MAIN HEADLINE FONT SIZE                                   */}
            {/* - Mobile: `text-4xl` (~36px) or `text-[38px]`                         */}
            {/* - Tablet (`md:`): `md:text-6xl` (~60px) or `md:text-[68px]` (Much bolder) */}
            <h1 className="text-[40px] sm:text-[38px] md:text-[63px] lg:text-[77px] font-black tracking-tight leading-[1.12] text-white drop-shadow-lg">
              Small Steps <br />
              Every Day <br />
              Make Big Dreams <br />
              Come True
            </h1>

            {/* 🎛️ KNOB 3: SUBTITLE FONT SIZES                                        */}
            {/* - Mobile: `text-base` (~16px)                                         */}
            {/* - Tablet (`md:`): `md:text-2xl` (~24px) or `md:text-[26px]`           */}
            <div className="space-y-1 pt-2 md:pt-4">
              <p className="text-[20px] sm:text-[24px] md:text-3xl font-semibold text-slate-200/90 max-w-xs md:max-w-lg mx-auto drop-shadow-md leading-snug">
                Keep studying. Your future
              </p>
              <p className="text-[20px] sm:text-[24px md:text-3xl font-bold text-amber-300 max-w-xs md:max-w-lg mx-auto drop-shadow-md leading-snug">
                is worth it.
              </p>
            </div>

          </div>
        </div>

        {/* BOTTOM CONTROLS: Brand Icon Logo & Animated Swipe-Up Button */}
        <div className="space-y-4 sm:space-y-5 flex flex-col items-center pb-15 sm:pb-14 md:pb-25">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 sm:w-9 sm:h-9 relative shrink-0 overflow-hidden rounded-lg drop-shadow-md">
              <Image
                src="/brand/govstudyx-icon.png"
                alt="GovStudyX"
                width={36}
                height={36}
                className="w-full h-full object-contain"
              />
            </div>
            <span className="text-2xl sm:text-3xl md:text-6xl font-black tracking-tight text-white drop-shadow">
              GovStudy<span className="text-amber-400">X</span>
            </span>
          </div>

        <button
          type="button"
          onClick={() => setScreenStep(2)}
          className="flex flex-col items-center gap-2 text-slate-300 hover:text-white cursor-pointer group active:scale-95 transition"
          aria-label="Swipe up or tap to begin"
        >
          {/* 🎛️ KNOB 1: CIRCLE BUBBLE SIZE */}
          {/* Mobile: w-11 h-11 (44px) | Tablet: md:w-14 md:h-14 (56px) */}
          <div className="w-11 h-11 md:w-20 md:h-20 rounded-full bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center animate-bounce shadow-xl">
            
            {/* 🎛️ KNOB 2: ARROW ICON SIZE */}
            {/* Mobile: w-6 h-6 (24px) | Tablet: md:w-8 md:h-8 (32px) */}
            <svg
              className="w-6 h-6 md:w-8 md:h-8 text-amber-400 group-hover:text-amber-300 transition"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {/* 🎛️ KNOB 3: ARROW THICKNESS (Change strokeWidth={2.5} to 3 or 3.5 for a bolder look) */}
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3.5}
                d="M5 15l7-7 7 7"
              />
            </svg>
          </div>

          {/* 🎛️ KNOB 4: "SWIPE UP TO START" LABEL SIZE */}
          {/* Mobile: text-[10px] | Tablet: md:text-xs */}
          <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-200/90 drop-shadow">
            Swipe up to start
          </span>
        </button>
        </div>
      </div>

        {/* ========================================================================= */}
        {/* SCREEN 2: ACTION & ONBOARDING SCREEN                                      */}
        {/* ========================================================================= */}
        <div
          className={`absolute inset-0 z-20 flex flex-col justify-between p-6 md:p-14 backdrop-blur-xs transition-all duration-500 ease-out ${
            screenStep === 2
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 translate-y-12 pointer-events-none"
          }`}
        >
          {/* TOP BLOCK: Brand Header & Headline */}
          {/* 🎛️ KNOB 1: DOWNWARD POSITIONING (Push down towards center) */}
          {/* - Mobile: `pt-16` or `pt-[10dvh]` */}
          {/* - Tablet (`md:`): `md:pt-24` or `md:pt-[12dvh]` */}
          <div className="flex flex-col items-center text-center pt-30 md:pt-28 space-y-3 md:space-y-6">
            
            {/* Brand Logo & Name */}
            <div className="flex items-center gap-2.5 md:gap-3.5">
              {/* 🎛️ KNOB 2: ICON SIZE (Mobile: w-8 h-8 | Tablet: md:w-12 md:h-12) */}
              <div className="w-8 h-8 md:w-12 md:h-12 relative shrink-0 overflow-hidden rounded-xl shadow-md">
                <Image
                  src="/brand/govstudyx-icon.png"
                  alt="GovStudyX"
                  width={48}
                  height={48}
                  className="w-full h-full object-contain"
                />
              </div>
              {/* 🎛️ KNOB 3: BRAND TEXT (Mobile: text-xl | Tablet: md:text-3xl) */}
              <span className="text-xl md:text-3xl font-black tracking-tight text-white drop-shadow">
                GovStudy<span className="text-amber-400">X</span>
              </span>
            </div>

            {/* Motivational Pitch */}
            <div className="space-y-1.5 md:space-y-3">
              {/* 🎛️ KNOB 4: SCREEN 2 HEADLINE SIZE */}
              {/* - Mobile: `text-2xl` (~24px) or `text-[26px]` */}
              {/* - Tablet (`md:`): `md:text-4xl` (~36px) or `md:text-5xl` (~48px) */}
              <h2 className="text-3xl sm:text-3xl md:text-7xl font-black text-white tracking-tight leading-tight drop-shadow-md">
                Your Path to a <br />
                Brighter Future.
              </h2>

              {/* 🎛️ KNOB 5: SUBTITLE TEXT SIZE */}
              {/* - Mobile: `text-xs` (~12px) | Tablet: `md:text-lg` (~18px) */}
              <p className="text-xs sm:text-sm md:text-3xl text-slate-300 font-semibold leading-relaxed max-w-xs md:max-w-md mx-auto drop-shadow-sm">
                CSE Reviewer &amp; Government Exam Preparation
              </p>
            </div>
          </div>

      {/* MIDDLE BLOCK: Feature Badges (Transparent List with Drop Shadows) */}
      {/* 🎛️ KNOB 6: BADGE CONTAINER WIDTH & DISTANCE FROM BUTTONS */}
      {/* - Mobile: `max-w-xs mb-3` | Tablet: `md:max-w-md md:mb-6` */}
      {/* ========================================================================= */}
      {/* ENLARGED MIDDLE BLOCK: Feature Badges                                     */}
      {/* ========================================================================= */}
      {/* 🎛️ WIDER BADGE CONTAINER: max-w-sm on mobile, md:max-w-lg on tablet */}
      <div className="space-y-3 md:space-y-4 w-full max-w-sm md:max-w-lg mx-auto mt-auto mb-10 md:mb-12">
        {keyExamPills.map((pill) => (
          <div
            key={pill.label}
            className="flex items-center gap-3.5 md:gap-5 px-2 py-1 text-left"
          >
            {/* 🎛️ LARGER ICONS: text-xl (20px) on mobile | md:text-3xl (30px) on tablet */}
            <span className="text-xl md:text-3xl shrink-0 select-none drop-shadow">
              {pill.icon}
            </span>

            {/* 🎛️ LARGER TEXT: text-sm (14px) on mobile | md:text-lg (18px) on tablet */}
            <span className="text-sm sm:text-base md:text-lg font-bold text-slate-100 drop-shadow leading-snug">
              {pill.label}
            </span>
          </div>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* ENLARGED BOTTOM CONTROLS: Action Buttons                                  */}
      {/* ========================================================================= */}
      {/* 🎛️ WIDER BUTTON CONTAINER: max-w-sm on mobile, md:max-w-lg on tablet */}
      <div className="space-y-3 md:space-y-4 w-full max-w-sm md:max-w-lg mx-auto pb-18 md:pb-25">
        
        {/* 🎛️ PRIMARY BUTTON: Taller height (min-h-[54px] md:min-h-[64px]) + Larger Font (text-base md:text-xl) */}
        <Link
          href="/signup"
          className="w-full py-4 md:py-5 bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-slate-950 font-black text-base md:text-xl rounded-2xl shadow-xl transition flex items-center justify-center gap-2 min-h-[54px] md:min-h-[64px]"
        >
          <span>Get Started</span>
          <span>&rarr;</span>
        </Link>

        {/* 🎛️ SECONDARY BUTTON: Taller height (min-h-[50px] md:min-h-[58px]) + Larger Font (text-sm md:text-base) */}
        <Link
          href="/login"
          className="w-full py-3.5 md:py-4.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-white font-bold text-sm md:text-base rounded-2xl shadow-md transition text-center flex items-center justify-center min-h-[50px] md:min-h-[58px]"
        >
          I already have an account
        </Link>

        {/* Brand Tagline */}
        <div className="pt-2 md:pt-4 text-center">
          <p className="text-[11px] md:text-sm font-black uppercase tracking-wider text-slate-400">
            GovStudy<span className="text-amber-400">X</span>
          </p>
          <p className="text-[10px] md:text-xs text-slate-400/80">
            Small Steps Every Day Make Big Dreams Come True
          </p>
        </div>
      </div>
        </div>
    </section>
  );
}