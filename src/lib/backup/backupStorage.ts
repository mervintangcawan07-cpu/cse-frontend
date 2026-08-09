// Relative Path: src/lib/backup/backupStorage.ts
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export interface StorageObjectMeta {
  key: string;
  sizeBytes: number;
  checksumSha256: string;
  location: string;
}

export class BackupStorageProvider {
  private localBackupDir: string;
  private tableInitialized = false;

  constructor() {
    const isVercel = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

    if (isVercel) {
      this.localBackupDir = path.join(os.tmpdir(), "csc_disaster_recovery_vault");
    } else {
      this.localBackupDir = path.join(process.cwd(), "..", "csc_disaster_recovery_vault");
    }

    this.ensureVaultDirectory();
  }

  private ensureVaultDirectory() {
    try {
      if (!fs.existsSync(this.localBackupDir)) {
        fs.mkdirSync(this.localBackupDir, { recursive: true });
      }
    } catch (err) {
      console.error("[STORAGE_VAULT_ERROR] Failed to create vault directory:", err);
    }
  }

  /**
   * Ensures persistent database table exists in PostgreSQL.
   */
  private async ensureDatabaseVaultTable() {
    if (this.tableInitialized) return;
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "BackupPayload" (
          "filename" TEXT PRIMARY KEY,
          "payload" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      this.tableInitialized = true;
    } catch (err) {
      console.error("[STORAGE_VAULT_DB_INIT_ERROR] Failed to ensure BackupPayload table:", err);
    }
  }

  public calculateChecksum(buffer: Buffer): string {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * Saves compressed backup payload to local filesystem and PostgreSQL persistent storage vault.
   */
  public async saveBackup(
    filename: string,
    buffer: Buffer
  ): Promise<StorageObjectMeta> {
    this.ensureVaultDirectory();
    await this.ensureDatabaseVaultTable();

    const checksumSha256 = this.calculateChecksum(buffer);
    const storageKey = `backups/${new Date().getFullYear()}/${filename}`;
    const localFilePath = path.join(this.localBackupDir, filename);

    // 1. Write to local /tmp cache
    await fs.promises.writeFile(localFilePath, buffer);

    // 2. Save persistently to PostgreSQL
    try {
      const base64Data = buffer.toString("base64");
      await prisma.$executeRawUnsafe(
        `INSERT INTO "BackupPayload" ("filename", "payload", "createdAt") 
         VALUES ($1, $2, NOW()) 
         ON CONFLICT ("filename") 
         DO UPDATE SET "payload" = EXCLUDED."payload";`,
        filename,
        base64Data
      );
    } catch (dbErr) {
      console.error(`[STORAGE_VAULT_DB_SAVE_ERROR] Failed to save '${filename}' to DB vault:`, dbErr);
    }

    return {
      key: storageKey,
      sizeBytes: buffer.length,
      checksumSha256,
      location: localFilePath,
    };
  }

  /**
   * Reads backup payload from local cache or fetches from persistent PostgreSQL vault.
   */
  public async getBackupPayload(filename: string): Promise<Buffer> {
    this.ensureVaultDirectory();
    const localFilePath = path.join(this.localBackupDir, filename);

    // 1. Return local filesystem copy if available
    if (fs.existsSync(localFilePath)) {
      return await fs.promises.readFile(localFilePath);
    }

    // 2. Fetch from PostgreSQL database storage vault on Vercel cold starts
    await this.ensureDatabaseVaultTable();
    try {
      const rows = await prisma.$queryRawUnsafe<{ payload: string }[]>(
        `SELECT "payload" FROM "BackupPayload" WHERE "filename" = $1 LIMIT 1;`,
        filename
      );

      if (rows && rows.length > 0 && rows[0].payload) {
        const buffer = Buffer.from(rows[0].payload, "base64");
        await fs.promises.writeFile(localFilePath, buffer).catch(() => {});
        return buffer;
      }
    } catch (dbErr) {
      console.error(`[STORAGE_VAULT_DB_READ_ERROR] Failed to read '${filename}' from DB vault:`, dbErr);
    }

    throw new Error(`Backup file '${filename}' not found in recovery storage vault.`);
  }

  /**
   * Deletes a backup object from local cache and PostgreSQL storage vault.
   */
  public async deleteBackup(filename: string): Promise<boolean> {
    let deleted = false;

    try {
      const localFilePath = path.join(this.localBackupDir, filename);
      if (fs.existsSync(localFilePath)) {
        await fs.promises.unlink(localFilePath);
        deleted = true;
      }
    } catch (err) {
      console.error(`[STORAGE_VAULT_DELETE_LOCAL_ERROR] Failed to delete local '${filename}':`, err);
    }

    try {
      await this.ensureDatabaseVaultTable();
      await prisma.$executeRawUnsafe(
        `DELETE FROM "BackupPayload" WHERE "filename" = $1;`,
        filename
      );
      deleted = true;
    } catch (dbErr) {
      console.error(`[STORAGE_VAULT_DELETE_DB_ERROR] Failed to delete DB record '${filename}':`, dbErr);
    }

    return deleted;
  }
}

export const backupStorage = new BackupStorageProvider();