import { SignJWT, jwtVerify } from "jose";

const secret = process.env.JWT_SECRET;

// Prevent silent production security bypasses
if (!secret && process.env.NODE_ENV === "production") {
  throw new Error("CRITICAL SECURITY ERROR: JWT_SECRET is not set in production!");
}

const SECRET_KEY = new TextEncoder().encode(
  secret || "fallback-secret-key-change-in-production-32chars"
);

export interface JWTPayload {
  userId: string;
  email: string;
  role: "USER" | "ADMIN";
  isPaid: boolean;
  [key: string]: unknown;
}

export async function signJWT(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET_KEY);
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as JWTPayload;
  } catch (error) {
    return null;
  }
}