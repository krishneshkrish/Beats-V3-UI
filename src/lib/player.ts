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
import { streamUrlCache, cacheStreamUrl, getCachedStreamUrl } from './streamCache';
import { getLocalUserId } from './user';
import type { Song } from './types';

export { cacheStreamUrl, getCachedStreamUrl };

// Dual HTMLAudioElement ping-pong architecture for seamless, gapless iOS background playback
let audioA: HTMLAudioElement | null = null;
let audioB: HTMLAudioElement | null = null;
let activeAudio: HTMLAudioElement | null = null;
let preloaderAudio: HTMLAudioElement | null = null;
let preloadedSongId: string | null = null;

// Keep-alive AudioContext to prevent iOS WebKit from suspending background execution
let audioCtx: AudioContext | null = null;

let currentTrackSong: Song | null = null;
let completionFired = false;
let preloadFired = false;
let advancePreloadFired = false;
let endedTriggered = false;
let lastTransitionTime = 0;
let retryCount = 0;
let isReplenishing = false;
let preloadInFlight = false;

// Stall & buffer recovery watchdog
let stallWatchdogTimer: any = null;

function clearStallWatchdog() {
  if (stallWatchdogTimer) {
    clearTimeout(stallWatchdogTimer);
    stallWatchdogTimer = null;
  }
}

function startStallWatchdog(reason = 'stall') {
  clearStallWatchdog();
  stallWatchdogTimer = setTimeout(() => {
    console.warn(`[Watchdog] Audio stalled for 10s (${reason}), auto-advancing:`, currentTrackSong?.title);
    if (currentTrackSong) {
      invalidateStream(currentTrackSong.id);
    }
    isLoading.set(false);
    playNext();
  }, 10000);
}

function safeResetAudio(el: HTMLAudioElement | null) {
  if (!el) return;
  try {
    el.pause();
    el.currentTime = 0;
    el.removeAttribute('src');
    el.load();
  } catch {}
}

let cachedSynthesizedTrack: string | null = null;

function ensureAudioKeepAlive() {
  if (typeof window === 'undefined') return;
  if (!audioCtx) {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        gain.gain.value = 0.0001; // Inaudible, keeps iOS audio daemon active
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
      }
    } catch (e) {
      console.debug('Keep-alive context notice:', e);
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

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
  if (!activeAudio) {
    audioA = new Audio();
    audioB = new Audio();

    for (const el of [audioA, audioB]) {
      el.preload = 'auto';
      // Critical iOS Safari attributes for inline and background playback
      (el as any).playsInline = true;
      el.setAttribute('playsinline', 'true');
      el.setAttribute('webkit-playsinline', 'true');
      el.volume = get(volume);
      attachAudioListeners(el);
    }

    activeAudio = audioA;
    preloaderAudio = audioB;

    initMediaSessionHandlers();
    ensureAudioKeepAlive();
  }
  return activeAudio;
}

function initMediaSessionHandlers() {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.setActionHandler('play', () => {
      togglePlay();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      togglePlay();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      playNext();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      playPrev();
    });
    // Explicitly nullify seekforward and seekbackward on iOS.
    // iOS WebKit defaults to 10-second skip buttons [↺ 10] [↻ 10] if these are active or not explicitly disabled.
    // Setting them to null forces iOS lockscreen & Control Center to render [|<<] and [>>|] track skip buttons.
    try {
      navigator.mediaSession.setActionHandler('seekforward', null);
    } catch {}
    try {
      navigator.mediaSession.setActionHandler('seekbackward', null);
    } catch {}

    navigator.mediaSession.setActionHandler('seekto', d => {
      if (activeAudio && d.seekTime !== undefined) {
        activeAudio.currentTime = d.seekTime;
      }
    });
  } catch (e) {
    console.debug('MediaSession action handler error:', e);
  }
}

