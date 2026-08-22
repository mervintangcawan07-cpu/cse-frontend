import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const rawConnectionString = process.env.DATABASE_URL;

if (!rawConnectionString) {
  throw new Error("DATABASE_URL is required");
}

const databaseUrl = new URL(rawConnectionString);
databaseUrl.searchParams.set("sslmode", "verify-full");

const connectionString = databaseUrl.toString();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

// ⚡ NEON + VERCEL SERVERLESS OPTIMIZATION:
// In Vercel serverless environments, each ephemeral lambda instance is single-threaded.
// Setting max to 1 (or PG_POOL_MAX) and shortening timeouts avoids connection multiplication and UI hangs.
const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString,
    max: process.env.PG_POOL_MAX ? parseInt(process.env.PG_POOL_MAX, 10) : 1,
    idleTimeoutMillis: 10000, // Return idle connections quickly to Neon PgBouncer
    connectionTimeoutMillis: 5000, // 5s fast timeout to prevent UI hanging during cold starts
  });

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;
globalForPrisma.pool = pool;