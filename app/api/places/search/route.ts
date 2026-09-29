import { NextResponse } from "next/server";
import { gcj02ToWgs84, wgs84ToGcj02 } from "@/lib/coordinates";
import type { PlaceResult } from "@/lib/places";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const latitude = Number(searchParams.get("lat"));
  const longitude = Number(searchParams.get("lng"));

  if (!query) return NextResponse.json({ error: "请输入搜索关键词" }, { status: 400 });

  const amapKey = process.env.AMAP_WEB_KEY;
  const center = Number.isFinite(latitude) && Number.isFinite(longitude)
    ? wgs84ToGcj02(latitude, longitude)
    : null;

  if (amapKey) {
    try {
      const url = new URL("https://restapi.amap.com/v3/place/text");
      url.searchParams.set("key", amapKey);
      url.searchParams.set("keywords", query);
      url.searchParams.set("offset", "5");
      url.searchParams.set("page", "1");
      url.searchParams.set("extensions", "base");
      if (center) url.searchParams.set("location", `${center[1]},${center[0]}`);

      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) });
      if (!response.ok) return NextResponse.json({ error: "位置搜索失败" }, { status: 502 });
      const data = await response.json().catch(() => null) as { status?: string; info?: string; pois?: Array<Record<string, string>> } | null;
      if (data?.status !== "1") return NextResponse.json({ error: data?.info || "位置搜索失败" }, { status: 502 });
      if (Array.isArray(data.pois)) {
        const results = data.pois
          .map((poi: Record<string, string>, index: number): PlaceResult | null => {
            const [poiLongitude, poiLatitude] = String(poi.location ?? "").split(",").map(Number);
            if (!Number.isFinite(poiLatitude) || !Number.isFinite(poiLongitude)) return null;
            const [wgsLatitude, wgsLongitude] = gcj02ToWgs84(poiLatitude, poiLongitude);
            const address = [poi.pname, poi.cityname, poi.adname, poi.address].filter(Boolean).join(" ");
            return {
              id: `amap-${poi.id ?? index}`,
              name: poi.name,
              address: address || poi.name,
              latitude: wgsLatitude,
              longitude: wgsLongitude,
            };
          })
          .filter(Boolean) as PlaceResult[];

        return NextResponse.json({ results });
      }
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      return NextResponse.json(
        { error: timedOut ? "高德位置搜索超时，请稍后重试" : "位置搜索失败" },
        { status: timedOut ? 504 : 502 },
      );
    }
  }

  return NextResponse.json(
    { error: "请在项目根目录 .env.local 中配置 AMAP_WEB_KEY（高德 Web 服务 Key）后重启开发服务" },
    { status: 503 },
  );
}
