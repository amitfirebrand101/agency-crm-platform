/**
 * AES-256-GCM symmetric encryption for sensitive provider credentials.
 *
 * Encryption key is stored in CREDENTIAL_ENCRYPTION_KEY env var.
 * Generate with: openssl rand -hex 32
 *
 * Each encryption call uses a fresh random IV (12 bytes) and produces a
 * 16-byte authentication tag. Both are stored alongside the ciphertext in
 * the ProviderCredential table as hex strings.
 *
 * This is NOT a public-key scheme — anyone with the CREDENTIAL_ENCRYPTION_KEY
 * can decrypt. Treat the key like a root password and rotate it if compromised.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES   = 12; // 96-bit IV recommended for GCM

function getKey(): Buffer {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "CREDENTIAL_ENCRYPTION_KEY is not set. " +
      "Generate one with: openssl rand -hex 32"
    );
  }
  const hex = raw.replace(/^["']|["']$/g, "").trim();
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "CREDENTIAL_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)."
    );
  }
  return Buffer.from(hex, "hex");
}

export type EncryptedBlob = {
  encryptedData: string; // hex
  iv: string;            // hex
  authTag: string;       // hex
};

/**
 * Encrypt a plaintext string (typically JSON.stringify of a credentials object).
 * Returns separate hex strings for ciphertext, IV, and GCM auth tag.
 */
export function encryptCredential(plaintext: string): EncryptedBlob {
  const key = getKey();
  const iv  = randomBytes(IV_BYTES);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedData: encrypted.toString("hex"),
    iv:            iv.toString("hex"),
    authTag:       authTag.toString("hex"),
  };
}

/**
 * Decrypt a credential blob previously produced by encryptCredential().
 * Throws if the key is wrong or the data has been tampered with.
 */
export function decryptCredential(blob: EncryptedBlob): string {
  const key = getKey();
  const iv      = Buffer.from(blob.iv,            "hex");
  const authTag = Buffer.from(blob.authTag,       "hex");
  const data    = Buffer.from(blob.encryptedData, "hex");

  if (iv.length !== IV_BYTES) {
    throw new Error("Invalid IV length — data may be corrupted.");
  }
  if (authTag.length !== 16) {
    throw new Error("Invalid auth tag length — data may be corrupted.");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(data),
    decipher.final(),
  ]).toString("utf8");
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: encrypt/decrypt typed credential objects
// ─────────────────────────────────────────────────────────────────────────────

export function encryptObject<T extends Record<string, unknown>>(obj: T): EncryptedBlob {
  return encryptCredential(JSON.stringify(obj));
}

export function decryptObject<T extends Record<string, unknown>>(blob: EncryptedBlob): T {
  return JSON.parse(decryptCredential(blob)) as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: generate a cryptographically secure random token
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a URL-safe random token of the given byte length (default 32 bytes = 64 hex chars). */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}
