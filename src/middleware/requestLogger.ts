// Relative Path: src/middleware/requestLogger.ts

import { logger } from "../lib/logger/logger";
import { RequestMetadata } from "../lib/logger/types";

export function expressRequestLogger(req: any, res: any, next: () => void): void {
  const startTime = performance.now();

  res.on("finish", () => {
    const durationMs = Math.round(performance.now() - startTime);
    const requestMeta: RequestMetadata = {
      route: req.originalUrl || req.url,
      method: req.method,
      statusCode: res.statusCode,
      ip: req.ip || (req.headers && req.headers["x-forwarded-for"]),
      userAgent: req.headers && req.headers["user-agent"],
      durationMs,
    };

    if (res.statusCode >= 500) {
      logger.error(`HTTP ${req.method} ${requestMeta.route}`, undefined, {}, requestMeta);
    } else if (res.statusCode >= 400) {
      logger.warn(`HTTP ${req.method} ${requestMeta.route}`, { request: requestMeta });
    } else {
      logger.info(`HTTP ${req.method} ${requestMeta.route}`, { request: requestMeta });
    }
  });

  next();
}

export function registerGlobalErrorHandlers(): void {
  if (typeof process !== "undefined" && process.on) {
    process.on("uncaughtException", (error: Error) => {
      logger.fatal("Uncaught Exception detected in runtime process", error);
    });

    process.on("unhandledRejection", (reason: unknown) => {
      logger.fatal("Unhandled Promise Rejection detected", reason);
    });
  }

  if (typeof window !== "undefined") {
    window.addEventListener("error", (event: ErrorEvent) => {
      logger.fatal("Unhandled Window Error", event.error || event.message);
    });

    window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
      logger.fatal("Unhandled Window Promise Rejection", event.reason);
    });
  }
}
