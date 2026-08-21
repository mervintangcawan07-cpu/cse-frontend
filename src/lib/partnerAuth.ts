// Relative Path: src/lib/partnerAuth.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "govstudyx-super-secret-production-partner-key-2026"
);

export interface AuthenticatedPartner {
  id: string;
  code: string;
  slug: string | null;
  name: string;
  type: string;
  contactEmail: string | null;
  contactName: string | null;
  status: string;
  commissionModel: string;
  commissionRate: number;
  minPayoutCentavos: number;
  holdingPeriodDays: number;
  badgeText: string | null;
  tagline: string | null;
}

export interface PartnerAuthResult {
  partner: AuthenticatedPartner | null;
  errorResponse: NextResponse | null;
}

/**
 * Creates a signed JWT for Partner Portal sessions.
 */
export async function signPartnerJWT(partnerId: string, emailOrCode: string): Promise<string> {
  return new SignJWT({
    partnerId,
    emailOrCode,
    role: "PARTNER",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

/**
 * Verifies a Partner JWT token.
 */
export async function verifyPartnerJWT(token: string): Promise<{ partnerId: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.partnerId || payload.role !== "PARTNER") {
      return null;
    }
    return {
      partnerId: String(payload.partnerId),
      role: String(payload.role),
    };
  } catch {
    return null;
  }
}

/**
 * Server-Side Authentication: Retrieves and validates partner session against live database.
 */
export async function getAuthenticatedPartner(req?: Request): Promise<AuthenticatedPartner | null> {
  try {
    let token: string | undefined;

    // 1. Check cookies
    const cookieStore = await cookies();
    token = cookieStore.get("cse_partner_session")?.value;

    // 2. Fallback to Authorization header
    if (!token && req) {
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) return null;

    const payload = await verifyPartnerJWT(token);
    if (!payload?.partnerId) return null;

    const partner = await prisma.partner.findUnique({
      where: { id: payload.partnerId },
      select: {
        id: true,
        code: true,
        slug: true,
        name: true,
        type: true,
        contactEmail: true,
        contactName: true,
        status: true,
        commissionModel: true,
        commissionRate: true,
        minPayoutCentavos: true,
        holdingPeriodDays: true,
        badgeText: true,
        tagline: true,
      },
    });

    if (!partner || partner.status !== "ACTIVE") {
      return null;
    }

    return partner;
  } catch (error) {
    console.error("[PARTNER_AUTH_ERROR]", error);
    return null;
  }
}

/**
 * Server-side route guard requiring an active Partner session.
 */
export async function requirePartnerAuth(req?: Request): Promise<PartnerAuthResult> {
  const partner = await getAuthenticatedPartner(req);

  if (!partner) {
    return {
      partner: null,
      errorResponse: NextResponse.json(
        { error: "Partner authentication required", code: "PARTNER_UNAUTHORIZED" },
        { status: 401 }
      ),
    };
  }

  return {
    partner,
    errorResponse: null,
  };
}
