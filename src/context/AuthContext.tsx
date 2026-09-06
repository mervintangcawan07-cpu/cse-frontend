"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import {
  AUTH_ACTIVITY_THROTTLE_MS,
  AUTH_SNAPSHOT_STALE_MS,
  AuthRequestInvalidatedError,
  createAuthRequestGate,
} from "@/lib/auth/clientAuth";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isPaid: boolean;
  paidUntil?: string | null;
  planType?: string | null;
  lastActiveAt?: string | null;
}

export type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "error";

export type AuthRefreshReason =
  | "initial"
  | "activity"
  | "visibility"
  | "online"
  | "profile"
  | "entitlement"
  | "explicit";

interface AuthMePayload {
  user: AuthUser | null;
  kicked?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  error: string | null;
  refreshAuth: (reason?: AuthRefreshReason) => Promise<AuthUser | null>;
  clearAuth: () => void;
  pauseActivityHeartbeat: () => void;
  resumeActivityHeartbeat: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function isKickedSafePath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/" ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/refund") ||
    pathname.startsWith("/cookies")
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [kicked, setKicked] = useState(false);

  const mountedRef = useRef(false);
  const userRef = useRef<AuthUser | null>(null);
  const statusRef = useRef<AuthStatus>("loading");
  const lastSnapshotAtRef = useRef(0);
  const lastAuthAttemptAtRef = useRef(0);
  const activityPendingRef = useRef(false);
  const activitySuspendedRef = useRef(false);
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestGateRef = useRef(createAuthRequestGate<AuthMePayload>());

  const cancelPendingActivityHeartbeat = useCallback(() => {
    activityPendingRef.current = false;
    if (activityTimerRef.current) {
      clearTimeout(activityTimerRef.current);
      activityTimerRef.current = null;
    }
  }, []);

  const applyUser = useCallback((nextUser: AuthUser | null) => {
    userRef.current = nextUser;
    const nextStatus: AuthStatus = nextUser ? "authenticated" : "unauthenticated";
    statusRef.current = nextStatus;
    setUser(nextUser);
    setStatus(nextStatus);
    setError(null);
  }, []);

  const refreshAuth = useCallback(
    async (reason: AuthRefreshReason = "explicit") => {
      if (reason !== "activity") cancelPendingActivityHeartbeat();
      lastAuthAttemptAtRef.current = Date.now();

      try {
        const payload = await requestGateRef.current.run(async (signal) => {
          const response = await fetch("/api/auth/me", { signal });
          let body: AuthMePayload | null = null;
          try {
            body = (await response.json()) as AuthMePayload;
          } catch {
            body = null;
          }

          if (response.status === 401 || response.status === 403) {
            return {
              user: null,
              kicked: Boolean(body?.kicked),
            };
          }
          if (!response.ok) {
            throw new Error(`Auth snapshot failed with status ${response.status}.`);
          }
          return body ?? { user: null };
        });

        if (!mountedRef.current) return userRef.current;

        lastSnapshotAtRef.current = Date.now();
        cancelPendingActivityHeartbeat();
        setKicked(Boolean(payload.kicked));
        applyUser(payload.user ?? null);
        return payload.user ?? null;
      } catch (refreshError) {
        if (
          refreshError instanceof AuthRequestInvalidatedError ||
          isAbortError(refreshError)
        ) {
          return userRef.current;
        }

        if (mountedRef.current) {
          setError("Unable to refresh the current session.");
          if (!userRef.current) statusRef.current = "error";
          if (!userRef.current) setStatus("error");
        }
        return userRef.current;
      }
    },
    [applyUser, cancelPendingActivityHeartbeat]
  );

  const clearAuth = useCallback(() => {
    cancelPendingActivityHeartbeat();
    requestGateRef.current.invalidate();
    userRef.current = null;
    statusRef.current = "unauthenticated";
    lastSnapshotAtRef.current = 0;
    setUser(null);
    setStatus("unauthenticated");
    setError(null);
    setKicked(false);
  }, [cancelPendingActivityHeartbeat]);

  const pauseActivityHeartbeat = useCallback(() => {
    activitySuspendedRef.current = true;
    cancelPendingActivityHeartbeat();
  }, [cancelPendingActivityHeartbeat]);

  const resumeActivityHeartbeat = useCallback(() => {
    activitySuspendedRef.current = false;
  }, []);

  const recordActivity = useCallback(() => {
    if (
      !userRef.current ||
      activitySuspendedRef.current ||
      document.visibilityState !== "visible" ||
      !navigator.onLine
    ) {
      return;
    }

    activityPendingRef.current = true;
    if (activityTimerRef.current) return;

    const elapsed = Date.now() - lastAuthAttemptAtRef.current;
    const delay = Math.max(0, AUTH_ACTIVITY_THROTTLE_MS - elapsed);

    activityTimerRef.current = setTimeout(() => {
      activityTimerRef.current = null;
      if (
        !activityPendingRef.current ||
        !userRef.current ||
        activitySuspendedRef.current ||
        document.visibilityState !== "visible" ||
        !navigator.onLine
      ) {
        activityPendingRef.current = false;
        return;
      }

      activityPendingRef.current = false;
      void refreshAuth("activity");
    }, delay);
  }, [refreshAuth]);

  useEffect(() => {
    mountedRef.current = true;
    void refreshAuth("initial");

    return () => {
      mountedRef.current = false;
      cancelPendingActivityHeartbeat();
      requestGateRef.current.invalidate();
    };
  }, [cancelPendingActivityHeartbeat, refreshAuth]);

  useEffect(() => {
    const activityEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "touchstart",
    ];
    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, recordActivity, { passive: true })
    );

    return () => {
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, recordActivity)
      );
    };
  }, [recordActivity]);

  useEffect(() => {
    const refreshIfStale = (reason: "visibility" | "online") => {
      if (document.visibilityState !== "visible" || !navigator.onLine) {
        return;
      }

      const isErrorRecovery = !userRef.current && statusRef.current === "error";

      if (isErrorRecovery) {
        if (
          reason === "visibility" &&
          Date.now() - lastAuthAttemptAtRef.current < AUTH_SNAPSHOT_STALE_MS
        ) {
          return;
        }
        void refreshAuth(reason);
        return;
      }

      if (
        !userRef.current ||
        Date.now() - lastSnapshotAtRef.current < AUTH_SNAPSHOT_STALE_MS ||
        Date.now() - lastAuthAttemptAtRef.current < AUTH_SNAPSHOT_STALE_MS
      ) {
        return;
      }
      void refreshAuth(reason);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        cancelPendingActivityHeartbeat();
        return;
      }
      refreshIfStale("visibility");
    };

    const handleOnline = () => refreshIfStale("online");

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, [cancelPendingActivityHeartbeat, refreshAuth]);

  useEffect(() => {
    if (kicked && !isKickedSafePath(pathname)) {
      window.location.href = "/login?kicked=true";
    }
  }, [kicked, pathname]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      error,
      refreshAuth,
      clearAuth,
      pauseActivityHeartbeat,
      resumeActivityHeartbeat,
    }),
    [
      clearAuth,
      error,
      pauseActivityHeartbeat,
      refreshAuth,
      resumeActivityHeartbeat,
      status,
      user,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