function attachAudioListeners(el: HTMLAudioElement) {
  el.addEventListener('canplay', () => {
    if (el === activeAudio) {
      clearStallWatchdog();
      isLoading.set(false);
      loadingStatus.set('');
    }
  });

  el.addEventListener('waiting', () => {
    if (el === activeAudio) {
      isLoading.set(true);
      loadingStatus.set('Buffering...');
      startStallWatchdog('waiting');
    }
  });

  el.addEventListener('stalled', () => {
    if (el === activeAudio) {
      isLoading.set(true);
      loadingStatus.set('Buffering...');
      startStallWatchdog('stalled');
    }
  });

  el.addEventListener('playing', () => {
    if (el === activeAudio) {
      clearStallWatchdog();
      isPlaying.set(true);
      isLoading.set(false);
      loadingStatus.set('');
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
      // Proactively pre-resolve queue tracks while active audio keeps background JS alive
      preloadQueue(3);
    }
  });

  el.addEventListener('pause', () => {
    if (el === activeAudio) {
      isPlaying.set(false);
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    }
  });

  el.addEventListener('timeupdate', () => {
    // Only active playing element updates progress & triggers events
    if (el !== activeAudio) return;
    clearStallWatchdog();
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

    // Proactive background queue resolve at 30%
    if (pct > 0.3 && !preloadFired) {
      preloadFired = true;
      preloadQueue(3);
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

    // Advance Buffer: Buffer next track audio data 15 seconds before end or at 80% progress
    if (el.duration > 5 && (el.duration - el.currentTime <= 15 || pct > 0.8) && !advancePreloadFired) {
      advancePreloadFired = true;
      bufferNextTrackInAdvance();
    }

    // iOS Lockscreen Safety: transition seamlessly 0.35s before end so iOS audio session does not sleep
    // Debounced with lastTransitionTime to prevent accidental double-skips
    if (el.duration > 2 && (el.duration - el.currentTime <= 0.35) && !endedTriggered && (Date.now() - lastTransitionTime > 2500)) {
      endedTriggered = true;
      playNext();
    }
  });

  el.addEventListener('loadedmetadata', () => {
    if (el === activeAudio && !isNaN(el.duration)) {
      duration.set(el.duration);
    }
  });

  el.addEventListener('ended', () => {
    if (el === activeAudio && !endedTriggered && (Date.now() - lastTransitionTime > 2500)) {
      endedTriggered = true;
      playNext();
    }
  });

  el.addEventListener('error', async () => {
    if (el === preloaderAudio) {
      console.warn('[Preloader Error] Preloading failed for song ID:', preloadedSongId);
      preloadedSongId = null;
      safeResetAudio(el);
      return;
    }
    if (el !== activeAudio) return;
    clearStallWatchdog();
    if (!currentTrackSong) {
      isLoading.set(false);
      isPlaying.set(false);
      return;
    }
    console.warn('[Audio Error] Failed to play track:', currentTrackSong.title);
    invalidateStream(currentTrackSong.id);

    const q = get(queue);
    if (q && q.length > 0) {
      console.log('[Audio Error] Auto-advancing to next song in queue...');
      playNext();
      return;
    }

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

function bufferNextTrackInAdvance() {
  const q = get(queue);
  if (!q || q.length === 0 || !preloaderAudio) return;
  const nextSong = q[0];
  if (!nextSong || !nextSong.id) return;

  const directUrl = getCachedStreamUrl(nextSong.id) || nextSong.stream_url || nextSong.source_url;
  if (directUrl) {
    if (preloaderAudio.src !== directUrl) {
      preloaderAudio.src = directUrl;
      preloaderAudio.load();
      preloadedSongId = nextSong.id;
      console.log('[iOS Preloader] Pre-buffering audio bytes for next track:', nextSong.title);
    }
  } else {
    getOrFetchStreamUrl(nextSong.id).then(url => {
      if (preloaderAudio && preloaderAudio.src !== url) {
        preloaderAudio.src = url;
        preloaderAudio.load();
        preloadedSongId = nextSong.id;
        console.log('[iOS Preloader] Pre-buffering audio bytes for next track:', nextSong.title);
      }
    }).catch(e => console.debug('Advance preload fetch error:', e));
  }
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
        preloadQueue(3);
      }
    } catch (e) {
      console.warn('Queue replenishment error:', e);
    } finally {
      isReplenishing = false;
    }
  }
}

async function getOrFetchStreamUrl(songId: string): Promise<string> {
  const cached = getCachedStreamUrl(songId);
  if (cached) return cached;

  const data = await resolveStream(songId);
  if (!data.stream_url) {
    throw new Error('No stream URL');
  }

  const fullStreamUrl = data.stream_url.startsWith('http')
    ? data.stream_url
    : `${API_BASE}${data.stream_url.startsWith('/') ? '' : '/'}${data.stream_url}`;

  cacheStreamUrl(songId, fullStreamUrl);
  return fullStreamUrl;
}

/**
 * Preloads and resolves the next few tracks in the queue without interrupting audio or WebKit context.
 */
export async function preloadQueue(depth = 3) {
  if (preloadInFlight) return;
  const q = get(queue);
  if (!q || q.length === 0) return;

  preloadInFlight = true;
  try {
    const targets = q.slice(0, depth);
    for (const song of targets) {
      if (!song || !song.id) continue;
      if (getCachedStreamUrl(song.id)) continue;

      if (song.source_url || song.stream_url) {
        const u = song.source_url || song.stream_url;
        if (u && (u.includes('saavncdn.com') || u.includes('.mp3') || u.includes('.mp4') || u.includes('.m4a') || u.includes('masstamilan.download'))) {
          cacheStreamUrl(song.id, u);
          continue;
        }
      }

      try {
        await getOrFetchStreamUrl(song.id);
      } catch (err) {
        console.debug('Pre-resolve error for track:', song.title, err);
      }
    }
  } finally {
    preloadInFlight = false;
  }
}

export async function preloadNext() {
  return preloadQueue(3);
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
      album: song.film || (song.genre ? song.genre.toUpperCase() : 'Beats'),
      artwork: song.thumbnail_url
        ? [
            {
              src: song.thumbnail_url.replace('150x150', '500x500'),
              sizes: '512x512',
              type: 'image/jpeg'
            }
          ]
        : []
    });

    // Re-affirm next/prev and nullify seek buttons on track change for iOS lockscreen
    initMediaSessionHandlers();
  } catch (e) {
    console.debug('MediaSession registration error:', e);
  }
}

