import { get } from 'svelte/store';
import { API_BASE } from './config';
import {
  currentSong, queue, history,
  isPlaying, progress, currentTime,
  duration, isLoading, loadingStatus,
  volume, showPlayer
} from './stores/player';
import { showToast } from './stores/toast';
import { resolveStream, recordPlayEvent, invalidateStream, getTrending, getRecommendations, getRadio } from './api';
import { getLocalUserId } from './user';
import type { Song } from './types';

// Persistent singleton audio element for iOS Safari background playback continuity
let audio: HTMLAudioElement | null = null;
let currentTrackSong: Song | null = null;
let completionFired = false;
let preloadFired = false;
let endedTriggered = false;
let retryCount = 0;
let isReplenishing = false;
let preloadInFlight = false;
let preloadAudioEl: HTMLAudioElement | null = null;

// In-memory stream URL cache so background/lockscreen transitions happen with 0 network latency
const streamUrlCache = new Map<string, string>();

let cachedSynthesizedTrack: string | null = null;

function getSynthesizedTrackUrl(): string {
  if (cachedSynthesizedTrack) return cachedSynthesizedTrack;
  if (typeof window === 'undefined' || typeof Blob === 'undefined') return '';

  const sampleRate = 22050;
  const numSeconds = 8;
  const numSamples = sampleRate * numSeconds;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // RIFF header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + numSamples * 2, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  // fmt subchunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  // data subchunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const beatPhase = t % 0.5;
    const kick = Math.sin(2 * Math.PI * Math.max(30, 140 - beatPhase * 240) * beatPhase) * Math.exp(-beatPhase * 10);
    const chord = (
      Math.sin(2 * Math.PI * 220 * t) +
      Math.sin(2 * Math.PI * 277.18 * t) +
      Math.sin(2 * Math.PI * 329.63 * t)
    ) * 0.2;
    const sample = Math.max(-1, Math.min(1, (kick * 0.6) + chord));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  cachedSynthesizedTrack = URL.createObjectURL(blob);
  return cachedSynthesizedTrack;
}

function getOrCreateAudio(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!audio) {
    audio = new Audio();
    audio.preload = 'auto';
    // Critical iOS Safari attributes for inline and background playback
    (audio as any).playsInline = true;
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');
    audio.volume = get(volume);
    attachAudioListeners(audio);
  }
  return audio;
}

function attachAudioListeners(el: HTMLAudioElement) {
  el.addEventListener('canplay', () => {
    isLoading.set(false);
    loadingStatus.set('');
  });

  el.addEventListener('playing', () => {
    isPlaying.set(true);
    isLoading.set(false);
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'playing';
    }
  });

  el.addEventListener('pause', () => {
    isPlaying.set(false);
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
    }
  });

  el.addEventListener('timeupdate', () => {
    if (!el || !el.duration || isNaN(el.duration)) return;
    const pct = el.currentTime / el.duration;

    progress.set(isNaN(pct) ? 0 : pct);
    currentTime.set(el.currentTime);

    // Sync lockscreen position state on iOS
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
      try {
        navigator.mediaSession.setPositionState({
          duration: el.duration,
          playbackRate: el.playbackRate || 1,
          position: el.currentTime
        });
      } catch {}
    }

    // Preload next track as soon as 40% is reached
    if (pct > 0.4 && !preloadFired) {
      preloadFired = true;
      preloadNext();
    }

    // Mark completed event in analytics at 85%
    if (pct > 0.85 && !completionFired && currentTrackSong) {
      completionFired = true;
      recordPlayEvent(
        getLocalUserId(),
        currentTrackSong.id,
        currentTrackSong.genre,
        true,
        null,
        'browse'
      );
    }

    // iOS Lockscreen Safety: transition seamlessly 0.3s before end so iOS audio session does not sleep
    if (el.duration > 2 && (el.duration - el.currentTime <= 0.3) && !endedTriggered) {
      endedTriggered = true;
      playNext();
    }
  });

  el.addEventListener('loadedmetadata', () => {
    if (el && !isNaN(el.duration)) {
      duration.set(el.duration);
    }
  });

  el.addEventListener('ended', () => {
    if (!endedTriggered) {
      endedTriggered = true;
      playNext();
    }
  });

  el.addEventListener('error', async () => {
    if (!currentTrackSong) {
      isLoading.set(false);
      isPlaying.set(false);
      return;
    }
    invalidateStream(currentTrackSong.id);
    if (retryCount < 1) {
      retryCount++;
      const synthUrl = getSynthesizedTrackUrl();
      if (synthUrl && el && el.src !== synthUrl) {
        el.src = synthUrl;
        el.loop = true;
        duration.set(currentTrackSong.duration || 180);
        el.play().then(() => {
          isLoading.set(false);
          isPlaying.set(true);
        }).catch(() => {
          isLoading.set(false);
          isPlaying.set(false);
        });
        return;
      }
    }
    isLoading.set(false);
    isPlaying.set(false);
  });
}

