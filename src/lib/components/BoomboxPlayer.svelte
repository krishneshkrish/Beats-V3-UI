<script lang="ts">
  import {
    currentSong,
    isPlaying,
    progress,
    currentTime,
    duration,
    volume,
    showPlayer,
    queue
  } from '$lib/stores/player';
  import {
    togglePlay,
    playNext,
    playPrev,
    seek,
    setVolume,
    formatTime,
    playSong
  } from '$lib/player';

  import { onMount } from 'svelte';

  let touchStartY = 0;
  let progressBar: HTMLDivElement;

  onMount(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closePlayer();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length > 0) {
      touchStartY = e.touches[0].clientY;
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    if (e.changedTouches.length > 0) {
      const deltaY = e.changedTouches[0].clientY - touchStartY;
      if (deltaY > 80) {
        closePlayer();
      }
    }
  }

  function closePlayer() {
    showPlayer.set(false);
  }

  function handleProgressClick(e: MouseEvent) {
    if (!progressBar) return;
    const rect = progressBar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seek(ratio);
  }

  function handleVolumeChange(e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    setVolume(val);
  }

  function playUpNext() {
    if ($queue.length > 0) {
      playNext();
    }
  }

  function jumpToQueueSong(item: any, index: number) {
    const remaining = $queue.slice(index + 1);
    playSong(item, remaining);
  }
</script>

