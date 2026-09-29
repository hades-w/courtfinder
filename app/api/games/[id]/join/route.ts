import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { id } = await context.params;
  const gameId = Number(id);
  if (!Number.isInteger(gameId)) return NextResponse.json({ error: "约球不存在" }, { status: 404 });

  const game = db.prepare("SELECT creator_id FROM games WHERE id = ?").get(gameId) as
    | { creator_id: number }
    | undefined;
  if (!game) return NextResponse.json({ error: "约球不存在" }, { status: 404 });
  if (game.creator_id !== user.id) return NextResponse.json({ error: "只能取消自己发起的约球" }, { status: 403 });

  db.prepare("DELETE FROM games WHERE id = ?").run(gameId);
  return NextResponse.json({ ok: true });
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { id } = await context.params;
  const gameId = Number(id);
  const game = db.prepare("SELECT id, players_needed, current_count FROM games WHERE id = ?").get(gameId) as
    | { id: number; players_needed: number; current_count: number }
    | undefined;

  if (!game) return NextResponse.json({ error: "约球不存在" }, { status: 404 });
  if (game.current_count >= game.players_needed) return NextResponse.json({ error: "该场约球已满员" }, { status: 409 });

  const joined = db.prepare("SELECT 1 FROM game_participants WHERE game_id = ? AND user_id = ?").get(gameId, user.id);
  if (joined) return NextResponse.json({ error: "你已加入该场约球" }, { status: 409 });

  db.transaction(() => {
    db.prepare("INSERT INTO game_participants (game_id, user_id) VALUES (?, ?)").run(gameId, user.id);
    db.prepare("UPDATE games SET current_count = current_count + 1 WHERE id = ?").run(gameId);
  })();

  const result = db.prepare("SELECT current_count, players_needed FROM games WHERE id = ?").get(gameId) as {
    current_count: number;
    players_needed: number;
  };
  return NextResponse.json(result);
}