function swapAndPlayPreloaded(song: Song) {
  if (!activeAudio || !preloaderAudio) return;

  clearStallWatchdog();
  completionFired = false;
  preloadFired = false;
  advancePreloadFired = false;
  endedTriggered = false;
  lastTransitionTime = Date.now();
  retryCount = 0;
  currentTrackSong = song;

  currentSong.set(song);
  showPlayer.set(true);
  isLoading.set(false);
  loadingStatus.set('');

  // 1. Swap active and preloader elements
  const oldActive = activeAudio;
  activeAudio = preloaderAudio;
  preloaderAudio = oldActive;
  preloadedSongId = null;

  activeAudio.volume = get(volume);

  // 2. Play the pre-buffered audio element instantaneously (0ms delay)
  const playPromise = activeAudio.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      isPlaying.set(true);
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    }).catch(err => {
      console.warn('Preloaded instant play error, falling back to direct transition:', err);
      // Resilience: Never leave player frozen. Recover fresh stream or advance queue
      invalidateStream(song.id);
      getOrFetchStreamUrl(song.id).then(freshUrl => {
        transitionToTrack(freshUrl, song);
      }).catch(fallbackErr => {
        console.error('Preloaded recovery failed, auto-advancing:', fallbackErr);
        playNext();
      });
    });
  }

  // 3. Safely reset the old active element so it can act as the preloader for the next song
  safeResetAudio(oldActive);

  setupMediaSession(song);
  recordHistoryAndPlayEvent(song);

  // 4. Proactively resolve upcoming queue items
  preloadQueue(3);
}

/**
 * Direct transition to a new track on the active audio element.
 */
function transitionToTrack(streamUrl: string, song: Song) {
  const el = getOrCreateAudio();
  if (!el) return;

  clearStallWatchdog();
  completionFired = false;
  preloadFired = false;
  advancePreloadFired = false;
  endedTriggered = false;
  lastTransitionTime = Date.now();
  retryCount = 0;
  currentTrackSong = song;

  currentSong.set(song);
  showPlayer.set(true);
  isLoading.set(true);
  loadingStatus.set('Buffering...');
  startStallWatchdog('transition');

  el.src = streamUrl;
  el.loop = false;
  el.currentTime = 0;
  el.volume = get(volume);

  const playPromise = el.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      clearStallWatchdog();
      isPlaying.set(true);
      isLoading.set(false);
      loadingStatus.set('');
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    }).catch(err => {
      console.warn('Playback gesture required or auto-blocked:', err);
      clearStallWatchdog();
      isLoading.set(false);
      isPlaying.set(false);
      // If error was unplayable media source or broken link, advance queue
      if (err.name === 'NotSupportedError' || (el.error && el.error.code !== 0)) {
        invalidateStream(song.id);
        const q = get(queue);
        if (q && q.length > 0) {
          playNext();
        }
      }
    });
  }

  setupMediaSession(song);
  recordHistoryAndPlayEvent(song);

  preloadQueue(3);
}

