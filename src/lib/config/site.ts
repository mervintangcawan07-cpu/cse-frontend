// Relative Path: src/lib/config/site.ts

export const siteConfig = {
  name: "GovStudyX",
  legalName: "GovStudyX Online Educational Services",
  domain: "govstudyx.com",
  url: "https://govstudyx.com",
  tagline: "Independent Philippine Civil Service Examination Reviewer",
  description:
    "An independent online learning platform designed to help examinees prepare for the Philippine Civil Service Examination through realistic practice questions, mock exams, elimination drills, active recall flashcards, and collaborative study tools.",
  effectiveDate: "August 20, 2026",
  lastUpdated: "August 20, 2026",
  
  emails: {
    general: "govstudyx@gmail.com",
    support: "govstudyx@gmail.com",
    privacy: "govstudyx@gmail.com",
    billing: "govstudyx@gmail.com",
  },
  
  disclaimer: {
    short:
      "GovStudyX is an independent educational platform. We are not affiliated with, sponsored by, or endorsed by the Philippine Civil Service Commission (CSC) or any government agency.",
    full:
      "GovStudyX (govstudyx.com) is an independent online learning platform created for civil-service exam preparation. We are not the Civil Service Commission (CSC) and do not represent ourselves as an official government agency. References to the Civil Service Examination, CSC syllabus, or related government materials are provided solely for educational and test-preparation purposes.",
  },
  
  links: {
    privacy: "/privacy",
    terms: "/terms",
    refund: "/refund",
    cookies: "/cookies",
    about: "/about",
    contact: "/contact",
    support: "/support",
    dashboard: "/dashboard",
    practice: "/practice",
    learning: "/learning",
    social: "/social",
    pricing: "/pricing",
  },
};

export type SiteConfig = typeof siteConfig;

/**
 * Resolves the canonical public site URL.
 * Priority:
 * 1. SITE_URL (Server-side canonical override)
 * 2. NEXT_PUBLIC_SITE_URL (Public build/runtime site URL)
 * 3. NEXT_PUBLIC_APP_URL
 * 4. In production: Always defaults to "https://govstudyx.com"
 * 5. In development: Defaults to "http://localhost:3000"
 */
export function getSiteUrl(): string {
  const envUrl =
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL;

  if (envUrl && envUrl.trim().length > 0) {
    const cleaned = envUrl.replace(/\[.*?\]|\(|\)|['"]/g, "").trim();
    if (cleaned.length > 0) {
      return cleaned.replace(/\/+$/, "");
    }
  }

  if (process.env.NODE_ENV === "production") {
    return "https://govstudyx.com";
  }

  return "http://localhost:3000";
}
