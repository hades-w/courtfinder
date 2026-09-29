import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const latitude = Number(body?.latitude);
  const longitude = Number(body?.longitude);
  const isFree = Boolean(body?.isFree);
  const priceInfo = String(body?.priceInfo ?? "").trim();
  const venueType = body?.venueType === "indoor" ? "indoor" : "outdoor";
  const fullCourts = Number(body?.fullCourts ?? 0);
  const halfCourts = Number(body?.halfCourts ?? 0);
  const description = String(body?.description ?? "").trim();

  if (!name || name.length > 60) return NextResponse.json({ error: "球场名称必填，且不超过 60 字" }, { status: 400 });
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: "请在地图上选择有效位置" }, { status: 400 });
  }
  if (!isFree && !priceInfo) return NextResponse.json({ error: "收费球场必须填写收费标准" }, { status: 400 });
  if (!Number.isInteger(fullCourts) || fullCourts < 0 || !Number.isInteger(halfCourts) || halfCourts < 0 || fullCourts + halfCourts === 0) {
    return NextResponse.json({ error: "请填写全场或半场数量" }, { status: 400 });
  }

  const result = db.prepare(`
    INSERT INTO courts (user_id, name, latitude, longitude, is_free, price_info, venue_type, full_courts, half_courts, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(user.id, name, latitude, longitude, isFree ? 1 : 0, isFree ? null : priceInfo, venueType, fullCourts, halfCourts, description || null);

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}
