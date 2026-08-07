// Relative Path: src/types/crypto.ts

export interface EncryptedPayload {
  version: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

export interface KeyVaultConfig {
  activeVersion: string;
  keys: Record<string, string>;
  algorithm: "aes-256-gcm";
  ivLength: number;
  tagLength: number;
  prefix: string;
}

export type TransformableRecord = Record<string, any>;
