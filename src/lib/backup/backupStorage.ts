// Relative Path: src/lib/backup/backupStorage.ts
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

export interface StorageObjectMeta {
  key: string;
  sizeBytes: number;
  checksumSha256: string;
  location: string;
}

export class BackupStorageProvider {
  private localBackupDir: string;

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
   * Calculates SHA-256 checksum of a Buffer payload.
   */
  public calculateChecksum(buffer: Buffer): string {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * Saves compressed backup payload to storage vault.
   */
  public async saveBackup(
    filename: string,
    buffer: Buffer
  ): Promise<StorageObjectMeta> {
    this.ensureVaultDirectory();
    const checksumSha256 = this.calculateChecksum(buffer);
    const storageKey = `backups/${new Date().getFullYear()}/${filename}`;
    const localFilePath = path.join(this.localBackupDir, filename);
    
    await fs.promises.writeFile(localFilePath, buffer);

    return {
      key: storageKey,
      sizeBytes: buffer.length,
      checksumSha256,
      location: localFilePath,
    };
  }

  /**
   * Reads a backup payload from vault storage for verification or restoration.
   */
  public async getBackupPayload(filename: string): Promise<Buffer> {
    const localFilePath = path.join(this.localBackupDir, filename);
    if (!fs.existsSync(localFilePath)) {
      throw new Error(`Backup file '${filename}' not found in recovery storage vault.`);
    }
    return await fs.promises.readFile(localFilePath);
  }

  /**
   * Deletes a backup object from storage vault.
   */
  public async deleteBackup(filename: string): Promise<boolean> {
    try {
      const localFilePath = path.join(this.localBackupDir, filename);
      if (fs.existsSync(localFilePath)) {
        await fs.promises.unlink(localFilePath);
        return true;
      }
      return false;
    } catch (err) {
      console.error(`[STORAGE_VAULT_DELETE_ERROR] Failed to delete '${filename}':`, err);
      return false;
    }
  }
}

export const backupStorage = new BackupStorageProvider();