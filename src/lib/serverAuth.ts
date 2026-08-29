// Relative Path: src/lib/serverAuth.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT, JWTPayload } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  authenticateExistingAccountSession,
  isAccountAuthorizedFor,
  type AccountSessionFailureCode,
} from "@/lib/accountLifecycle";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
  isPaid: boolean;
  paidUntil?: Date | null;
  planType?: string | null;
  lastActiveAt?: Date | null;
}

export interface AuthenticatedSession {
  user: AuthenticatedUser;
  sessionId: string;
}

export type AuthenticatedSessionResult =
  | { authenticated: true; session: AuthenticatedSession }
  | {
      authenticated: false;
      code: AccountSessionFailureCode | "NO_TOKEN" | "AUTHENTICATION_ERROR";
    };

export interface AuthenticatedUserRecord extends AuthenticatedUser {
  anonymizedAt: Date | null;
  anonymizationVersion: number | null;
  isBanned: boolean;
  deletedAt: Date | null;
  activeSessionId: string | null;
}

export interface SessionAuthenticationDependencies {
  verifyToken(token: string): Promise<JWTPayload | null>;
  findUserById(userId: string): Promise<AuthenticatedUserRecord | null>;
}

export interface AuthResult {
  user: AuthenticatedUser | null;
  errorResponse: NextResponse | null;
}

async function findAuthenticatedUserRecord(
  userId: string
): Promise<AuthenticatedUserRecord | null> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isPaid: true,
      paidUntil: true,
      planType: true,
      lastActiveAt: true,
      anonymizedAt: true,
      anonymizationVersion: true,
      isBanned: true,
      deletedAt: true,
      activeSessionId: true,
    },
  });

  if (!dbUser) return null;

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role as "USER" | "ADMIN",
    isPaid: dbUser.isPaid || dbUser.role === "ADMIN",
    paidUntil: dbUser.paidUntil,
    planType: dbUser.planType,
    lastActiveAt: dbUser.lastActiveAt,
    anonymizedAt: dbUser.anonymizedAt,
    anonymizationVersion: dbUser.anonymizationVersion,
    isBanned: dbUser.isBanned,
    deletedAt: dbUser.deletedAt,
    activeSessionId: dbUser.activeSessionId,
  };
}

export async function authenticateSessionTokenResult(
  token: string,
  dependencies: SessionAuthenticationDependencies
): Promise<AuthenticatedSessionResult> {
  const decision = await authenticateExistingAccountSession(token, dependencies);
  if (!decision.allowed) {
    return { authenticated: false, code: decision.code };
  }

  const dbUser = decision.user;

  return {
    authenticated: true,
    session: {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        isPaid: dbUser.isPaid,
        paidUntil: dbUser.paidUntil,
        planType: dbUser.planType,
        lastActiveAt: dbUser.lastActiveAt,
      },
      sessionId: decision.sessionId,
    },
  };
}

export async function authenticateSessionToken(
  token: string,
  dependencies: SessionAuthenticationDependencies
): Promise<AuthenticatedSession | null> {
  const result = await authenticateSessionTokenResult(token, dependencies);
  return result.authenticated ? result.session : null;
}

/**
 * Canonical server-side authority: verifies the token and requires a live,
 * exact database-backed session before returning a safe User DTO.
 */
export async function getAuthenticatedSessionResult(
  req?: Request
): Promise<AuthenticatedSessionResult> {
  try {
    let token: string | undefined;

    const cookieStore = await cookies();
    token = cookieStore.get("cse_session")?.value;

    if (!token && req) {
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) return { authenticated: false, code: "NO_TOKEN" };

    return authenticateSessionTokenResult(token, {
      verifyToken: verifyJWT,
      findUserById: findAuthenticatedUserRecord,
    });
  } catch (error) {
    console.error("[serverAuth] Authentication error:", error);
    return { authenticated: false, code: "AUTHENTICATION_ERROR" };
  }
}

export async function getAuthenticatedSession(
  req?: Request
): Promise<AuthenticatedSession | null> {
  const result = await getAuthenticatedSessionResult(req);
  return result.authenticated ? result.session : null;
}

export async function getAuthenticatedUser(
  req?: Request
): Promise<AuthenticatedUser | null> {
  return (await getAuthenticatedSession(req))?.user ?? null;
}

/**
 * Guard: Requires active user authentication. Returns 401 if unauthenticated.
 */
export async function requireAuthUser(req?: Request): Promise<AuthResult> {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Unauthorized. Please log in to access this resource." },
        { status: 401 }
      ),
    };
  }
  return { user, errorResponse: null };
}

/**
 * Guard: Requires Administrator role server-side. Returns 401 if unauthenticated, 403 if not Admin.
 */
export async function requireAdminAuth(req?: Request): Promise<AuthResult> {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      ),
    };
  }

  if (!isAccountAuthorizedFor(user, "ADMIN")) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Forbidden. Administrator privileges required." },
        { status: 403 }
      ),
    };
  }

  return { user, errorResponse: null };
}

/**
 * Guard: Requires active PRO subscription or Administrator role.
 */
export async function requireProAuth(req?: Request): Promise<AuthResult> {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      ),
    };
  }

  // Check if subscription has expired
  if (!isAccountAuthorizedFor(user, "PRO")) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Payment required. Active PRO subscription required." },
        { status: 402 }
      ),
    };
  }

  return { user, errorResponse: null };
}