{#if $showPlayer && $currentSong}
  <div
    class="boombox-overlay"
    on:touchstart={handleTouchStart}
    on:touchend={handleTouchEnd}
    on:click={closePlayer}
    role="dialog"
    aria-modal="true"
    aria-label="Boombox Player"
  >
    <!-- Drag indicator -->
    <button type="button" class="drag-indicator" on:click|stopPropagation={closePlayer} aria-label="Close player"></button>

    <!-- Retro Boombox Body -->
    <div class="boombox-shell" on:click|stopPropagation>
      <!-- Decorative Antenna -->
      <div class="antenna"></div>

      <!-- Top Strip -->
      <div class="top-strip">
        <div class="brand-title">BEATS</div>
        <div class="model-badge">MK-II</div>
        <button type="button" class="close-btn" on:click|stopPropagation={closePlayer} aria-label="Close boombox">&times;</button>
      </div>

      <!-- Main Deck: Left Speaker, Cassette Window, Right Speaker -->
      <div class="main-deck">
        <!-- Left Speaker Grill -->
        <div class="speaker-grill left-grill">
          <div class="eq-bars left-eq" class:paused={!$isPlaying}>
            <span class="eq-bar bar-1"></span>
            <span class="eq-bar bar-2"></span>
            <span class="eq-bar bar-3"></span>
            <span class="eq-bar bar-4"></span>
            <span class="eq-bar bar-5"></span>
          </div>
        </div>

        <!-- Middle Cassette Window -->
        <div class="middle-deck">
          <div class="cassette-window">
            {#if $currentSong.thumbnail_url}
              <img
                src={$currentSong.thumbnail_url}
                alt={$currentSong.title}
                class="cassette-art"
              />
            {:else}
              <div class="cassette-placeholder">
                {$currentSong.artist ? $currentSong.artist.charAt(0).toUpperCase() : 'B'}
              </div>
            {/if}

            <!-- Two Reel Holes -->
            <div class="reel-system">
              <div class="reel reel-left" class:spinning={$isPlaying}>
                <div class="reel-center"></div>
              </div>
              <div class="reel reel-right" class:spinning={$isPlaying}>
                <div class="reel-center"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Speaker Grill -->
        <div class="speaker-grill right-grill">
          <div class="eq-bars right-eq" class:paused={!$isPlaying}>
            <span class="eq-bar bar-r1"></span>
            <span class="eq-bar bar-r2"></span>
            <span class="eq-bar bar-r3"></span>
            <span class="eq-bar bar-r4"></span>
            <span class="eq-bar bar-r5"></span>
          </div>
        </div>
      </div>

      <!-- Song Info -->
      <div class="song-info-section">
        <div class="title-container">
          <div class="title-text" class:marquee={$currentSong.title.length > 22}>
            {$currentSong.title}
          </div>
        </div>
        <div class="artist-text">
          {$currentSong.artist}
        </div>
      </div>

      <!-- Progress Section -->
      <div class="progress-section">
        <div
          class="progress-track"
          bind:this={progressBar}
          on:click={handleProgressClick}
          on:keydown={(e) => {
            if (e.key === 'ArrowRight') seek($progress + 0.05);
            if (e.key === 'ArrowLeft') seek($progress - 0.05);
          }}
          role="slider"
          aria-valuenow={Math.round($progress * 100)}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="Seek track"
          tabindex="0"
        >
          <div
            class="progress-fill"
            style="width: {Math.min(100, Math.max(0, $progress * 100))}%;"
          >
            <div class="progress-handle"></div>
          </div>
        </div>

        <div class="time-row">
          <span>{formatTime($currentTime)}</span>
          <span>{formatTime($duration)}</span>
        </div>
      </div>

      <!-- Controls Row -->
      <div class="controls-row">
        <button
          type="button"
          class="ctrl-button prev-button"
          on:click={playPrev}
          aria-label="Previous track"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
          </svg>
        </button>

        <button
          type="button"
          class="ctrl-button play-button"
          on:click={togglePlay}
          aria-label={$isPlaying ? 'Pause' : 'Play'}
        >
          {#if $isPlaying}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          {:else}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          {/if}
        </button>

        <button
          type="button"
          class="ctrl-button next-button"
          on:click={playNext}
          aria-label="Next track"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </button>
      </div>

      <!-- Volume Row -->
      <div class="volume-row">
        <span class="volume-label">VOL</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={$volume}
          on:input={handleVolumeChange}
          class="volume-slider"
          aria-label="Volume slider"
        />
        <span class="volume-value">{Math.round($volume * 100)}%</span>
      </div>

      <!-- Up Next Tape Section -->
      <div class="up-next-section">
        <div class="up-next-header-row">
          <div class="up-next-header">UP NEXT</div>
          <div class="autoplay-indicator">
            <span class="live-dot"></span>
            AUTOPLAY (RADIO)
          </div>
        </div>

        {#if $queue.length > 0}
          <div class="queue-list">
            {#each $queue.slice(0, 10) as item, i (item.id)}
              <div
                class="tape-card"
                on:click={() => jumpToQueueSong(item, i)}
                on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jumpToQueueSong(item, i); } }}
                role="button"
                tabindex="0"
              >
                <!-- Cassette SVG Icon -->
                <div class="cassette-icon">
                  <div class="tape-top-window"></div>
                  <div class="tape-wheels">
                    <span class="mini-wheel"></span>
                    <span class="mini-wheel"></span>
                  </div>
                </div>

                <!-- Next song info -->
                <div class="tape-info">
                  <div class="tape-title">{item.title}</div>
                  <div class="tape-artist">{item.artist} &middot; <span class="tape-genre">{item.genre.toUpperCase()}</span></div>
                </div>

                <div class="tape-duration">
                  {formatTime(item.duration)}
                </div>
              </div>
            {/each}
          </div>
          <div class="tape-instruction">TAP TO JUMP &bull; MUSIC PLAYS CONTINUOUSLY</div>
        {:else}
          <div class="queue-empty">AUTOPLAY READY &bull; FETCHING NEXT TRACKS</div>
        {/if}
      </div>

      <!-- Boombox Bottom Bar -->
      <div class="boombox-bottom">
        <div class="genre-badge">
          {$currentSong.genre.toUpperCase()}
        </div>
        <div class="hardware-id">&#9658; BEATS MK-II</div>
      </div>
    </div>
  </div>
{/if}

<style>
  .boombox-overlay {
    position: fixed;
    inset: 0;
    background: #0a0a0a;
    z-index: 100;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    overflow-y: auto;
    box-sizing: border-box;
  }

  .drag-indicator {
    width: 32px;
    height: 4px;
    background: #333333;
    border-radius: 2px;
    margin-bottom: 16px;
    cursor: pointer;
  }

  /* Boombox Outer Shell */
  .boombox-shell {
    width: min(380px, 100vw - 32px);
    background: #1a1a1a;
    border: 3px solid #ffffff;
    border-radius: 20px;
    box-shadow: 6px 6px 0 #e8192c;
    padding: 20px 16px;
    position: relative;
    box-sizing: border-box;
  }

  /* Decorative Antenna */
  .antenna {
    position: absolute;
    top: -38px;
    right: 28px;
    width: 4px;
    height: 40px;
    background: #ffffff;
    border-radius: 2px;
    transform: rotate(-10deg);
    transform-origin: bottom center;
  }

  /* Top Strip */
  .top-strip {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14px;
  }

  .brand-title {
    color: #e8192c;
    font-weight: 700;
    font-size: 16px;
    letter-spacing: 3px;
  }

  .model-badge {
    color: #555555;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1px;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: #ffffff;
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
    padding: 2px 6px;
  }

  /* Main Deck */
  .main-deck {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  /* Speaker Grills */
  .speaker-grill {
    width: 72px;
    height: 94px;
    background: #111111;
    border: 2px solid #333333;
    border-radius: 8px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    background-image: radial-gradient(circle, #333333 1px, transparent 1px);
    background-size: 8px 8px;
    overflow: hidden;
    flex-shrink: 0;
  }

  .eq-bars {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 3px;
    height: 50px;
  }

  .eq-bars.paused .eq-bar {
    animation-play-state: paused !important;
  }

  .eq-bar {
    width: 4px;
    border-radius: 2px 2px 0 0;
  }

  /* Left grill EQ: red */
  .left-eq .eq-bar {
    background: #e8192c;
  }
  .left-eq .bar-1 { height: 16px; animation: eq1 0.5s ease-in-out infinite alternate; }
  .left-eq .bar-2 { height: 32px; animation: eq2 0.7s ease-in-out infinite alternate; }
  .left-eq .bar-3 { height: 42px; animation: eq3 0.4s ease-in-out infinite alternate; }
  .left-eq .bar-4 { height: 26px; animation: eq4 0.6s ease-in-out infinite alternate; }
  .left-eq .bar-5 { height: 14px; animation: eq5 0.8s ease-in-out infinite alternate; }

  /* Right grill EQ: white */
  .right-eq .eq-bar {
    background: #ffffff;
  }
  .right-eq .bar-r1 { height: 20px; animation: eq3 0.6s ease-in-out infinite alternate; }
  .right-eq .bar-r2 { height: 38px; animation: eq1 0.45s ease-in-out infinite alternate; }
  .right-eq .bar-r3 { height: 28px; animation: eq5 0.75s ease-in-out infinite alternate; }
  .right-eq .bar-r4 { height: 40px; animation: eq2 0.55s ease-in-out infinite alternate; }
  .right-eq .bar-r5 { height: 18px; animation: eq4 0.65s ease-in-out infinite alternate; }

  @keyframes eq1 { 0% { height: 8px; } 100% { height: 36px; } }
  @keyframes eq2 { 0% { height: 14px; } 100% { height: 46px; } }
  @keyframes eq3 { 0% { height: 6px; } 100% { height: 40px; } }
  @keyframes eq4 { 0% { height: 12px; } 100% { height: 32px; } }
  @keyframes eq5 { 0% { height: 10px; } 100% { height: 44px; } }

  /* Middle Cassette Deck */
  .middle-deck {
    flex: 1;
    display: flex;
    justify-content: center;
  }

  .cassette-window {
    width: 140px;
    height: 94px;
    background: #0a0a0a;
    border: 3px solid #444444;
    border-radius: 8px;
    box-shadow: inset 0 4px 8px rgba(0, 0, 0, 0.8);
    position: relative;
    overflow: hidden;
  }

  .cassette-art {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.9;
  }

  .cassette-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #1a1a1a, #333333);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    font-size: 40px;
    font-weight: 700;
  }

  /* Cassette Reels */
  .reel-system {
    position: absolute;
    bottom: 8px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    gap: 32px;
  }

  .reel {
    width: 20px;
    height: 20px;
    background: #1a1a1a;
    border: 2px solid #666666;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .reel.spinning {
    animation: spin 2s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .reel-center {
    width: 8px;
    height: 8px;
    background: #e8192c;
    border-radius: 50%;
  }

  /* Song Info */
  .song-info-section {
    margin-top: 14px;
    text-align: center;
  }

  .title-container {
    max-width: 220px;
    margin: 0 auto;
    overflow: hidden;
    white-space: nowrap;
  }

  .title-text {
    color: #ffffff;
    font-size: 16px;
    font-weight: 700;
    display: inline-block;
  }

  .title-text.marquee {
    animation: marquee 8s linear infinite;
  }

  @keyframes marquee {
    0% { transform: translateX(50%); }
    100% { transform: translateX(-100%); }
  }

  .artist-text {
    color: #e8192c;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 1px;
    margin-top: 4px;
    text-transform: uppercase;
  }

  /* Progress Section */
  .progress-section {
    width: 100%;
    margin-top: 14px;
  }

  .progress-track {
    height: 4px;
    background: #333333;
    border-radius: 2px;
    cursor: pointer;
    position: relative;
  }

  .progress-fill {
    height: 100%;
    background: #e8192c;
    border-radius: 2px;
    transition: width 0.1s linear;
    position: relative;
  }

  .progress-handle {
    position: absolute;
    right: -6px;
    top: -4px;
    width: 12px;
    height: 12px;
    background: #ffffff;
    border: 2px solid #e8192c;
    border-radius: 50%;
  }

  .time-row {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 11px;
    font-weight: 600;
    color: #555555;
    letter-spacing: 1px;
  }

  /* Controls Row */
  .controls-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-top: 14px;
  }

  .ctrl-button {
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.08s ease, box-shadow 0.08s ease;
  }

  .prev-button, .next-button {
    width: 44px;
    height: 44px;
    background: #111111;
    border: 2px solid #ffffff;
    border-radius: 50%;
    box-shadow: 3px 3px 0 #ffffff;
    color: #ffffff;
  }

  .prev-button:active, .next-button:active {
    transform: translate(3px, 3px);
    box-shadow: none;
  }

  .play-button {
    width: 60px;
    height: 60px;
    background: #e8192c;
    border: 2px solid #ffffff;
    border-radius: 50%;
    box-shadow: 4px 4px 0 #ffffff;
    color: #ffffff;
  }

  .play-button:active {
    transform: translate(4px, 4px);
    box-shadow: none;
  }

  /* Volume Row */
  .volume-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 12px;
  }

  .volume-label {
    color: #555555;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 2px;
  }

  .volume-slider {
    flex: 1;
    height: 4px;
    background: #333333;
    border-radius: 2px;
    -webkit-appearance: none;
    appearance: none;
    outline: none;
  }

  .volume-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    background: #ffffff;
    border: 2px solid #e8192c;
    border-radius: 50%;
    cursor: pointer;
  }

  .volume-value {
    color: #e8192c;
    font-size: 10px;
    font-weight: 700;
    min-width: 28px;
    text-align: right;
  }

  /* Up Next Section */
  .up-next-section {
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid #222222;
  }

  .up-next-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .up-next-header {
    color: #888888;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 3px;
  }

  .autoplay-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.5px;
    color: #00e676;
    background: rgba(0, 230, 118, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid rgba(0, 230, 118, 0.25);
  }

  .live-dot {
    width: 5px;
    height: 5px;
    background: #00e676;
    border-radius: 50%;
    box-shadow: 0 0 6px #00e676;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0% { opacity: 0.4; }
    50% { opacity: 1; }
    100% { opacity: 0.4; }
  }

  .queue-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 220px;
    overflow-y: auto;
    padding-right: 4px;
  }

  .tape-genre {
    color: #e8192c;
    font-size: 9px;
    font-weight: 700;
  }

  .tape-card {
    background: #111111;
    border: 2px solid #333333;
    border-radius: 8px;
    padding: 10px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 3px 3px 0 #e8192c;
    cursor: pointer;
  }

  .cassette-icon {
    width: 44px;
    height: 30px;
    background: #222222;
    border: 2px solid #555555;
    border-radius: 3px;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: 3px 4px;
    box-sizing: border-box;
    flex-shrink: 0;
  }

  .tape-top-window {
    width: 16px;
    height: 7px;
    background: #111111;
    border-radius: 1px;
  }

  .tape-wheels {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 0 4px;
    box-sizing: border-box;
  }

  .mini-wheel {
    width: 8px;
    height: 8px;
    border: 1px solid #666666;
    border-radius: 50%;
  }

  .tape-info {
    flex: 1;
    min-width: 0;
  }

  .tape-title {
    color: #ffffff;
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tape-artist {
    color: #888888;
    font-size: 11px;
    font-weight: 400;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tape-duration {
    color: #e8192c;
    font-size: 11px;
    font-weight: 700;
  }

  .tape-instruction {
    color: #333333;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 3px;
    text-align: center;
    margin-top: 8px;
  }

  .queue-empty {
    color: #333333;
    font-size: 11px;
    font-weight: 700;
    text-align: center;
    padding: 10px 0;
    letter-spacing: 2px;
  }

  /* Boombox Bottom */
  .boombox-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 14px;
  }

  .genre-badge {
    background: #e8192c;
    color: #ffffff;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 2px;
    padding: 3px 8px;
    border-radius: 3px;
  }

  .hardware-id {
    color: #333333;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1px;
  }
</style>
