"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
import { SudoModal } from "@/components/admin/SudoModal";

interface SudoContextType {
  requestSudo: () => Promise<boolean>;
  fetchWithSudo: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const SudoContext = createContext<SudoContextType | undefined>(undefined);

async function isSudoRequiredResponse(response: Response): Promise<boolean> {
  if (response.status !== 403) return false;
  if (response.headers.get("X-Sudo-Required") === "true") return true;

  try {
    const data = await response.clone().json();
    return (
      data.code === "SUDO_REQUIRED" ||
      data.code === "SUDO_EXPIRED" ||
      data.error === "SUDO_REQUIRED"
    );
  } catch {
    return false;
  }
}

export function SudoProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [isOpen, setIsOpen] = useState(false);
  const resolversRef = useRef<((success: boolean) => void)[]>([]);
  const pendingPromiseRef = useRef<Promise<boolean> | null>(null);

  const requestSudo = useCallback((): Promise<boolean> => {
    // If a sudo verification prompt is already active, piggyback on the same promise
    if (pendingPromiseRef.current) {
      return pendingPromiseRef.current;
    }

    setIsOpen(true);

    const promise = new Promise<boolean>((resolve) => {
      resolversRef.current.push(resolve);
    });

    pendingPromiseRef.current = promise;
    return promise;
  }, []);

  const resolveAll = useCallback((success: boolean) => {
    setIsOpen(false);
    const activeResolvers = resolversRef.current;
    resolversRef.current = [];
    pendingPromiseRef.current = null;

    for (const resolve of activeResolvers) {
      resolve(success);
    }
  }, []);

  const handleVerifySuccess = useCallback(() => {
    resolveAll(true);
  }, [resolveAll]);

  const handleCancel = useCallback(() => {
    resolveAll(false);
  }, [resolveAll]);

  const fetchWithSudo = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      let res = await fetch(input, init);

      if (await isSudoRequiredResponse(res)) {
        const authorized = await requestSudo();
        if (authorized) {
          // Re-fetch original request with the freshly minted sudo cookie attached
          res = await fetch(input, init);
        }
      }

      return res;
    },
    [requestSudo]
  );

  const contextValue = useMemo<SudoContextType>(
    () => ({ requestSudo, fetchWithSudo }),
    [requestSudo, fetchWithSudo]
  );

  return (
    <SudoContext.Provider value={contextValue}>
      {children}
      <SudoModal
        isOpen={isOpen}
        onSuccess={handleVerifySuccess}
        onCancel={handleCancel}
      />
    </SudoContext.Provider>
  );
}

export function useSudo(): SudoContextType {
  const context = useContext(SudoContext);
  if (!context) {
    throw new Error("useSudo must be used within a SudoProvider");
  }
  return context;
}