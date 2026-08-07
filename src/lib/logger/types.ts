// Relative Path: src/lib/logger/types.ts

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
export type Environment = "development" | "staging" | "production" | "test";

export interface RequestMetadata {
  route?: string;
  method?: string;
  statusCode?: number;
  ip?: string;
  userAgent?: string;
  durationMs?: number;
}

export interface UserContext {
  hashedUserId?: string;
  sessionId?: string;
  role?: string;
}

export interface ErrorPayload {
  name: string;
  message: string;
  stack?: string;
  cause?: unknown;
}

export interface StructuredLogPayload {
  timestamp: string;
  environment: Environment;
  level: LogLevel;
  message: string;
  error?: ErrorPayload;
  request?: RequestMetadata;
  user?: UserContext;
  context?: Record<string, unknown>;
}

export interface Transport {
  send(payload: StructuredLogPayload): void;
}
