// Relative Path: src/components/partner/PartnerAttributionTracker.tsx
"use client";

import { useEffect } from "react";

interface PartnerAttributionTrackerProps {
  partnerCode: string;
  campaignSource?: string;
}

/**
 * Client-side tracker component that safely establishes 30-day attribution cookies and localStorage
 * without throwing Next.js Server Component cookie-modification errors.
 */
export default function PartnerAttributionTracker({
  partnerCode,
  campaignSource = "direct",
}: PartnerAttributionTrackerProps) {
  useEffect(() => {
    if (!partnerCode) return;

    try {
      const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
      const secureFlag = isHttps ? "; Secure" : "";
      const maxAge = 30 * 24 * 60 * 60; // 30 days in seconds

      // 1. Set standard and partner attribution cookies
      document.cookie = `cse_partner_ref=${encodeURIComponent(partnerCode)}; path=/; max-age=${maxAge}; SameSite=Lax${secureFlag}`;
      document.cookie = `cse_ref=${encodeURIComponent(partnerCode)}; path=/; max-age=${maxAge}; SameSite=Lax${secureFlag}`;
      document.cookie = `cse_campaign_source=${encodeURIComponent(campaignSource)}; path=/; max-age=${maxAge}; SameSite=Lax${secureFlag}`;

      // 2. Set localStorage fallbacks in case cross-subdomain or third-party cookie restrictions apply
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("cse_partner_ref", partnerCode);
        localStorage.setItem("cse_ref", partnerCode);
        localStorage.setItem("cse_campaign_source", campaignSource);
      }
    } catch (e) {
      console.warn("[AttributionTracker] Client storage exception ignored:", e);
    }
  }, [partnerCode, campaignSource]);

  return null;
}
