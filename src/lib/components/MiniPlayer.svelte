<script lang="ts">
  import { currentSong, isPlaying, progress, showPlayer } from '$lib/stores/player';
  import { togglePlay, playNext, playPrev } from '$lib/player';

  function openBoombox() {
    showPlayer.set(true);
  }
</script>

{#if $currentSong}
  <div class="mini-player" on:click={openBoombox} role="region" aria-label="Now Playing Mini Player">
    <!-- Top 2px progress bar -->
    <div class="progress-bar-container">
      <div class="progress-fill" style="width: {Math.min(100, Math.max(0, $progress * 100))}%;"></div>
    </div>

    <!-- Thumbnail -->
    <div class="thumb-box">
      {#if $currentSong.thumbnail_url}
        <img src={$currentSong.thumbnail_url} alt={$currentSong.title} class="thumb-img" />
      {:else}
        <div class="thumb-placeholder">
          {$currentSong.title ? $currentSong.title.charAt(0).toUpperCase() : 'B'}
        </div>
      {/if}
    </div>

    <!-- Song Info -->
    <div class="meta-box">
      <div class="title">{$currentSong.title}</div>
      <div class="artist">{$currentSong.artist}</div>
    </div>

    <!-- Controls -->
    <div class="controls-box" on:click|stopPropagation>
      <button
        type="button"
        class="ctrl-btn prev-btn"
        on:click={playPrev}
        aria-label="Previous track"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
        </svg>
      </button>

      <button
        type="button"
        class="play-btn"
        on:click={togglePlay}
        aria-label={$isPlaying ? 'Pause' : 'Play'}
      >
        {#if $isPlaying}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        {:else}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        {/if}
      </button>

      <button
        type="button"
        class="ctrl-btn next-btn"
        on:click={playNext}
        aria-label="Next track"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
        </svg>
      </button>
    </div>
  </div>
{/if}

<style>
  .mini-player {
    position: fixed;
    bottom: calc(64px + env(safe-area-inset-bottom, 0px));
    left: 0;
    right: 0;
    height: 64px;
    background: #111111;
    border-top: 2px solid #ffffff;
    border-bottom: 2px solid #1a1a1a;
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 12px;
    z-index: 45;
    cursor: pointer;
    box-sizing: border-box;
  }

  .progress-bar-container {
    position: absolute;
    top: -2px;
    left: 0;
    right: 0;
    height: 2px;
    background: transparent;
    pointer-events: none;
  }

  .progress-fill {
    height: 100%;
    background: #e8192c;
    transition: width 0.1s linear;
  }

  .thumb-box {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
  }

  .thumb-img {
    width: 40px;
    height: 40px;
    object-fit: cover;
    border: 1px solid #ffffff;
    border-radius: 0;
    display: block;
  }

  .thumb-placeholder {
    width: 40px;
    height: 40px;
    background: #e8192c;
    color: #ffffff;
    border: 1px solid #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 16px;
  }

  .meta-box {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .title {
    color: #ffffff;
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .artist {
    color: #888888;
    font-size: 12px;
    font-weight: 400;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .controls-box {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .ctrl-btn {
    background: transparent;
    border: none;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    cursor: pointer;
    transition: transform 0.08s ease;
  }

  .ctrl-btn:active {
    transform: translate(2px, 2px);
  }

  .play-btn {
    width: 36px;
    height: 36px;
    background: #e8192c;
    color: #ffffff;
    border: 2px solid #ffffff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 2px 2px 0 #ffffff;
    transition: transform 0.08s ease, box-shadow 0.08s ease;
  }

  .play-btn:active {
    transform: translate(2px, 2px);
    box-shadow: none;
  }
</style>
