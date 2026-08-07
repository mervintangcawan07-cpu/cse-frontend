// Relative Path: src/lib/logger/transports.ts

import { StructuredLogPayload, LogLevel, Transport } from "./types";

const ANSI_COLORS: Record<LogLevel, string> = {
  DEBUG: "\x1b[36m",
  INFO: "\x1b[32m",
  WARN: "\x1b[33m",
  ERROR: "\x1b[31m",
  FATAL: "\x1b[35m\x1b[1m"
};

const RESET_ANSI = "\x1b[0m";

export class DevConsoleTransport implements Transport {
  public send(payload: StructuredLogPayload): void {
    const color = ANSI_COLORS[payload.level] || RESET_ANSI;
    const time = payload.timestamp.split("T")[1].replace("Z", "");
    const levelTag = `${color}[${payload.level.padEnd(5)}]${RESET_ANSI}`;

    console.log(`${time} ${levelTag} \x1b[1m${payload.message}${RESET_ANSI}`);

    if (payload.request) {
      console.log(
        `  \x1b[90m↳ Request:${RESET_ANSI} ${payload.request.method || "GET"} ${
          payload.request.route || "/"
        } ${payload.request.statusCode ? `(${payload.request.statusCode})` : ""}`
      );
    }

    if (payload.user) {
      console.log(`  \x1b[90m↳ User:${RESET_ANSI}`, payload.user);
    }

    if (payload.context && Object.keys(payload.context).length > 0) {
      console.log(`  \x1b[90m↳ Context:${RESET_ANSI}`, payload.context);
    }

    if (payload.error) {
      console.error(
        `  ${color}↳ Error: ${payload.error.name} - ${payload.error.message}${RESET_ANSI}`
      );
      if (payload.error.stack) {
        console.error(`\x1b[90m${payload.error.stack}\x1b[0m`);
      }
    }
  }
}

export class ProductionBatchTransport implements Transport {
  private queue: StructuredLogPayload[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly maxBatchSize = 50;
  private readonly batchIntervalMs = 3000;

  constructor() {
    this.initFlusher();
  }

  public send(payload: StructuredLogPayload): void {
    console.log(JSON.stringify(payload));

    this.queue.push(payload);
    if (this.queue.length >= this.maxBatchSize) {
      this.flush();
    }
  }

  private initFlusher(): void {
    if (typeof setInterval !== "undefined") {
      this.batchTimer = setInterval(() => {
        if (this.queue.length > 0) {
          this.flush();
        }
      }, this.batchIntervalMs);
    }

    if (typeof process !== "undefined" && process.on) {
      process.on("beforeExit", () => this.flush());
    }
  }

  private flush(): void {
    if (this.queue.length === 0) return;

    const batch = [...this.queue];
    this.queue = [];

    queueMicrotask(async () => {
      try {
        const ingestionEndpoint = process.env.LOG_INGESTION_URL;
        if (ingestionEndpoint && typeof fetch !== "undefined") {
          await fetch(ingestionEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ logs: batch }),
          });
        }
      } catch (err) {
        console.error("[Logger Fallback] Ingestion endpoint dispatch failed:", err);
      }
    });
  }
}
