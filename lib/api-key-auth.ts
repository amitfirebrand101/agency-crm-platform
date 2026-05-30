import { createHash } from "crypto";
import { prisma } from "./prisma";

export type ApiKeyValidationResult =
  | {
      valid: true;
      keyId: string;
      agencyId: string;
      subAccountId: string | null;
      scopes: string[];
    }
  | { valid: false; reason: string };

export async function validateApiKey(
  rawKey: string
): Promise<ApiKeyValidationResult> {
  const hash = createHash("sha256").update(rawKey).digest("hex");

  const key = await prisma.apiKey.findUnique({
    where: { keyHash: hash },
    select: {
      id: true,
      agencyId: true,
      subAccountId: true,
      scopes: true,
      revokedAt: true,
      expiresAt: true,
    },
  });

  if (!key) return { valid: false, reason: "Invalid API key" };
  if (key.revokedAt) return { valid: false, reason: "API key has been revoked" };
  if (key.expiresAt && key.expiresAt < new Date()) {
    return { valid: false, reason: "API key has expired" };
  }

  // Update lastUsedAt in background (fire-and-forget)
  void prisma.apiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    valid: true,
    keyId: key.id,
    agencyId: key.agencyId,
    subAccountId: key.subAccountId,
    scopes: key.scopes,
  };
}

export async function logApiKeyUsage(
  keyId: string,
  method: string,
  path: string,
  ipAddress: string | null,
  statusCode: number,
  durationMs: number
): Promise<void> {
  await prisma.apiKeyUsageLog.create({
    data: {
      apiKeyId: keyId,
      method,
      path,
      ipAddress,
      statusCode,
      durationMs,
    },
  });
}
