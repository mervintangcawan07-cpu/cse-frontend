// Relative Path: src/lib/crypto/fieldTransformer.ts

import { encrypt, decrypt, isEncrypted } from "@/lib/crypto/encryption";

export function transformForWrite<T extends Record<string, any>>(
  data: T,
  fieldsToEncrypt: (keyof T)[]
): T {
  if (!data || typeof data !== "object") return data;

  const transformed = { ...data };

  for (const field of fieldsToEncrypt) {
    const val = transformed[field];
    if (typeof val === "string" && val.length > 0 && !isEncrypted(val)) {
      transformed[field] = encrypt(val) as any;
    }
  }

  return transformed;
}

export function transformForRead<T extends Record<string, any>>(
  data: T,
  fieldsToDecrypt: (keyof T)[]
): T {
  if (!data || typeof data !== "object") return data;

  const transformed = { ...data };

  for (const field of fieldsToDecrypt) {
    const val = transformed[field];
    if (typeof val === "string") {
      transformed[field] = decrypt(val) as any;
    }
  }

  return transformed;
}

export function transformManyForRead<T extends Record<string, any>>(
  items: T[],
  fieldsToDecrypt: (keyof T)[]
): T[] {
  if (!Array.isArray(items)) return items;
  return items.map((item) => transformForRead(item, fieldsToDecrypt));
}
