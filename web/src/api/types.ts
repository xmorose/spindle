export type Range = "7d" | "30d" | "year" | "all";
export type Sort = "plays" | "time";

export interface RangeParams { range?: Range; from?: number; to?: number; sort?: Sort; limit?: number; bucket?: "day" | "week" | "month"; }

export interface Totals { plays: number; seconds: number; distinctTracks: number; distinctArtists: number; distinctAlbums: number; avgPlaysPerActiveDay: number; }
export interface ArtistTop { artistId: string; name: string; plays: number; seconds: number; coverArt: string | null; }
export interface AlbumTop { albumId: string; name: string; artist: string; plays: number; seconds: number; }
export interface TrackTop { id: string; title: string; artist: string; album: string; plays: number; seconds: number; hasCoverArt: boolean; }
export interface GenreTop { genre: string; plays: number; seconds: number; }
export interface HeatCell { weekday: number; hour: number; plays: number; }
export interface TimePoint { bucket: number; plays: number; seconds: number; }
export interface Session { startedAt: number; endedAt: number; trackCount: number; seconds: number; }
export interface RecentPlay { playedAt: number; id: string; title: string; artist: string; album: string; artistId: string; albumId: string; hasCoverArt: boolean; }
export interface SearchResult {
  artists: { id: string; name: string }[];
  albums: { id: string; name: string; artist: string }[];
  tracks: { id: string; title: string; artist: string; hasCoverArt: boolean }[];
}
export interface RelatedTrack { id: string; title: string; artist: string; plays: number; seconds: number; hasCoverArt: boolean; }
export interface EntityDetail {
  kind: "artist" | "album" | "track"; id: string; name: string; artist?: string; album?: string;
  plays: number; seconds: number; rank: number; firstPlayedAt: number | null; lastPlayedAt: number | null;
  coverArt: string | null;
  history: { day: number; plays: number }[]; related: RelatedTrack[];
}
export interface AuthStatus { authenticated: boolean; }
