import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { id } = await context.params;
  const courtId = Number(id);
  const court = db.prepare("SELECT id FROM courts WHERE id = ?").get(courtId);
  if (!court) return NextResponse.json({ error: "球场不存在" }, { status: 404 });

  const liked = db.prepare("SELECT 1 FROM court_likes WHERE user_id = ? AND court_id = ?").get(user.id, courtId);
  const transaction = db.transaction(() => {
    if (liked) {
      db.prepare("DELETE FROM court_likes WHERE user_id = ? AND court_id = ?").run(user.id, courtId);
      db.prepare("UPDATE courts SET likes_count = likes_count - 1 WHERE id = ? AND likes_count > 0").run(courtId);
    } else {
      db.prepare("INSERT INTO court_likes (user_id, court_id) VALUES (?, ?)").run(user.id, courtId);
      db.prepare("UPDATE courts SET likes_count = likes_count + 1 WHERE id = ?").run(courtId);
    }
  });
  transaction();

  const result = db.prepare("SELECT likes_count FROM courts WHERE id = ?").get(courtId) as { likes_count: number };
  return NextResponse.json({ liked: !liked, likesCount: result.likes_count });
}
