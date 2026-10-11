export interface Song {
  id: string;
  title: string;
  artist: string;
  film?: string;
  genre: string;
  language?: string;
  duration: number;
  thumbnail_url?: string;
  play_count: number;
  status: 'available' | 'unavailable';
}

export interface PlayerState {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  progress: number;      // 0-1
  currentTime: number;   // seconds
  duration: number;      // seconds
  isLoading: boolean;
  loadingStatus: string;
  volume: number;        // 0-1
}

export interface User {
  id: string;
  name: string;
  taste_profile?: string;
  play_count: number;
}

export interface TopGenre {
  genre: string;
  count: number;
  pct: number;
}

export interface TopArtist {
  artist: string;
  count: number;
}

export interface UserStats {
  total_songs: number;
  total_hours: number;
  top_genres: TopGenre[];
  top_artists: TopArtist[];
  heatmap: Record<string, number[]>;
}