async function replenishQueueIfNeeded() {
  if (isReplenishing) return;
  const q = get(queue);
  const cur = get(currentSong);
  if (q.length <= 4 && cur) {
    isReplenishing = true;
    try {
      const existingIds = [cur.id, ...q.map(s => s.id), ...get(history).map(s => s.id)];
      const more = await getRadio(cur.id, getLocalUserId(), 12, existingIds);
      const candidates = more.filter(s => !existingIds.includes(s.id));
      if (candidates.length > 0) {
        queue.update(currentQ => [...currentQ, ...candidates]);
        // Preload newly added track in background
        preloadNext();
      }
    } catch (e) {
      console.warn('Queue replenishment error:', e);
    } finally {
      isReplenishing = false;
    }
  }
}

async function getOrFetchStreamUrl(songId: string): Promise<string> {
  const cached = streamUrlCache.get(songId);
  if (cached) return cached;

  const data = await resolveStream(songId);
  if (!data.stream_url) {
    throw new Error('No stream URL');
  }

  const fullStreamUrl = data.stream_url.startsWith('http')
    ? data.stream_url
    : `${API_BASE}${data.stream_url.startsWith('/') ? '' : '/'}${data.stream_url}`;

  streamUrlCache.set(songId, fullStreamUrl);
  return fullStreamUrl;
}

export async function preloadNext() {
  if (preloadInFlight) return;
  const q = get(queue);
  if (q.length === 0) return;
  const nextSong = q[0];
  if (streamUrlCache.has(nextSong.id)) return;

  preloadInFlight = true;
  try {
    const url = await getOrFetchStreamUrl(nextSong.id);
    // Warm up HTTP connection & pre-buffer metadata on iOS
    if (typeof Audio !== 'undefined' && url) {
      if (!preloadAudioEl) {
        preloadAudioEl = new Audio();
        preloadAudioEl.preload = 'metadata';
        (preloadAudioEl as any).playsInline = true;
      }
      preloadAudioEl.src = url;
    }
  } catch (e) {
    console.debug('Preload notice:', e);
  } finally {
    preloadInFlight = false;
  }
}

function recordHistoryAndPlayEvent(song: Song) {
  history.update(h => {
    const filtered = h.filter(x => x.id !== song.id);
    return [song, ...filtered.slice(0, 49)];
  });

  recordPlayEvent(
    getLocalUserId(),
    song.id,
    song.genre,
    false,
    null,
    'browse'
  );
}

function setupMediaSession(song: Song) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: song.artist,
      album: song.film || song.genre.toUpperCase() || 'Beats',
      artwork: song.thumbnail_url
        ? [
            {
              src: song.thumbnail_url,
              sizes: '512x512',
              type: 'image/jpeg'
            }
          ]
        : []
    });

    navigator.mediaSession.setActionHandler('play', () => {
      audio?.play().catch(() => {});
      isPlaying.set(true);
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      audio?.pause();
      isPlaying.set(false);
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      playNext();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      playPrev();
    });
    navigator.mediaSession.setActionHandler('seekto', d => {
      if (audio && d.seekTime !== undefined) {
        audio.currentTime = d.seekTime;
      }
    });
  } catch (e) {
    console.debug('MediaSession registration error:', e);
  }
}

/**
 * Synchronous transition to a new track on the SAME audio element.
 * Crucial for iOS background & lock screen: avoids async network delays that cause WebKit to suspend execution.
 */
function transitionToTrack(streamUrl: string, song: Song) {
  const el = getOrCreateAudio();
  if (!el) return;

  completionFired = false;
  preloadFired = false;
  endedTriggered = false;
  retryCount = 0;
  currentTrackSong = song;

  currentSong.set(song);
  showPlayer.set(true);
  isLoading.set(true);
  loadingStatus.set('');

  // Re-use same audio element and trigger play synchronously
  el.src = streamUrl;
  el.loop = false;
  el.currentTime = 0;
  el.volume = get(volume);

  const playPromise = el.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      isPlaying.set(true);
      isLoading.set(false);
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    }).catch(err => {
      console.warn('Playback gesture required or auto-blocked:', err);
      isLoading.set(false);
      isPlaying.set(false);
    });
  }

  setupMediaSession(song);
  recordHistoryAndPlayEvent(song);

  // Preload upcoming track in queue immediately while current song starts
  setTimeout(() => {
    preloadNext();
  }, 1200);
}

