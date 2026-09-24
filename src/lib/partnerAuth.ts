// Relative Path: src/lib/partnerAuth.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

function getPartnerSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error("Critical Configuration Error: Required environment variable JWT_SECRET is not configured for Partner authentication.");
  }
  return new TextEncoder().encode(secret.trim());
}

export interface AuthenticatedPartner {
  id: string;
  partnerId: string | null;
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
  const secretKey = getPartnerSecretKey();
  return new SignJWT({
    partnerId,
    emailOrCode,
    role: "PARTNER",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey);
}

/**
 * Verifies a Partner JWT token.
 */
export async function verifyPartnerJWT(token: string): Promise<{ partnerId: string; role: string; iat?: number } | null> {
  try {
    const secretKey = getPartnerSecretKey();
    const { payload } = await jwtVerify(token, secretKey);
    if (!payload.partnerId || payload.role !== "PARTNER") {
      return null;
    }
    return {
      partnerId: String(payload.partnerId),
      role: String(payload.role),
      iat: typeof payload.iat === "number" ? payload.iat : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Server-Side Authentication: Retrieves and validates partner session against live database.
 */
export async function getAuthenticatedPartner(req?: Request): Promise<AuthenticatedPartner | null> {
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

  try {
    const payload = await verifyPartnerJWT(token);
    if (!payload?.partnerId) return null;

    const partner = await prisma.partner.findUnique({
      where: { id: payload.partnerId },
      select: {
        id: true,
        partnerId: true,
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
        updatedAt: true,
      },
    });

    if (!partner || partner.status !== "ACTIVE") {
      return null;
    }

    if (payload.iat && partner.updatedAt) {
      const issuedAtSeconds = payload.iat;
      const passwordUpdatedSeconds = Math.floor(new Date(partner.updatedAt).getTime() / 1000);
      // If token was issued before the most recent password update, reject session
      if (issuedAtSeconds < passwordUpdatedSeconds) {
        return null;
      }
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
