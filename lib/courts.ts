export type Court = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  is_free: 0 | 1;
  price_info: string | null;
  venue_type: "indoor" | "outdoor";
  full_courts: number;
  half_courts: number;
  description: string | null;
  likes_count: number;
  liked_by_me: 0 | 1;
  creator_id: number;
  creator_name: string;
};

export type Game = {
  id: number;
  court_id: number;
  court_name: string;
  creator_name: string;
  starts_at: string;
  players_needed: number;
  current_count: number;
  joined_by_me: 0 | 1;
  creator_id: number;
};

export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
