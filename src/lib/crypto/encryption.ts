// Relative Path: src/lib/crypto/encryption.ts

import crypto from "crypto";
import { logger } from "@/lib/logger/logger";
import { EncryptedPayload } from "@/types/crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const DEFAULT_VERSION = "v1";
const PREFIX = "enc:";

function getKeyForVersion(version: string): Buffer {
  const envVarName = version === "v1" ? "ENCRYPTION_KEY_V1" : `ENCRYPTION_KEY_${version.toUpperCase()}`;
  const rawKey =
    process.env[envVarName] ||
    process.env.ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    "govstudyx_default_secure_encryption_key_2026";

  return crypto.createHash("sha256").update(rawKey.trim()).digest();
}

export function isEncrypted(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return value.startsWith(PREFIX);
}

export function encrypt(plaintext: string | null | undefined, keyVersion: string = DEFAULT_VERSION): string | null {
  if (plaintext === null || plaintext === undefined || plaintext === "") {
    return (plaintext as null) ?? null;
  }

  if (isEncrypted(plaintext)) {
    return plaintext;
  }

  try {
    const key = getKeyForVersion(keyVersion);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

    let ciphertext = cipher.update(plaintext, "utf8", "hex");
    ciphertext += cipher.final("hex");

    const tag = cipher.getAuthTag().toString("hex");
    const ivHex = iv.toString("hex");

    return `${PREFIX}${keyVersion}:${ivHex}:${tag}:${ciphertext}`;
  } catch (err: any) {
    logger.error("Encryption failed for field payload", {
      context: { reason: err?.message || "CRYPTO_ENCRYPT_ERROR", keyVersion },
    });
    throw new Error("Failed to encrypt field data.");
  }
}

export function decrypt(encryptedText: string | null | undefined): string | null {
  if (!encryptedText || typeof encryptedText !== "string") {
    return encryptedText ?? null;
  }

  if (!isEncrypted(encryptedText)) {
    return encryptedText;
  }

  try {
    const payloadWithoutPrefix = encryptedText.slice(PREFIX.length);
    const parts = payloadWithoutPrefix.split(":");

    if (parts.length !== 4) {
      logger.error("Corrupted encrypted payload format encountered", {
        context: { reason: "MALFORMED_ENCRYPTED_PAYLOAD_PARTS" },
      });
      return encryptedText;
    }

    const [version, ivHex, tagHex, ciphertextHex] = parts;
    const key = getKeyForVersion(version);

    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err: any) {
    logger.error("Decryption failure or payload tampering detected", {
      context: { reason: err?.message || "CRYPTO_DECRYPT_ERROR" },
    });
    return encryptedText;
  }
}

export function parseEncryptedPayload(encryptedText: string): EncryptedPayload | null {
  if (!isEncrypted(encryptedText)) return null;

  const payloadWithoutPrefix = encryptedText.slice(PREFIX.length);
  const parts = payloadWithoutPrefix.split(":");

  if (parts.length !== 4) return null;

  const [version, iv, tag, ciphertext] = parts;
  return { version, iv, tag, ciphertext };
}
