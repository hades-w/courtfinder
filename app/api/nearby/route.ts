import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { distanceMeters, type Court, type Game } from "@/lib/courts";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const latitude = Number(url.searchParams.get("lat"));
  const longitude = Number(url.searchParams.get("lng"));
  const radius = Math.min(Number(url.searchParams.get("radius") ?? 3000), 3000);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: "定位坐标无效" }, { status: 400 });
  }

  const user = await getCurrentUser();
  const latRange = radius / 111320;
  const lngRange = radius / (111320 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.01));

  const courtRows = db.prepare(`
    SELECT c.*, c.user_id AS creator_id, u.display_name AS creator_name,
           ${user ? "EXISTS(SELECT 1 FROM court_likes cl WHERE cl.court_id = c.id AND cl.user_id = ?)" : "0"} AS liked_by_me
    FROM courts c
    JOIN users u ON u.id = c.user_id
    WHERE c.latitude BETWEEN ? AND ? AND c.longitude BETWEEN ? AND ?
  `).all(
    ...(user ? [user.id] : []),
    latitude - latRange,
    latitude + latRange,
    longitude - lngRange,
    longitude + lngRange,
  ) as Array<Court & { creator_name: string; liked_by_me: 0 | 1 }>;

  const courts = (courtRows as Court[]).filter(
    (court) => distanceMeters(latitude, longitude, court.latitude, court.longitude) <= radius,
  );

  const gameRows = db.prepare(`
    SELECT g.id, g.court_id, g.starts_at, g.players_needed, g.current_count, g.creator_id,
           c.name AS court_name, u.display_name AS creator_name,
           ${user ? "EXISTS(SELECT 1 FROM game_participants gp WHERE gp.game_id = g.id AND gp.user_id = ?)" : "0"} AS joined_by_me
    FROM games g
    JOIN courts c ON c.id = g.court_id
    JOIN users u ON u.id = g.creator_id
    WHERE c.latitude BETWEEN ? AND ? AND c.longitude BETWEEN ? AND ? AND g.starts_at >= ?
  `).all(
    ...(user ? [user.id] : []),
    latitude - latRange,
    latitude + latRange,
    longitude - lngRange,
    longitude + lngRange,
    new Date().toISOString(),
  );

  const games = (gameRows as Game[]).filter((game) => {
    const court = courts.find((item) => item.id === game.court_id);
    return court && distanceMeters(latitude, longitude, court.latitude, court.longitude) <= radius;
  });

  return NextResponse.json({ courts, games }, { headers: { "Cache-Control": "no-store" } });
}
