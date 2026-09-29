import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const courtId = Number(body?.courtId);
  const startsAtRaw = String(body?.startsAt ?? "");
  const playersNeeded = Number(body?.playersNeeded);
  const startsAt = new Date(startsAtRaw);

  if (!Number.isInteger(courtId)) return NextResponse.json({ error: "请选择球场" }, { status: 400 });
  if (!startsAtRaw || Number.isNaN(startsAt.getTime()) || startsAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "请选择未来的约球时间" }, { status: 400 });
  }
  if (!Number.isInteger(playersNeeded) || playersNeeded < 1 || playersNeeded > 100) {
    return NextResponse.json({ error: "需要人数为 1-100 人" }, { status: 400 });
  }

  const court = db.prepare("SELECT id FROM courts WHERE id = ?").get(courtId);
  if (!court) return NextResponse.json({ error: "球场不存在" }, { status: 404 });

  const gameId = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO games (court_id, creator_id, starts_at, players_needed, current_count)
      VALUES (?, ?, ?, ?, 1)
    `).run(courtId, user.id, startsAt.toISOString(), playersNeeded);
    db.prepare("INSERT INTO game_participants (game_id, user_id) VALUES (?, ?)").run(Number(result.lastInsertRowid), user.id);
    return Number(result.lastInsertRowid);
  })();

  return NextResponse.json({ id: gameId }, { status: 201 });
}
