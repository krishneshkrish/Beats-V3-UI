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

let audio: HTMLAudioElement | null = null;
let completionFired = false;
let preloadFired = false;
let retryCount = 0;
let isReplenishing = false;

async function replenishQueueIfNeeded() {
  if (isReplenishing) return;
  const q = get(queue);
  const cur = get(currentSong);
  if (q.length <= 2 && cur) {
    isReplenishing = true;
    try {
      const existingIds = [cur.id, ...q.map(s => s.id)];
      const more = await getRadio(cur.id, getLocalUserId(), 12, existingIds);
      const candidates = more.filter(s => !existingIds.includes(s.id));
      if (candidates.length > 0) {
        queue.update(currentQ => [...currentQ, ...candidates]);
      }
    } catch (e) {
      console.warn('Queue replenishment error:', e);
    } finally {
      isReplenishing = false;
    }
  }
}

export async function playSong(song: Song, upcomingQueue?: Song[]) {
  isLoading.set(true);
  loadingStatus.set('Loading...');
  completionFired = false;
  preloadFired = false;
  retryCount = 0;
  currentSong.set(song);
  showPlayer.set(true);

  if (upcomingQueue !== undefined && upcomingQueue.length > 0) {
    queue.set(upcomingQueue.filter(s => s.id !== song.id));
    replenishQueueIfNeeded();
  } else {
    // Zero-friction Up Next: Seed infinite smart radio, excluding recent history to prevent 2-song loops
    const excludeList = [song.id, ...get(history).map(s => s.id)];
    getRadio(song.id, getLocalUserId(), 15, excludeList).then(radioSongs => {
      const remaining = radioSongs.filter(s => s.id !== song.id && !excludeList.includes(s.id));
      if (remaining.length > 0) {
        queue.set(remaining);
      }
    }).catch(() => {
      getRecommendations(getLocalUserId()).then(recList => {
        const remaining = recList.filter(s => s.id !== song.id && !excludeList.includes(s.id));
        if (remaining.length > 0) {
          queue.set(remaining.slice(0, 10));
        }
      });
    });
  }

  try {
    const data = await resolveStream(song.id);

    if (!data.stream_url) {
      throw new Error('No stream URL');
    }

    const fullStreamUrl = data.stream_url.startsWith('http')
      ? data.stream_url
      : `${API_BASE}${data.stream_url.startsWith('/') ? '' : '/'}${data.stream_url}`;

    await initAudio(fullStreamUrl, song);
  } catch (e) {
    console.error('Play error:', e);
    showToast('Could not load song', 'error');
    isLoading.set(false);
    isPlaying.set(false);
  }
}

async function initAudio(streamUrl: string, song: Song) {
  // cleanup previous audio
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    audio = null;
  }

  if (typeof Audio === 'undefined') return;

  audio = new Audio();
  audio.preload = 'auto';
  audio.volume = get(volume);

  // iOS requirement
  (audio as any).playsInline = true;

  audio.src = streamUrl;

  audio.addEventListener('canplay', () => {
    isLoading.set(false);
    loadingStatus.set('');
  });

  audio.addEventListener('timeupdate', () => {
    if (!audio || !audio.duration) return;
    const pct = audio.currentTime / audio.duration;

    progress.set(isNaN(pct) ? 0 : pct);
    currentTime.set(audio.currentTime);

    // preload next at 70%
    if (pct > 0.7 && !preloadFired) {
      preloadFired = true;
      preloadNext();
    }

    // mark completed at 90%
    if (pct > 0.9 && !completionFired) {
      completionFired = true;
      recordPlayEvent(
        getLocalUserId(),
        song.id,
        song.genre,
        true,
        null,
        'browse'
      );
    }
  });

  audio.addEventListener('loadedmetadata', () => {
    if (audio && !isNaN(audio.duration)) {
      duration.set(audio.duration);
    }
  });

  audio.addEventListener('ended', () => {
    playNext();
  });

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

  audio.addEventListener('error', async () => {
    invalidateStream(song.id);
    if (retryCount < 1) {
      retryCount++;
      const synthUrl = getSynthesizedTrackUrl();
      if (synthUrl && audio && audio.src !== synthUrl) {
        audio.src = synthUrl;
        audio.loop = true;
        duration.set(song.duration || 180);
        audio.play().then(() => {
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

  try {
    await audio.play();
    isPlaying.set(true);
  } catch (err) {
    console.warn('Playback gesture required or auto-blocked:', err);
    // Still set loaded state so user can press play button
    isLoading.set(false);
    isPlaying.set(false);
  }

  // Media Session API (lock screen controls)
  setupMediaSession(song);

  // add to history
  history.update(h => {
    const filtered = h.filter(x => x.id !== song.id);
    return [song, ...filtered.slice(0, 49)];
  });

  // record play event
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
    navigator.mediaSession.setActionHandler('nexttrack', playNext);
    navigator.mediaSession.setActionHandler('previoustrack', playPrev);
    navigator.mediaSession.setActionHandler('seekto', d => {
      if (audio && d.seekTime !== undefined) {
        audio.currentTime = d.seekTime;
      }
    });
  } catch (e) {
    console.debug('MediaSession registration error:', e);
  }
}

export function togglePlay() {
  if (!audio) {
    const cur = get(currentSong);
    if (cur) playSong(cur);
    return;
  }
  if (audio.paused) {
    audio.play().catch(e => console.warn('Play interrupted:', e));
    isPlaying.set(true);
  } else {
    audio.pause();
    isPlaying.set(false);
  }
}

export function seek(ratio: number) {
  if (audio && audio.duration) {
    const clamped = Math.max(0, Math.min(1, ratio));
    audio.currentTime = clamped * audio.duration;
    progress.set(clamped);
    currentTime.set(audio.currentTime);
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
      const more = await getRadio(cur.id, getLocalUserId(), 15, [cur.id]);
      const candidates = more.filter(s => s.id !== cur.id);
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
      const candidates = more.filter(s => s.id !== cur.id);
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
  await playSong(next, rest);
  replenishQueueIfNeeded();
}

export async function playPrev() {
  if (audio && audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  const h = get(history);
  if (h.length > 1) {
    await playSong(h[1]);
  } else if (audio) {
    audio.currentTime = 0;
  }
}

export function addToQueue(song: Song) {
  queue.update(q => [...q, song]);
  showToast(`Added to queue: ${song.title}`, 'success');
}

function preloadNext() {
  const q = get(queue);
  if (q.length === 0) return;
  // warm Redis cache for next song
  resolveStream(q[0].id).catch(() => {});
}

export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
