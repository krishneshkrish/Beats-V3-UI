<script lang="ts">
  import { onMount } from 'svelte';
  import { GENRES } from '$lib/config';
  import { getRecommendations, getTrending, getSongs } from '$lib/api';
  import { getUserName, setUserName, getLocalUserId } from '$lib/user';
  import { playSong, addToQueue } from '$lib/player';
  import GenrePill from '$lib/components/GenrePill.svelte';
  import SongRow from '$lib/components/SongRow.svelte';
  import type { Song } from '$lib/types';

  let userName: string | null = null;
  let showOnboarding = false;
  let nameInput = '';

  let activeGenre = 'all';
  let recommendations: Song[] = [];
  let trending: Song[] = [];
  let loadingSongs = true;
  let timeBlockInfo = {
    block_name: 'For You',
    block_tag: 'FOR YOU',
    greeting: 'HEY',
    block_description: 'Personalized based on your listening habits'
  };

  onMount(async () => {
    userName = getUserName();
    if (!userName) {
      showOnboarding = true;
    }
    await loadContent('all');
  });

  async function loadContent(genre: string) {
    loadingSongs = true;
    const userId = getLocalUserId();

    if (genre === 'all') {
      const [recs, trend] = await Promise.all([
        getRecommendations(userId),
        getTrending()
      ]);
      recommendations = recs;
      trending = trend;
      if (recs.block_name) {
        timeBlockInfo = {
          block_name: recs.block_name,
          block_tag: recs.block_tag || 'FOR YOU',
          greeting: recs.greeting || 'HEY',
          block_description: recs.block_description || ''
        };
      }
    } else {
      const [filteredSongs, trend] = await Promise.all([
        getSongs(genre, 15),
        getTrending(genre)
      ]);
      recommendations = filteredSongs;
      trending = trend;
    }
    loadingSongs = false;
  }

  function handleGenreClick(genreId: string) {
    activeGenre = genreId;
    loadContent(genreId);
  }

  function handleSaveName() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setUserName(trimmed);
    userName = trimmed;
    showOnboarding = false;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSaveName();
    }
  }

  function handlePlayFromRecs(song: Song) {
    // Zero-friction Up Next: Let playSong automatically seed the authentic YouTube Music mood queue
    playSong(song);
  }

  function handlePlayFromTrending(song: Song) {
    // Zero-friction Up Next: Let playSong automatically seed the authentic YouTube Music mood queue
    playSong(song);
  }
</script>

