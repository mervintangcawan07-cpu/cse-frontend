import { SignJWT, jwtVerify } from "jose";

export interface JWTPayload {
  userId: string;
  email: string;
  role: "USER" | "ADMIN";
  isPaid: boolean;
  activeSessionId?: string;
  sessionId?: string;
  [key: string]: unknown;
}

function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error("Critical Configuration Error: Required environment variable JWT_SECRET is not configured.");
  }
  return new TextEncoder().encode(secret.trim());
}

export async function signJWT(payload: Record<string, any>): Promise<string> {
  try {
    const secretKey = getJwtSecretKey();
    return await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(secretKey);
  } catch (error) {
    console.error("[signJWT Error]:", error);
    throw error;
  }
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const secretKey = getJwtSecretKey();
    const { payload } = await jwtVerify(token, secretKey);
    return payload as JWTPayload;
  } catch (error) {
    console.error("[verifyJWT Error]:", error);
    return null;
  }
}