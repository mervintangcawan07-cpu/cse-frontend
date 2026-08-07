// Relative Path: src/lib/logger/logger.ts

import {
  LogLevel,
  Environment,
  StructuredLogPayload,
  RequestMetadata,
  UserContext,
  Transport
} from "./types";
import { redactSensitiveData } from "./scrubbers";
import { DevConsoleTransport, ProductionBatchTransport } from "./transports";

const SEVERITY_ORDER: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
};

class CentralLogger {
  private environment: Environment;
  private minLevelSeverity: number;
  private transport: Transport;

  constructor() {
    this.environment = (process.env.NODE_ENV as Environment) || "development";
    const envLevel = (process.env.LOG_LEVEL?.toUpperCase() as LogLevel) || "INFO";
    this.minLevelSeverity = SEVERITY_ORDER[envLevel] ?? SEVERITY_ORDER.INFO;

    this.transport =
      this.environment === "production" || this.environment === "staging"
        ? new ProductionBatchTransport()
        : new DevConsoleTransport();
  }

  private shouldLog(level: LogLevel): boolean {
    return SEVERITY_ORDER[level] >= this.minLevelSeverity;
  }

  private buildPayload(
    level: LogLevel,
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
    request?: RequestMetadata,
    user?: UserContext
  ): StructuredLogPayload {
    const payload: StructuredLogPayload = {
      timestamp: new Date().toISOString(),
      environment: this.environment,
      level,
      message,
    };

    if (error) {
      if (error instanceof Error) {
        payload.error = {
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: (error as Error & { cause?: unknown }).cause,
        };
      } else {
        payload.error = {
          name: "UnhandledError",
          message: String(error),
        };
      }
    }

    if (request) payload.request = request;
    if (user) payload.user = user;
    if (context && Object.keys(context).length > 0) payload.context = context;

    return redactSensitiveData(payload);
  }

  private safeDispatch(
    level: LogLevel,
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
    request?: RequestMetadata,
    user?: UserContext
  ): void {
    if (!this.shouldLog(level)) return;

    try {
      const payload = this.buildPayload(level, message, error, context, request, user);
      this.transport.send(payload);
    } catch (internalError) {
      console.error("[Logger Fatal Failure]", internalError);
    }
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    this.safeDispatch("DEBUG", message, undefined, context);
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.safeDispatch("INFO", message, undefined, context);
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.safeDispatch("WARN", message, undefined, context);
  }

  public error(
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
    request?: RequestMetadata,
    user?: UserContext
  ): void {
    this.safeDispatch("ERROR", message, error, context, request, user);
  }

  public fatal(
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
    request?: RequestMetadata,
    user?: UserContext
  ): void {
    this.safeDispatch("FATAL", message, error, context, request, user);
  }
}

export const logger = new CentralLogger();
