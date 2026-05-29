import type {
  RangeParams, Totals, ArtistTop, AlbumTop, TrackTop, GenreTop, HeatCell, TimePoint, Session, EntityDetail, AuthStatus,
} from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = "ApiError"; }
}
export class AuthError extends ApiError {
  constructor() { super(401, "unauthorized"); this.name = "AuthError"; }
}

function qs(params: RangeParams = {}): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, { credentials: "include" });
  if (res.status === 401) throw new AuthError();
  if (!res.ok) throw new ApiError(res.status, `GET ${path} failed (${res.status})`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "POST", credentials: "include",
    headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 401) throw new ApiError(res.status, `POST ${path} failed (${res.status})`);
  return res.json() as Promise<T>;
}

export function coverUrl(id: string, size = 300): string {
  return `/api/cover/${encodeURIComponent(id)}?size=${size}`;
}

export const api = {
  totals: (p?: RangeParams) => get<Totals>(`/totals${qs(p)}`),
  topArtists: (p?: RangeParams) => get<ArtistTop[]>(`/tops/artists${qs(p)}`),
  topAlbums: (p?: RangeParams) => get<AlbumTop[]>(`/tops/albums${qs(p)}`),
  topTracks: (p?: RangeParams) => get<TrackTop[]>(`/tops/tracks${qs(p)}`),
  topGenres: (p?: RangeParams) => get<GenreTop[]>(`/tops/genres${qs(p)}`),
  heatmap: (p?: RangeParams) => get<HeatCell[]>(`/heatmap${qs(p)}`),
  timeseries: (p?: RangeParams) => get<TimePoint[]>(`/timeseries${qs(p)}`),
  sessions: (p?: RangeParams) => get<Session[]>(`/sessions${qs(p)}`),
  entity: (kind: string, id: string, p?: RangeParams) => get<EntityDetail>(`/entity/${kind}/${encodeURIComponent(id)}${qs(p)}`),
  me: () => get<AuthStatus>("/auth/me"),
  login: (password: string) => post<AuthStatus>("/auth/login", { password }),
  logout: () => post<AuthStatus>("/auth/logout", {}),
};
