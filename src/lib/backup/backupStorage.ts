// Relative Path: src/lib/backup/backupStorage.ts
import fs from "fs";
import path from "path";
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
    this.localBackupDir = path.join(process.cwd(), "..", "csc_disaster_recovery_vault");
    if (!fs.existsSync(this.localBackupDir)) {
      fs.mkdirSync(this.localBackupDir, { recursive: true });
    }
  }

  /**
   * Calculates SHA-256 checksum of a Buffer payload.
   */
  public calculateChecksum(buffer: Buffer): string {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * Saves compressed backup payload to primary storage (Cloud or Local Vault Fallback)
   */
  public async saveBackup(
    filename: string,
    buffer: Buffer
  ): Promise<StorageObjectMeta> {
    const checksumSha256 = this.calculateChecksum(buffer);
    const storageKey = `backups/${new Date().getFullYear()}/${filename}`;
    
    // Save to isolated local disaster recovery vault
    const localFilePath = path.join(this.localBackupDir, filename);
    fs.writeFileSync(localFilePath, buffer);

    return {
      key: storageKey,
      sizeBytes: buffer.length,
      checksumSha256,
      location: localFilePath,
    };
  }

  /**
   * Reads a backup payload from disk/storage for verification or restoration.
   */
  public async getBackupPayload(filename: string): Promise<Buffer> {
    const localFilePath = path.join(this.localBackupDir, filename);
    if (!fs.existsSync(localFilePath)) {
      throw new Error(`Backup file '${filename}' not found in recovery storage vault.`);
    }
    return fs.readFileSync(localFilePath);
  }

  /**
   * Deletes a backup object from storage vault.
   */
  public async deleteBackup(filename: string): Promise<boolean> {
    const localFilePath = path.join(this.localBackupDir, filename);
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
      return true;
    }
    return false;
  }
}

export const backupStorage = new BackupStorageProvider();