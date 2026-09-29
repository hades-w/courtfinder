import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import type { Game } from "@/lib/courts";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const games = db.prepare(`
    SELECT g.id, g.court_id, g.starts_at, g.players_needed, g.current_count, g.creator_id, 1 AS joined_by_me,
           c.name AS court_name, c.latitude, c.longitude, u.display_name AS creator_name
    FROM games g
    JOIN game_participants gp ON gp.game_id = g.id AND gp.user_id = ?
    JOIN courts c ON c.id = g.court_id
    JOIN users u ON u.id = g.creator_id
    WHERE g.starts_at >= ?
    ORDER BY g.starts_at
  `).all(user.id, new Date().toISOString());

  return NextResponse.json({ games: games as Game[] }, { headers: { "Cache-Control": "no-store" } });
}
