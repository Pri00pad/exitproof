import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { siteUrl } from "./supabase/env";

// HR verification tokens: 256-bit random, URL-safe. Only the SHA-256 hex hash
// is ever sent to the database; the raw token exists only in the link.
export function createVerifyToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashVerifyToken(token) };
}

export function hashVerifyToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyUrl(token: string): string {
  return `${siteUrl()}/verify/${token}`;
}
