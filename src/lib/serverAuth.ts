// Relative Path: src/lib/serverAuth.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT, JWTPayload } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
  isPaid: boolean;
  paidUntil?: Date | null;
  planType?: string | null;
}

export interface AuthResult {
  user: AuthenticatedUser | null;
  errorResponse: NextResponse | null;
}

/**
 * Server-Side Authentication: Cryptographically verifies JWT and checks database record.
 */
export async function getAuthenticatedUser(req?: Request): Promise<AuthenticatedUser | null> {
  try {
    let token: string | undefined;

    // 1. Try extracting from cookies
    const cookieStore = await cookies();
    token = cookieStore.get("cse_session")?.value;

    // 2. Fallback to Authorization header if provided
    if (!token && req) {
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) return null;

    // 3. Cryptographically verify signature and expiration
    const payload: JWTPayload | null = await verifyJWT(token);
    if (!payload?.userId) return null;

    // 4. Validate user against live database to prevent revoked/stale sessions
    const dbUser = await prisma.user.findUnique({
      where: { id: String(payload.userId) },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isPaid: true,
        paidUntil: true,
        planType: true,
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
    };
  } catch (error) {
    console.error("[serverAuth] Authentication error:", error);
    return null;
  }
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

  if (user.role !== "ADMIN") {
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
  const isPaidValid =
    user.role === "ADMIN" ||
    (user.isPaid && (!user.paidUntil || new Date(user.paidUntil).getTime() > Date.now()));

  if (!isPaidValid) {
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