export async function playSong(song: Song, upcomingQueue?: Song[]) {
  clearStallWatchdog();
  isLoading.set(true);
  loadingStatus.set('Loading...');
  completionFired = false;
  preloadFired = false;
  advancePreloadFired = false;
  endedTriggered = false;
  lastTransitionTime = Date.now();
  retryCount = 0;
  currentSong.set(song);
  showPlayer.set(true);

  // Clean slate: reset preloader on direct song playback
  preloadedSongId = null;
  safeResetAudio(preloaderAudio);

  if (song.source_url || song.stream_url) {
    cacheStreamUrl(song.id, song.source_url || song.stream_url);
  }

  if (upcomingQueue !== undefined && upcomingQueue.length > 0) {
    queue.set(upcomingQueue.filter(s => s.id !== song.id));
    preloadQueue(3);
    replenishQueueIfNeeded();
  } else if (upcomingQueue !== undefined && upcomingQueue.length === 0) {
    // Explicit empty queue was passed: replenish immediately
    replenishQueueIfNeeded();
  } else {
    // Zero-friction Up Next: Seed infinite smart radio
    const excludeList = [song.id, ...get(history).map(s => s.id)];
    getRadio(song.id, getLocalUserId(), 15, excludeList).then(async radioSongs => {
      let remaining = radioSongs.filter(s => s.id !== song.id && !excludeList.includes(s.id));
      if (remaining.length === 0) {
        try {
          const retry = await getRadio(song.id, getLocalUserId(), 15, excludeList);
          remaining = retry.filter(s => s.id !== song.id && !excludeList.includes(s.id));
        } catch {}
      }
      if (remaining.length === 0) {
        const trendList = await getTrending(song.genre);
        remaining = trendList.filter(s => s.id !== song.id && !excludeList.includes(s.id));
      }
      if (remaining.length > 0) {
        queue.set(remaining);
        preloadQueue(3);
      }
    }).catch(async () => {
      try {
        const retry = await getRadio(song.id, getLocalUserId(), 15, excludeList);
        const remaining = retry.filter(s => s.id !== song.id && !excludeList.includes(s.id));
        if (remaining.length > 0) {
          queue.set(remaining);
          preloadQueue(3);
          return;
        }
      } catch {}
      const trendList = await getTrending(song.genre);
      const remaining = trendList.filter(s => s.id !== song.id && !excludeList.includes(s.id));
      if (remaining.length > 0) {
        queue.set(remaining.slice(0, 10));
        preloadQueue(3);
      }
    });
  }

  try {
    const fullStreamUrl = await getOrFetchStreamUrl(song.id);
    transitionToTrack(fullStreamUrl, song);
  } catch (e) {
    console.error('Play error:', e);
    showToast(`Could not load "${song.title}", skipping...`, 'error');
    invalidateStream(song.id);
    isLoading.set(false);
    isPlaying.set(false);
    const q = get(queue);
    if (q && q.length > 0) {
      playNext();
    }
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
    ensureAudioKeepAlive();
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
  if (audioA) audioA.volume = clamped;
  if (audioB) audioB.volume = clamped;
}

export async function playNext() {
  clearStallWatchdog();
  const q = get(queue);
  if (q.length === 0) {
    const cur = get(currentSong);
    if (!cur) return;
    const historyIds = [cur.id, ...get(history).map(s => s.id)];
    try {
      const more = await getRadio(cur.id, getLocalUserId(), 15, historyIds);
      const candidates = more.filter(s => !historyIds.includes(s.id));
      if (candidates.length > 0) {
        const [next, ...rest] = candidates;
        queue.set(rest);
        await playSong(next, rest);
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
        await playSong(next, rest);
        replenishQueueIfNeeded();
        return;
      }
    } catch {}
    return;
  }

  const [next, ...rest] = q;

  // FAST PATH for iOS Lock Screen / Background:
  // ONLY use preloaderAudio if it specifically loaded THIS EXACT next.id AND has valid buffer without errors!
  if (
    preloaderAudio &&
    preloadedSongId === next.id &&
    !preloaderAudio.error &&
    preloaderAudio.readyState >= 2
  ) {
    queue.set(rest);
    swapAndPlayPreloaded(next);
    replenishQueueIfNeeded();
    return;
  }

  // Preloader not ready or mismatched: reset preloader to prevent stale audio contamination
  safeResetAudio(preloaderAudio);
  preloadedSongId = null;

  const directUrl = getCachedStreamUrl(next.id) || next.stream_url || next.source_url;
  if (directUrl) {
    cacheStreamUrl(next.id, directUrl);
    queue.set(rest);
    transitionToTrack(directUrl, next);
    replenishQueueIfNeeded();
    return;
  }

  // Fallback if cache missed
  try {
    isLoading.set(true);
    loadingStatus.set('Loading next track...');
    const fullStreamUrl = await getOrFetchStreamUrl(next.id);
    queue.set(rest);
    transitionToTrack(fullStreamUrl, next);
    replenishQueueIfNeeded();
  } catch (err) {
    console.error('playNext fallback error for:', next.title, err);
    invalidateStream(next.id);
    if (rest.length > 0) {
      queue.set(rest);
      playNext();
    } else {
      isLoading.set(false);
      isPlaying.set(false);
    }
  }
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
  if (song.source_url || song.stream_url) {
    cacheStreamUrl(song.id, song.source_url || song.stream_url);
  }
  preloadQueue(3);
}

export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
