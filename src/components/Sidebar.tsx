// Relative Path: src/components/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ name?: string; role?: string; isPaid?: boolean } | null>(null);

  useEffect(() => {
    async function fetchMe() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user || null);
        }
      } catch (err) {
        // Silently handle unauthenticated state
      }
    }
    fetchMe();
  }, [pathname]);

  // Sidebar is non-intrusive and does not block screen content on mobile/tablet
  return null;
}