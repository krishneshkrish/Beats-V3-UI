import { API_BASE } from './config';

// In-memory stream URL cache so background/lockscreen transitions happen with 0 network latency
export const streamUrlCache = new Map<string, string>();

export function cacheStreamUrl(songId: string, url: string | undefined): void {
  if (!songId || !url) return;
  const fullUrl = url.startsWith('http')
    ? url
    : `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
  streamUrlCache.set(songId, fullUrl);
}

export function getCachedStreamUrl(songId: string): string | undefined {
  if (!songId) return undefined;
  return streamUrlCache.get(songId);
}
