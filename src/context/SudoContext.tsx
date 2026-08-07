// Relative Path: src/context/SudoContext.tsx
"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { SudoModal } from "@/components/admin/SudoModal";

interface SudoContextType {
  requestSudo: () => Promise<boolean>;
  fetchWithSudo: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const SudoContext = createContext<SudoContextType | undefined>(undefined);

export function SudoProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [resolver, setResolver] = useState<((success: boolean) => void) | null>(null);

  const requestSudo = (): Promise<boolean> => {
    setIsOpen(true);
    return new Promise((resolve) => {
      setResolver(() => resolve);
    });
  };

  const handleVerifySuccess = () => {
    setIsOpen(false);
    if (resolver) {
      resolver(true);
      setResolver(null);
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    if (resolver) {
      resolver(false);
      setResolver(null);
    }
  };

  const fetchWithSudo = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let res = await fetch(input, init);

    if (res.status === 403) {
      const cloned = res.clone();
      try {
        const data = await cloned.json();
        const isSudoReq =
          data.code === "SUDO_REQUIRED" ||
          data.code === "SUDO_EXPIRED" ||
          data.error === "SUDO_REQUIRED" ||
          res.headers.get("X-Sudo-Required") === "true";

        if (isSudoReq) {
          const success = await requestSudo();
          if (success) {
            // Retry original request with newly issued sudo ticket cookie
            res = await fetch(input, init);
          }
        }
      } catch {
        // Response wasn't JSON, return original response
      }
    }

    return res;
  };

  return (
    <SudoContext.Provider value={{ requestSudo, fetchWithSudo }}>
      {children}
      <SudoModal isOpen={isOpen} onSuccess={handleVerifySuccess} onCancel={handleCancel} />
    </SudoContext.Provider>
  );
}

export function useSudo() {
  const context = useContext(SudoContext);
  if (!context) {
    throw new Error("useSudo must be used within a SudoProvider");
  }
  return context;
}