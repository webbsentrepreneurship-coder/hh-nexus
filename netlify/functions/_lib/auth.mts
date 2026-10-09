import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";

export function usersStore() {
  return getStore("users");
}
export function sessionsStore() {
  return getStore("sessions");
}
export function journalsStore() {
  return getStore("journals");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const attempt = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (attempt.length !== expected.length) return false;
  return timingSafeEqual(attempt, expected);
}

export function createSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function getEmailFromRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const email = await sessionsStore().get(token, { type: "text" });
  return email || null;
}
