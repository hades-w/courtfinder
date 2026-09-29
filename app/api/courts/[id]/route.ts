import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import type { Game } from "@/lib/courts";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const courtId = Number(id);
  if (!Number.isInteger(courtId)) return NextResponse.json({ error: "球场不存在" }, { status: 404 });

  const user = await getCurrentUser();
  const court = db.prepare(`
    SELECT c.*, c.user_id AS creator_id, u.display_name AS creator_name,
           ${user ? "EXISTS(SELECT 1 FROM court_likes cl WHERE cl.court_id = c.id AND cl.user_id = ?)" : "0"} AS liked_by_me
    FROM courts c JOIN users u ON u.id = c.user_id WHERE c.id = ?
  `).get(...(user ? [user.id] : []), courtId) as
    | (Game & { name: string; latitude: number; longitude: number; is_free: 0 | 1; price_info: string | null; venue_type: "indoor" | "outdoor"; full_courts: number; half_courts: number; description: string | null; likes_count: number; liked_by_me: 0 | 1; creator_name: string })
    | undefined;

  if (!court) return NextResponse.json({ error: "球场不存在" }, { status: 404 });

  const games = db.prepare(`
    SELECT g.id, g.court_id, g.starts_at, g.players_needed, g.current_count, g.creator_id, u.display_name AS creator_name,
           ${user ? "EXISTS(SELECT 1 FROM game_participants gp WHERE gp.game_id = g.id AND gp.user_id = ?)" : "0"} AS joined_by_me
    FROM games g JOIN users u ON u.id = g.creator_id
    WHERE g.court_id = ? AND g.starts_at >= ?
    ORDER BY g.starts_at
  `).all(...(user ? [user.id] : []), courtId, new Date().toISOString());

  return NextResponse.json({ court, games }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { id } = await context.params;
  const courtId = Number(id);
  if (!Number.isInteger(courtId)) return NextResponse.json({ error: "球场不存在" }, { status: 404 });

  const court = db.prepare("SELECT user_id FROM courts WHERE id = ?").get(courtId) as
    | { user_id: number }
    | undefined;
  if (!court) return NextResponse.json({ error: "球场不存在" }, { status: 404 });
  if (court.user_id !== user.id) return NextResponse.json({ error: "只能删除自己标记的球场" }, { status: 403 });

  db.prepare("DELETE FROM courts WHERE id = ?").run(courtId);
  return NextResponse.json({ ok: true });
}