<div class="home-container">
  <!-- Onboarding Overlay -->
  {#if showOnboarding}
    <div class="onboarding-overlay">
      <div class="onboarding-card">
        <h1 class="onboard-title">WHAT'S YOUR NAME?</h1>
        <p class="onboard-subtitle">we'll personalise your music</p>

        <input
          type="text"
          class="onboard-input"
          placeholder="your name..."
          bind:value={nameInput}
          on:keydown={handleKeyDown}
          autofocus
        />

        <button type="button" class="onboard-btn" on:click={handleSaveName}>LET'S GO &rarr;</button>
      </div>
    </div>
  {/if}

  <!-- Top Bar -->
  <header class="top-bar">
    <div class="brand-greeting">
      {#if userName}
        <div class="greeting-block">
          <div class="time-badge">
            <span class="badge-dot"></span>
            {timeBlockInfo.block_tag}
          </div>
          <h2 class="user-greeting">{timeBlockInfo.greeting}, {userName.toUpperCase()}</h2>
        </div>
      {:else}
        <h2 class="brand-logo">BEATS</h2>
      {/if}
    </div>

    <a href="/search" class="search-link" aria-label="Search">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    </a>
  </header>

  <!-- Horizontal Genre Pills -->
  <div class="genre-bar" role="tablist" aria-label="Genre filters">
    {#each GENRES as g}
      <GenrePill
        genre={g.id}
        label={g.label}
        active={activeGenre === g.id}
        onClick={() => handleGenreClick(g.id)}
      />
    {/each}
  </div>

  <!-- Main Content Sections -->
  <div class="sections-container">
    <!-- Section 1: For You -->
    <section class="music-section">
      <div class="section-header">
        <div class="title-with-desc">
          <span class="section-title">
            {activeGenre === 'all' ? timeBlockInfo.block_name.toUpperCase() : `${activeGenre.toUpperCase()} TRACKS`}
          </span>
          {#if activeGenre === 'all' && timeBlockInfo.block_description}
            <span class="section-subtitle">{timeBlockInfo.block_description}</span>
          {/if}
        </div>
        <span class="see-all">SEE ALL</span>
      </div>

      {#if loadingSongs}
        <div class="loading-placeholder">LOADING TRACKS...</div>
      {:else if recommendations.length > 0}
        <div class="song-list">
          {#each recommendations as song (song.id)}
            <SongRow
              {song}
              onPlay={handlePlayFromRecs}
              onAddToQueue={addToQueue}
            />
          {/each}
        </div>
      {:else}
        <div class="empty-placeholder">NO TRACKS AVAILABLE</div>
      {/if}
    </section>

    <!-- Section 2: Trending Now -->
    <section class="music-section">
      <div class="section-header">
        <span class="section-title">TRENDING NOW</span>
        <span class="see-all">SEE ALL</span>
      </div>

      {#if loadingSongs}
        <div class="loading-placeholder">LOADING TRENDING...</div>
      {:else if trending.length > 0}
        <div class="song-list">
          {#each trending as song (song.id)}
            <SongRow
              {song}
              onPlay={handlePlayFromTrending}
              onAddToQueue={addToQueue}
            />
          {/each}
        </div>
      {:else}
        <div class="empty-placeholder">NO TRENDING TRACKS</div>
      {/if}
    </section>
  </div>
</div>

<style>
  .home-container {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    padding-bottom: 160px;
    box-sizing: border-box;
  }

  /* Onboarding Overlay */
  .onboarding-overlay {
    position: fixed;
    inset: 0;
    background: #0a0a0a;
    z-index: 200;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px;
    box-sizing: border-box;
  }

  .onboarding-card {
    width: 100%;
    max-width: 360px;
    display: flex;
    flex-direction: column;
  }

  .onboard-title {
    color: #ffffff;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.5px;
    margin-bottom: 8px;
  }

  .onboard-subtitle {
    color: #555555;
    font-size: 14px;
    margin-bottom: 32px;
  }

  .onboard-input {
    width: 100%;
    height: 52px;
    background: #0a0a0a;
    border: 2px solid #ffffff;
    color: #ffffff;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 1rem;
    font-weight: 600;
    padding: 0 16px;
    border-radius: 8px;
    box-shadow: 4px 4px 0 #ffffff;
    outline: none;
    box-sizing: border-box;
    transition: all 0.15s ease;
  }

  .onboard-input:focus {
    border-color: #e8192c;
    box-shadow: 4px 4px 0 #e8192c;
  }

  .onboard-btn {
    margin-top: 16px;
    width: 100%;
    height: 52px;
    background: #e8192c;
    color: #ffffff;
    border: 2px solid #ffffff;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 1px;
    box-shadow: 4px 4px 0 #ffffff;
    border-radius: 8px;
    cursor: pointer;
    transition: transform 0.08s ease, box-shadow 0.08s ease;
  }

  .onboard-btn:active {
    transform: translate(4px, 4px);
    box-shadow: none;
  }

  /* Top Bar */
  .top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 16px 8px;
  }

  .brand-greeting {
    display: flex;
    align-items: center;
  }

  .greeting-block {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .time-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 700;
    color: #e8192c;
    letter-spacing: 2px;
    background: rgba(232, 25, 44, 0.12);
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid rgba(232, 25, 44, 0.3);
    width: fit-content;
  }

  .badge-dot {
    width: 6px;
    height: 6px;
    background: #e8192c;
    border-radius: 50%;
    box-shadow: 0 0 6px #e8192c;
  }

  .title-with-desc {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .section-subtitle {
    font-size: 11px;
    color: #777777;
    font-weight: 500;
  }

  .user-greeting {
    color: #ffffff;
    font-size: 18px;
    font-weight: 700;
    margin: 0;
  }

  .brand-logo {
    color: #e8192c;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 3px;
    margin: 0;
  }

  .search-link {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 4px;
  }

  /* Horizontal Genre Bar */
  .genre-bar {
    display: flex;
    overflow-x: auto;
    padding: 8px 16px;
    gap: 8px;
    margin-bottom: 12px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .genre-bar::-webkit-scrollbar {
    display: none;
  }

  /* Sections */
  .sections-container {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .music-section {
    padding: 0 16px;
    box-sizing: border-box;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .section-title {
    color: #ffffff;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 2px;
  }

  .see-all {
    color: #555555;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }

  .song-list {
    display: flex;
    flex-direction: column;
  }

  .loading-placeholder, .empty-placeholder {
    padding: 24px 0;
    text-align: center;
    color: #555555;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 2px;
  }
</style>
