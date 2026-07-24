import { SignJWT, jwtVerify } from "jose";

export interface JWTPayload {
  userId: string;
  email: string;
  role: "USER" | "ADMIN";
  isPaid: boolean;
  [key: string]: unknown;
}

// 💡 Fallback key guarantees Edge (middleware) & Node (login route) match 100%
const SECRET_STRING = process.env.JWT_SECRET || "cse_reviewer_permanent_jwt_secret_key_2026";
const SECRET_KEY = new TextEncoder().encode(SECRET_STRING);

export async function signJWT(payload: Record<string, any>): Promise<string> {
  try {
    return await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(SECRET_KEY);
  } catch (error) {
    console.error("[signJWT Error]:", error);
    throw error;
  }
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as JWTPayload;
  } catch (error) {
    console.error("[verifyJWT Error]:", error);
    return null;
  }
}