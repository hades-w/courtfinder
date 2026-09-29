import { NextResponse } from "next/server";
import db from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  const user = db.prepare("SELECT id, email, password_hash, display_name FROM users WHERE email = ?").get(email) as
    | { id: number; email: string; password_hash: string; display_name: string }
    | undefined;

  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "邮箱或密码不正确" }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ id: user.id, email: user.email, displayName: user.display_name });
}
