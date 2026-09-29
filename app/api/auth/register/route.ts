import { NextResponse } from "next/server";
import db from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const displayName = String(body?.displayName ?? "").trim();
  const password = String(body?.password ?? "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "请输入有效邮箱" }, { status: 400 });
  }
  if (displayName.length < 1 || displayName.length > 30) {
    return NextResponse.json({ error: "昵称需要 1-30 个字符" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "密码至少 8 位" }, { status: 400 });
  }

  try {
    const result = db
      .prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)")
      .run(email, hashPassword(password), displayName);
    await createSession(Number(result.lastInsertRowid));
    return NextResponse.json({ id: result.lastInsertRowid, email, displayName }, { status: 201 });
  } catch (error) {
    if (String(error).includes("UNIQUE")) {
      return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });
    }
    throw error;
  }
}
