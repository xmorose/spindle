export type Range = "7d" | "30d" | "90d" | "year" | "all";
export type Sort = "plays" | "time";

export interface RangeParams { range?: Range; from?: number; to?: number; sort?: Sort; limit?: number; bucket?: "day" | "week" | "month"; }

export interface ArtistRef { id: string; name: string; }
export interface Totals { plays: number; seconds: number; distinctTracks: number; distinctArtists: number; distinctAlbums: number; avgPlaysPerActiveDay: number; }
export interface ArtistTop { artistId: string; name: string; plays: number; seconds: number; coverArt: string | null; }
export interface AlbumTop { albumId: string; name: string; artist: string; artistId: string; plays: number; seconds: number; }
export interface TrackTop { id: string; title: string; artist: string; artistId: string; artists: ArtistRef[]; album: string; plays: number; seconds: number; hasCoverArt: boolean; }
export interface GenreTop { genre: string; plays: number; seconds: number; }
export interface HeatCell { weekday: number; hour: number; plays: number; }
export interface TimePoint { bucket: number; plays: number; seconds: number; }
export type FlowGroup = "artist" | "album" | "genre";
export interface FlowSeries {
  id: string; name: string; subtitle: string; coverArt: string | null; href: string | null;
  totalPlays: number; totalSeconds: number; plays: number[]; seconds: number[]; other?: boolean;
}
export interface FlowData {
  group: FlowGroup; bucket: "day" | "week" | "month"; starts: number[]; ends: number[];
  from: number; to: number; series: FlowSeries[]; totalPlays: number; totalSeconds: number; unassignedPlays: number;
}
export interface FlowParams extends Omit<RangeParams, "bucket"> {
  group?: FlowGroup; bucket?: "auto" | "day" | "week" | "month"; compact?: boolean; focus?: string;
}
export interface SessionTrack { id: string; title: string; artist: string; artistId: string; artists: ArtistRef[]; albumId: string; hasCoverArt: boolean; duration: number; plays: number; }
export interface Session { startedAt: number; endedAt: number; trackCount: number; seconds: number; tracks: SessionTrack[]; }
export interface RecentPlay { playedAt: number; id: string; title: string; artist: string; album: string; artistId: string; artists: ArtistRef[]; albumId: string; hasCoverArt: boolean; }
export interface SearchResult {
  artists: { id: string; name: string }[];
  albums: { id: string; name: string; artist: string; artistId: string }[];
  tracks: { id: string; title: string; artist: string; artistId: string; artists: ArtistRef[]; hasCoverArt: boolean }[];
}
export interface RelatedTrack { id: string; title: string; artist: string; artistId: string; artists: ArtistRef[]; plays: number; seconds: number; hasCoverArt: boolean; }
export interface EntityDetail {
  kind: "artist" | "album" | "track"; id: string; name: string; artist?: string; artistId?: string; artists?: ArtistRef[]; album?: string;
  plays: number; seconds: number; rank: number; firstPlayedAt: number | null; lastPlayedAt: number | null;
  coverArt: string | null;
  history: { day: number; plays: number }[]; related: RelatedTrack[];
}
export interface AuthStatus { authenticated: boolean; }
export interface UsersResponse { users: string[]; default: string; }

export type ShareKind = "track" | "album" | "queue";

export interface CreateShareRequest {
  kind: ShareKind;
  trackIds: string[];
  label?: string;
}
export interface CreateShareResponse { token: string }

export interface PublicShareTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  hasCover: boolean;
}
export interface PublicShare {
  kind: ShareKind;
  label: string | null;
  expiresAt: number;
  tracks: PublicShareTrack[];
}

export interface AlbumTrack { id: string; title: string; artist: string; duration: number; hasCover: boolean; }
