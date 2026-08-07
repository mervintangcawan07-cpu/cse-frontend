// Relative Path: src/types/auth.ts

export interface SudoTicket {
  userId: string;
  email: string;
  role: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

export interface SudoVerificationPayload {
  password?: string;
}

export interface SudoErrorResponse {
  error: string;
  code: "SUDO_REQUIRED" | "INVALID_SUDO_TOKEN" | "SUDO_EXPIRED" | "RATE_LIMIT_EXCEEDED";
  incidentId?: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}
