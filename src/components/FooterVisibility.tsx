// Relative Path: src/components/FooterVisibility.tsx
"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

const FOOTER_VISIBLE_EXACT_ROUTES = new Set([
  "/",
  "/dashboard",
  "/pricing",
  "/upgrade",
  "/about",
  "/contact",
  "/support",
  "/privacy",
  "/privacy-policy",
  "/terms",
  "/terms-and-conditions",
  "/refund",
  "/refund-policy",
  "/cookies",
  "/cookie-policy",
  "/login",
  "/signup",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/maintenance",
]);

function shouldShowFooter(pathname: string | null): boolean {
  if (!pathname) return true;
  if (FOOTER_VISIBLE_EXACT_ROUTES.has(pathname)) return true;

  // Render on legal, support, or about sub-routes if any exist
  if (
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/refund") ||
    pathname.startsWith("/cookies") ||
    pathname.startsWith("/about") ||
    pathname.startsWith("/contact") ||
    pathname.startsWith("/support")
  ) {
    return true;
  }

  return false;
}

interface FooterVisibilityProps {
  children: ReactNode;
}

export default function FooterVisibility({ children }: FooterVisibilityProps) {
  const pathname = usePathname();

  if (!shouldShowFooter(pathname)) {
    return null;
  }

  return <>{children}</>;
}
