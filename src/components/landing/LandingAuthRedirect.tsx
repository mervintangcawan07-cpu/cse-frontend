"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function LandingAuthRedirect() {
  const router = useRouter();
  const { user, status } = useAuth();

  // Auto-redirect active logged-in users to Dashboard
  useEffect(() => {
    if (status === "authenticated" && user) {
      router.replace("/dashboard");
    }
  }, [router, status, user]);

  return null;
}
