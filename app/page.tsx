"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { Court, Game } from "@/lib/courts";
import type { PlaceResult } from "@/lib/places";

const CourtMap = dynamic(() => import("@/components/CourtMap"), {
  ssr: false,
  loading: () => <div className="map-loading">地图加载中…</div>,
});

type User = { id: number; email: string; displayName: string };
type CourtDetail = Court & { games: Game[] };

async function parseJson<T>(response: Response): Promise<T | null> {
  try {
    return await response.json() as T;
  } catch {
    return null;
  }
}

const emptyCourtForm = {
  name: "",
  isFree: true,
  priceInfo: "",
  venueType: "outdoor" as "indoor" | "outdoor",
  fullCourts: "1",
  halfCourts: "0",
  description: "",
};

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({ email: "", password: "", displayName: "" });
  const [center, setCenter] = useState<[number, number]>([39.908823, 116.39747]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [myGames, setMyGames] = useState<Game[]>([]);
  const [selectedCourt, setSelectedCourt] = useState<CourtDetail | null>(null);
  const [markingMode, setMarkingMode] = useState(false);
  const [draftPosition, setDraftPosition] = useState<[number, number] | null>(null);
  const [courtForm, setCourtForm] = useState(emptyCourtForm);
  const [gameForm, setGameForm] = useState({ startsAt: "", playersNeeded: "10" });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [locationStatus, setLocationStatus] = useState("正在获取定位…");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);

  const showMessage = (type: "success" | "error", text: string) => setMessage({ type, text });

  const loadNearby = useCallback(async (latitude: number, longitude: number) => {
    const response = await fetch(`/api/nearby?lat=${latitude}&lng=${longitude}`);
    const data = await parseJson<{ error?: string; courts?: Court[]; games?: Game[] }>(response);
    if (!data) throw new Error("加载附近球场失败");
    if (!response.ok) throw new Error(data.error ?? "加载附近球场失败");
    setCourts(data.courts ?? []);
    setGames(data.games ?? []);
  }, []);

  const loadMyGames = useCallback(async () => {
    const response = await fetch("/api/games/mine");
    const data = await parseJson<{ games?: Game[] }>(response);
    if (response.ok) setMyGames(data?.games ?? []);
  }, []);

  const goToPlace = async (place: PlaceResult) => {
    const nextCenter: [number, number] = [place.latitude, place.longitude];
    setCenter(nextCenter);
    setLocationStatus(`已定位到 ${place.name}`);
    setSearchQuery(place.name);
    setSearchResults([]);
    await loadNearby(nextCenter[0], nextCenter[1]);
  };

  const submitSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const response = await fetch(`/api/places/search?q=${encodeURIComponent(searchQuery)}&lat=${center[0]}&lng=${center[1]}`);
      const data = await parseJson<{ error?: string; results?: PlaceResult[] }>(response);
      if (!data) throw new Error("位置搜索响应异常");
      if (!response.ok) throw new Error(data.error ?? "位置搜索失败");
      setSearchResults(data.results ?? []);
      if ((data.results ?? []).length === 0) showMessage("success", "没有找到该位置");
    } catch (error) {
      showMessage("error", error instanceof Error ? error.message : "位置搜索失败");
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      const response = await fetch("/api/auth/me");
      const data = await parseJson<{ user?: User | null }>(response);
      setUser(data?.user ?? null);
      if (data?.user) await loadMyGames();

      if (!navigator.geolocation) {
        setLocationStatus("浏览器不支持定位，已显示默认位置");
        await loadNearby(39.908823, 116.39747).catch(() => showMessage("error", "附近球场加载失败"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const nextCenter: [number, number] = [position.coords.latitude, position.coords.longitude];
          setCenter(nextCenter);
          setLocationStatus("已定位到当前位置");
          await loadNearby(nextCenter[0], nextCenter[1]).catch(() => showMessage("error", "附近球场加载失败"));
        },
        async () => {
          setLocationStatus("定位失败或未授权，已显示默认位置");
          await loadNearby(39.908823, 116.39747).catch(() => showMessage("error", "附近球场加载失败"));
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    };
    void initialize();
  }, [loadMyGames, loadNearby]);

  const selectCourt = async (courtId: number, locate = false) => {
    const response = await fetch(`/api/courts/${courtId}`);
    const data = await parseJson<{ error?: string; court?: Court; games?: Game[] }>(response);
    if (!data?.court) return showMessage("error", data?.error ?? "获取球场详情失败");
    if (!response.ok) return showMessage("error", data.error ?? "获取球场详情失败");
    const court = { ...data.court, games: data.games ?? [] };
    setSelectedCourt(court);

    if (locate) {
      const nextCenter: [number, number] = [court.latitude, court.longitude];
      setCenter(nextCenter);
      setLocationStatus(`已定位到 ${court.name}`);
      await loadNearby(nextCenter[0], nextCenter[1]);
    }
  };

  const submitAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(authForm),
    });
    const data = await parseJson<{ error?: string }>(response);
    if (!data) return showMessage("error", "操作失败");
    if (!response.ok) return showMessage("error", data.error ?? "操作失败");

    const meResponse = await fetch("/api/auth/me");
    const meData = await parseJson<{ user?: User | null }>(meResponse);
    setUser(meData?.user ?? null);
    await loadMyGames();
    showMessage("success", authMode === "login" ? "登录成功" : "注册成功");
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setMyGames([]);
    showMessage("success", "已退出登录");
  };

  const submitCourt = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draftPosition) return showMessage("error", "请先在地图上点击球场位置");

    const response = await fetch("/api/courts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...courtForm,
        latitude: draftPosition[0],
        longitude: draftPosition[1],
        fullCourts: Number(courtForm.fullCourts),
        halfCourts: Number(courtForm.halfCourts),
      }),
    });
    const data = await parseJson<{ error?: string; id?: number | string }>(response);
    if (!data) return showMessage("error", "标记球场失败");
    if (!response.ok) return showMessage("error", data.error ?? "标记球场失败");

    await loadNearby(center[0], center[1]);
    setMarkingMode(false);
    setDraftPosition(null);
    setCourtForm(emptyCourtForm);
    await selectCourt(Number(data.id));
    showMessage("success", "球场标记成功");
  };

  const toggleLike = async (courtId: number) => {
    if (!user) return showMessage("error", "请先登录后再点赞");
    const response = await fetch(`/api/courts/${courtId}/like`, { method: "POST" });
    const data = await parseJson<{ error?: string; liked?: boolean; likesCount?: number }>(response);
    if (!data) return showMessage("error", "点赞失败");
    if (!response.ok) return showMessage("error", data.error ?? "点赞失败");

    const liked = data.liked ? 1 : 0;
    const likesCount = data.likesCount ?? 0;
    setCourts((current) =>
      current.map((court) =>
        court.id === courtId
          ? { ...court, liked_by_me: liked, likes_count: likesCount }
          : court,
      ),
    );
    if (selectedCourt?.id === courtId) {
      setSelectedCourt({ ...selectedCourt, liked_by_me: liked, likes_count: likesCount });
    }
  };

  const deleteCourt = async (courtId: number) => {
    if (!user || !window.confirm("确定删除该球场？相关约球也会删除。")) return;
    const response = await fetch(`/api/courts/${courtId}`, { method: "DELETE" });
    const data = await parseJson<{ error?: string }>(response);
    if (!response.ok || !data) return showMessage("error", data?.error ?? "删除球场失败");

    setSelectedCourt(null);
    await loadNearby(center[0], center[1]);
    await loadMyGames();
    showMessage("success", "球场已删除");
  };

  const deleteGame = async (gameId: number) => {
    if (!user || !window.confirm("确定取消该约球？")) return;
    const response = await fetch(`/api/games/${gameId}/join`, { method: "DELETE" });
    const data = await parseJson<{ error?: string }>(response);
    if (!response.ok || !data) return showMessage("error", data?.error ?? "取消约球失败");

    await loadNearby(center[0], center[1]);
    if (selectedCourt) await selectCourt(selectedCourt.id);
    await loadMyGames();
    showMessage("success", "约球已取消");
  };

  const submitGame = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCourt) return showMessage("error", "请先选择球场");
    const response = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courtId: selectedCourt.id,
        startsAt: new Date(gameForm.startsAt).toISOString(),
        playersNeeded: Number(gameForm.playersNeeded),
      }),
    });
    const data = await parseJson<{ error?: string }>(response);
    if (!data) return showMessage("error", "发起约球失败");
    if (!response.ok) return showMessage("error", data.error ?? "发起约球失败");

    await loadNearby(center[0], center[1]);
    await selectCourt(selectedCourt.id);
    await loadMyGames();
    setGameForm({ startsAt: "", playersNeeded: "10" });
    showMessage("success", "约球已发起");
  };

  const joinGame = async (gameId: number) => {
    if (!user) return showMessage("error", "请先登录后再加入约球");
    const response = await fetch(`/api/games/${gameId}/join`, { method: "POST" });
    const data = await parseJson<{ error?: string }>(response);
    if (!data) return showMessage("error", "加入失败");
    if (!response.ok) return showMessage("error", data.error ?? "加入失败");

    await loadNearby(center[0], center[1]);
    if (selectedCourt) await selectCourt(selectedCourt.id);
    await loadMyGames();
    showMessage("success", "加入成功");
  };

  const formatTime = (value: string) => new Date(value).toLocaleString("zh-CN", { hour12: false });

  return (
    <main className="page">
      <header className="app-header">
        <div>
          <h1>CourtFinder</h1>
          <p>{locationStatus} · 周边约 3 公里</p>
        </div>
        {user ? (
          <div className="user-box">
            <span>你好，{user.displayName}</span>
            <button className="secondary" onClick={logout}>退出</button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={submitAuth}>
            <div className="tab-row">
              <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>登录</button>
              <button type="button" className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>注册</button>
            </div>
            <input type="email" placeholder="邮箱" required value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} />
            {authMode === "register" && (
              <input type="text" placeholder="昵称" required value={authForm.displayName} onChange={(event) => setAuthForm({ ...authForm, displayName: event.target.value })} />
            )}
            <input type="password" placeholder="密码（至少 8 位）" required minLength={8} value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} />
            <button type="submit">{authMode === "login" ? "登录" : "注册并登录"}</button>
          </form>
        )}
      </header>

      {message && <div className={`notice ${message.type}`} role="status">{message.text}</div>}

      <section className="map-card">
        <div className="map-toolbar">
          <div className="search-box">
            <form onSubmit={submitSearch}>
              <input
                placeholder="搜索位置，例如小区、公园、学校"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              <button className="search-button" type="submit" disabled={searching}>{searching ? "搜索中…" : "搜索"}</button>
            </form>
            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((place) => (
                  <button key={place.id} onClick={() => goToPlace(place)}>
                    <strong>{place.name}</strong>
                    <span>{place.address}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className={markingMode ? "danger" : ""} onClick={() => setMarkingMode(!markingMode)}>
            {markingMode ? "取消标注" : "我要标注球场"}
          </button>
          <span>{markingMode ? "点击地图选择球场位置" : "点击球场图标查看详情"}</span>
        </div>
        <CourtMap
          center={center}
          courts={courts}
          selectedCourtId={selectedCourt?.id ?? null}
          draftPosition={draftPosition}
          markingMode={markingMode}
          onMapClick={(position) => {
            if (!markingMode) return;
            setDraftPosition([position.lat, position.lng]);
          }}
          onSelectCourt={selectCourt}
        />
      </section>

      <section className="content-grid">
        <article className="panel">
          <h2>{markingMode ? "标记球场" : "球场详情"}</h2>
          {markingMode ? (
            <form onSubmit={submitCourt} className="form-grid">
              <input placeholder="球场名称" required value={courtForm.name} onChange={(event) => setCourtForm({ ...courtForm, name: event.target.value })} />
              <label className="checkbox"><input type="checkbox" checked={courtForm.isFree} onChange={(event) => setCourtForm({ ...courtForm, isFree: event.target.checked })} /> 免费球场</label>
              {!courtForm.isFree && (
                <input placeholder="收费标准，例如 30 元/小时" required value={courtForm.priceInfo} onChange={(event) => setCourtForm({ ...courtForm, priceInfo: event.target.value })} />
              )}
              <select value={courtForm.venueType} onChange={(event) => setCourtForm({ ...courtForm, venueType: event.target.value as "indoor" | "outdoor" })}>
                <option value="outdoor">室外</option>
                <option value="indoor">室内</option>
              </select>
              <div className="two-inputs">
                <input type="number" min="0" placeholder="全场数" required value={courtForm.fullCourts} onChange={(event) => setCourtForm({ ...courtForm, fullCourts: event.target.value })} />
                <input type="number" min="0" placeholder="半场数" required value={courtForm.halfCourts} onChange={(event) => setCourtForm({ ...courtForm, halfCourts: event.target.value })} />
              </div>
              <textarea placeholder="备注（可选）" value={courtForm.description} onChange={(event) => setCourtForm({ ...courtForm, description: event.target.value })} />
              <button type="submit">保存球场</button>
            </form>
          ) : selectedCourt ? (
            <div className="court-detail">
              <div className="detail-head">
                <h3>{selectedCourt.name}</h3>
                <button className={selectedCourt.liked_by_me ? "liked" : "secondary"} onClick={() => toggleLike(selectedCourt.id)}>
                  👍 {selectedCourt.likes_count}
                </button>
              </div>
              <dl>
                <div><dt>类型</dt><dd>{selectedCourt.venue_type === "indoor" ? "室内" : "室外"}</dd></div>
                <div><dt>收费</dt><dd>{selectedCourt.is_free ? "免费" : selectedCourt.price_info}</dd></div>
                <div><dt>场地</dt><dd>全场 {selectedCourt.full_courts} 个 · 半场 {selectedCourt.half_courts} 个</dd></div>
                <div><dt>标记人</dt><dd>{selectedCourt.creator_name}</dd></div>
                {selectedCourt.description && <div><dt>备注</dt><dd>{selectedCourt.description}</dd></div>}
              </dl>

              <h4>该球场约球</h4>
              {selectedCourt.games.length === 0 ? <p>暂无约球。</p> : selectedCourt.games.map((game) => (
                <div className="game-item" key={game.id}>
                  <strong>{formatTime(game.starts_at)}</strong>
                  <span>{game.current_count}/{game.players_needed} 人 · 发起人 {game.creator_name}</span>
                  {game.creator_id === user?.id ? (
                    <button className="danger" onClick={() => deleteGame(game.id)}>取消</button>
                  ) : (
                    <button disabled={!user || game.joined_by_me === 1 || game.current_count >= game.players_needed} onClick={() => joinGame(game.id)}>
                      {game.joined_by_me ? "已加入" : game.current_count >= game.players_needed ? "已满员" : "加入"}
                    </button>
                  )}
                </div>
              ))}

              {user && (
                <form onSubmit={submitGame} className="game-form">
                  <h4>发起约球</h4>
                  <input type="datetime-local" required value={gameForm.startsAt} onChange={(event) => setGameForm({ ...gameForm, startsAt: event.target.value })} />
                  <input type="number" min="1" max="100" required placeholder="需要总人数" value={gameForm.playersNeeded} onChange={(event) => setGameForm({ ...gameForm, playersNeeded: event.target.value })} />
                  <button type="submit">发布约球</button>
                </form>
              )}
            </div>
          ) : (
            <p className="muted">点击地图上的篮球图标查看球场信息。</p>
          )}
        </article>

        <article className="panel">
          <h2>附近球场</h2>
          {courts.length === 0 ? <p className="muted">附近暂无球场，你可以成为第一个标记者。</p> : (
            <ul className="list">
              {courts.map((court) => (
                <li key={court.id}>
                  <div className="row-actions">
                    <button className={selectedCourt?.id === court.id ? "active" : ""} onClick={() => selectCourt(court.id)}>
                      <strong>{court.name}</strong>
                      <span>{court.venue_type === "indoor" ? "室内" : "室外"} · {court.is_free ? "免费" : court.price_info} · 👍 {court.likes_count}</span>
                    </button>
                    {court.creator_id === user?.id && <button className="danger" onClick={() => deleteCourt(court.id)}>删除</button>}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h2>附近约球</h2>
          {games.length === 0 ? <p className="muted">附近暂无约球。</p> : (
            <ul className="list">
              {games.map((game) => (
                <li key={game.id}>
                  <div className="row-actions">
                    <button className={selectedCourt?.id === game.court_id ? "active" : ""} onClick={() => selectCourt(game.court_id)}>
                      <strong>{game.court_name}</strong>
                      <span>{formatTime(game.starts_at)} · {game.current_count}/{game.players_needed} 人</span>
                    </button>
                    {game.creator_id === user?.id && <button className="danger" onClick={() => deleteGame(game.id)}>取消</button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      {user && (
        <section className="panel">
          <h2>我参与的约球</h2>
          {myGames.length === 0 ? <p className="muted">暂无参与的约球。</p> : (
            <ul className="list">
              {myGames.map((game) => (
                <li key={game.id}>
                  <div className="row-actions">
                    <button onClick={() => selectCourt(game.court_id, true)}>
                      <strong>{game.court_name}</strong>
                      <span>{formatTime(game.starts_at)} · {game.current_count}/{game.players_needed} 人</span>
                    </button>
                    {game.creator_id === user?.id && <button className="danger" onClick={() => deleteGame(game.id)}>取消</button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
