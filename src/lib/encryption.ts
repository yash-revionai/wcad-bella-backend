import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { AppError } from "./errors.js";
import { env } from "./env.js";

function getEncryptionKey() {
  const rawKey = env.ENCRYPTION_KEY;
  if (!rawKey) {
    throw new AppError("ENCRYPTION_KEY is required for Google token encryption", 503);
  }

  const key = /^[a-f0-9]{64}$/i.test(rawKey) ? Buffer.from(rawKey, "hex") : Buffer.from(rawKey, "base64");

  if (key.length !== 32) {
    throw new AppError("ENCRYPTION_KEY must be 32 bytes, encoded as 64 hex chars or base64", 503);
  }

  return key;
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptSecret(value: string) {
  const [version, iv, tag, encrypted] = value.split(":");

  if (version !== "v1" || !iv || !tag || !encrypted) {
    throw new AppError("Encrypted secret has an unsupported format", 500);
  }

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final()
  ]).toString("utf8");
}
