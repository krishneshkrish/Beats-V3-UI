<script lang="ts">
  import type { Song } from '$lib/types';
  import { currentSong, isPlaying } from '$lib/stores/player';
  import { formatTime } from '$lib/player';

  export let song: Song;
  export let onPlay: (song: Song) => void = () => {};
  export let onAddToQueue: (song: Song) => void = () => {};

  $: isCurrent = $currentSong?.id === song.id;
  $: isCurrentlyPlaying = isCurrent && $isPlaying;

  let showMenu = false;
  let pressTimer: any = null;
  let touchStartX = 0;
  let touchStartY = 0;
  let didSwipe = false;

  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length > 0) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
    pressTimer = setTimeout(() => {
      showMenu = true;
    }, 500);
  }

  function handleTouchEnd(e: TouchEvent) {
    clearTimeout(pressTimer);
    if (e.changedTouches.length > 0) {
      const deltaX = e.changedTouches[0].clientX - touchStartX;
      const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY);
      // Swipe left triggers queue
      if (deltaX < -50 && deltaY < 40) {
        didSwipe = true;
        onAddToQueue(song);
        setTimeout(() => { didSwipe = false; }, 350);
      }
    }
  }

  function handleTouchMove() {
    clearTimeout(pressTimer);
  }

  function handleClick() {
    if (didSwipe) return;
    if (showMenu) {
      showMenu = false;
      return;
    }
    onPlay(song);
  }

  function handleQueueClick(e: MouseEvent) {
    e.stopPropagation();
    showMenu = false;
    onAddToQueue(song);
  }
</script>

<div
  class="song-row"
  class:active={isCurrent}
  role="button"
  tabindex="0"
  on:click={handleClick}
  on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
  on:touchstart={handleTouchStart}
  on:touchend={handleTouchEnd}
  on:touchmove={handleTouchMove}
>
  <!-- Thumbnail / EQ -->
  <div class="thumb-container">
    {#if isCurrentlyPlaying}
      <div class="eq-icon" aria-label="Playing">
        <span class="bar bar-1"></span>
        <span class="bar bar-2"></span>
        <span class="bar bar-3"></span>
      </div>
    {:else if song.thumbnail_url}
      <img src={song.thumbnail_url} alt={song.title} class="thumb-img" loading="lazy" />
    {:else}
      <div class="thumb-placeholder">
        {song.title ? song.title.charAt(0).toUpperCase() : 'B'}
      </div>
    {/if}
  </div>

  <!-- Center info -->
  <div class="song-info">
    <div class="song-title" class:active-title={isCurrent}>
      {song.title}
    </div>
    <div class="song-meta">
      {song.artist} <span class="dot">&middot;</span> <span class="genre-tag">{song.genre.toUpperCase()}</span>
    </div>
  </div>

  <!-- Right side: Duration & Queue button -->
  <div class="song-actions">
    <span class="song-duration">{formatTime(song.duration)}</span>
    <button
      type="button"
      class="queue-btn"
      title="Add to queue"
      on:click={handleQueueClick}
      aria-label="Add to queue"
    >
      +Q
    </button>
  </div>

  <!-- Long press popup modal -->
  {#if showMenu}
    <div
      class="context-popup"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      on:click|stopPropagation
      on:keydown|stopPropagation
    >
      <button type="button" class="popup-btn" on:click={handleQueueClick}>
        + ADD TO QUEUE
      </button>
      <button type="button" class="popup-close" on:click={() => (showMenu = false)} aria-label="Close menu">&times;</button>
    </div>
  {/if}
</div>

<style>
  .song-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 64px;
    padding: 10px 12px;
    background: #0a0a0a;
    border-bottom: 1px solid #1a1a1a;
    cursor: pointer;
    position: relative;
    user-select: none;
    box-sizing: border-box;
    transition: background 0.15s ease;
  }

  .song-row:hover {
    background: #111111;
  }

  .song-row.active {
    border-left: 3px solid #e8192c;
    background: #141414;
  }

  .thumb-container {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border: 1px solid #ffffff;
    border-radius: 4px;
  }

  .thumb-placeholder {
    width: 100%;
    height: 100%;
    background: #e8192c;
    color: #ffffff;
    border: 1px solid #ffffff;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 16px;
  }

  /* Equalizer Animation */
  .eq-icon {
    width: 40px;
    height: 40px;
    background: #111111;
    border: 1px solid #e8192c;
    border-radius: 4px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 4px;
    padding-bottom: 8px;
  }

  .eq-icon .bar {
    width: 4px;
    background: #e8192c;
    border-radius: 1px;
    animation: bounce 0.8s ease-in-out infinite alternate;
  }

  .eq-icon .bar-1 { height: 12px; animation-delay: 0.1s; }
  .eq-icon .bar-2 { height: 20px; animation-delay: 0.3s; }
  .eq-icon .bar-3 { height: 14px; animation-delay: 0.2s; }

  @keyframes bounce {
    0% { height: 6px; }
    100% { height: 22px; }
  }

  .song-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .song-title {
    color: #ffffff;
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .song-title.active-title {
    color: #e8192c;
  }

  .song-meta {
    color: #888888;
    font-size: 12px;
    font-weight: 400;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .genre-tag {
    color: #888888;
    font-weight: 600;
  }

  .dot {
    margin: 0 2px;
    color: #555555;
  }

  .song-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .song-duration {
    color: #888888;
    font-size: 12px;
    font-weight: 400;
  }

  .queue-btn {
    background: #111111;
    border: 1px solid #444444;
    color: #888888;
    font-size: 10px;
    font-weight: 700;
    padding: 4px 6px;
    border-radius: 4px;
    transition: all 0.1s ease;
  }

  .queue-btn:hover, .queue-btn:active {
    background: #e8192c;
    border-color: #ffffff;
    color: #ffffff;
    box-shadow: 2px 2px 0 #ffffff;
  }

  /* Context popup for long press */
  .context-popup {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: #111111;
    border: 2px solid #ffffff;
    box-shadow: 4px 4px 0 #e8192c;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    z-index: 20;
  }

  .popup-btn {
    background: #e8192c;
    color: #ffffff;
    font-weight: 700;
    font-size: 11px;
    letter-spacing: 1px;
    padding: 6px 10px;
    border-radius: 4px;
    border: 1px solid #ffffff;
  }

  .popup-close {
    background: transparent;
    color: #ffffff;
    font-size: 12px;
    padding: 4px;
  }
</style>
