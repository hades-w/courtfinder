import crypto from "node:crypto";
import { cookies } from "next/headers";
import db from "./db";

const SESSION_DAYS = 30;
const secret = process.env.AUTH_SECRET ?? "courtfinder-development-secret-change-me";

export type SessionUser = {
  id: number;
  email: string;
  displayName: string;
};

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return derived.length === expectedBuffer.length && crypto.timingSafeEqual(derived, expectedBuffer);
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

export async function createSession(userId: number) {
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt })).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  const cookieStore = await cookies();
  cookieStore.set("courtfinder_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete("courtfinder_session");
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("courtfinder_session")?.value;
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature || sign(payload) !== signature) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      userId: number;
      expiresAt: number;
    };
    if (!parsed.userId || parsed.expiresAt < Date.now()) return null;

    const row = db
      .prepare("SELECT id, email, display_name FROM users WHERE id = ?")
      .get(parsed.userId) as { id: number; email: string; display_name: string } | undefined;

    return row ? { id: row.id, email: row.email, displayName: row.display_name } : null;
  } catch {
    return null;
  }
}