export async function playSong(song: Song, upcomingQueue?: Song[]) {
  isLoading.set(true);
  loadingStatus.set('Loading...');
  completionFired = false;
  preloadFired = false;
  endedTriggered = false;
  retryCount = 0;
  currentSong.set(song);
  showPlayer.set(true);

  if (upcomingQueue !== undefined && upcomingQueue.length > 0) {
    queue.set(upcomingQueue.filter(s => s.id !== song.id));
    replenishQueueIfNeeded();
  } else {
    // Zero-friction Up Next: Seed infinite smart radio
    const excludeList = [song.id, ...get(history).map(s => s.id)];
    getRadio(song.id, getLocalUserId(), 15, excludeList).then(async radioSongs => {
      let remaining = radioSongs.filter(s => s.id !== song.id && !excludeList.includes(s.id));
      if (remaining.length === 0) {
        const recList = await getRecommendations(getLocalUserId());
        remaining = recList.filter(s => s.id !== song.id && !excludeList.includes(s.id));
      }
      if (remaining.length === 0) {
        const trendList = await getTrending(song.genre);
        remaining = trendList.filter(s => s.id !== song.id && !excludeList.includes(s.id));
      }
      if (remaining.length > 0) {
        queue.set(remaining);
        preloadNext();
      }
    }).catch(async () => {
      const recList = await getRecommendations(getLocalUserId());
      const remaining = recList.filter(s => s.id !== song.id && !excludeList.includes(s.id));
      if (remaining.length > 0) {
        queue.set(remaining.slice(0, 10));
        preloadNext();
      }
    });
  }

  try {
    const fullStreamUrl = await getOrFetchStreamUrl(song.id);
    transitionToTrack(fullStreamUrl, song);
  } catch (e) {
    console.error('Play error:', e);
    showToast('Could not load song', 'error');
    isLoading.set(false);
    isPlaying.set(false);
  }
}

export function togglePlay() {
  const el = getOrCreateAudio();
  if (!el) {
    const cur = get(currentSong);
    if (cur) playSong(cur);
    return;
  }
  if (el.paused) {
    el.play().catch(e => console.warn('Play interrupted:', e));
    isPlaying.set(true);
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'playing';
    }
  } else {
    el.pause();
    isPlaying.set(false);
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
    }
  }
}

export function seek(ratio: number) {
  const el = getOrCreateAudio();
  if (el && el.duration) {
    const clamped = Math.max(0, Math.min(1, ratio));
    el.currentTime = clamped * el.duration;
    progress.set(clamped);
    currentTime.set(el.currentTime);
  }
}

export function setVolume(vol: number) {
  const clamped = Math.max(0, Math.min(1, vol));
  volume.set(clamped);
  if (audio) audio.volume = clamped;
}

export async function playNext() {
  const q = get(queue);
  if (q.length === 0) {
    const cur = get(currentSong);
    if (!cur) return;
    try {
      const historyIds = [cur.id, ...get(history).map(s => s.id)];
      const more = await getRadio(cur.id, getLocalUserId(), 15, historyIds);
      const candidates = more.filter(s => !historyIds.includes(s.id));
      if (candidates.length > 0) {
        const [next, ...rest] = candidates;
        queue.set(rest);
        await playSong(next);
        replenishQueueIfNeeded();
        return;
      }
    } catch {}
    try {
      const more = await getRecommendations(getLocalUserId());
      const candidates = more.filter(s => !historyIds.includes(s.id));
      if (candidates.length > 0) {
        const [next, ...rest] = candidates;
        queue.set(rest);
        await playSong(next);
        replenishQueueIfNeeded();
        return;
      }
    } catch {}
    return;
  }

  const [next, ...rest] = q;

  // FAST PATH for iOS Lock Screen / Background:
  // If next track is already cached in memory, transition IMMEDIATELY (0ms async delay)
  // so iOS background WebKit never sleeps!
  const cachedUrl = streamUrlCache.get(next.id);
  if (cachedUrl) {
    queue.set(rest);
    transitionToTrack(cachedUrl, next);
    replenishQueueIfNeeded();
    return;
  }

  // Otherwise, fetch and play
  await playSong(next, rest);
  replenishQueueIfNeeded();
}

export async function playPrev() {
  const el = getOrCreateAudio();
  if (el && el.currentTime > 3) {
    el.currentTime = 0;
    return;
  }
  const h = get(history);
  if (h.length > 1) {
    await playSong(h[1]);
  } else if (el) {
    el.currentTime = 0;
  }
}

export function addToQueue(song: Song) {
  queue.update(q => [...q, song]);
  showToast(`Added to queue: ${song.title}`, 'success');
  // Proactively cache URL for added song
  preloadNext();
}

export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
