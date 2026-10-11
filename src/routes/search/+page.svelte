<script lang="ts">
  import { onMount } from 'svelte';
  import { searchSongs, getRecommendations } from '$lib/api';
  import { getLocalUserId } from '$lib/user';
  import { playSong, addToQueue } from '$lib/player';
  import SongRow from '$lib/components/SongRow.svelte';
  import type { Song } from '$lib/types';

  let query = '';
  let results: Song[] = [];
  let isSearching = false;
  let hasSearched = false;
  let debounceTimer: any = null;
  let searchSeq = 0;
  let searchInput: HTMLInputElement;

  const GENRE_CARDS = [
    { id: 'malayalam', name: 'MALAYALAM', count: '140+ tracks' },
    { id: 'tamil',     name: 'TAMIL',     count: '210+ tracks' },
    { id: 'hindi',     name: 'HINDI',     count: '180+ tracks' },
    { id: 'english',   name: 'ENGLISH',   count: '320+ tracks' },
    { id: 'phonk',     name: 'PHONK',     count: '95+ tracks' },
    { id: 'mix',       name: 'MIX TAPES', count: '60+ tracks' }
  ];

  onMount(() => {
    if (searchInput) {
      searchInput.focus();
    }
  });

  async function executeSearch(targetQuery?: string) {
    clearTimeout(debounceTimer);
    if (targetQuery !== undefined) {
      query = targetQuery;
    }
    const clean = query.trim();
    if (clean.length < 2) {
      results = [];
      isSearching = false;
      hasSearched = false;
      return;
    }

    const currentSeq = ++searchSeq;
    isSearching = true;
    hasSearched = true;
    const res = await searchSongs(clean);
    if (currentSeq === searchSeq) {
      results = res;
      isSearching = false;
    }
  }

  function handleInput() {
    clearTimeout(debounceTimer);
    if (!query || query.trim().length < 2) {
      results = [];
      isSearching = false;
      hasSearched = false;
      return;
    }

    isSearching = true;
    debounceTimer = setTimeout(() => {
      executeSearch();
    }, 350);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      executeSearch();
    }
  }

  function clearSearch() {
    query = '';
    results = [];
    isSearching = false;
    hasSearched = false;
    if (searchInput) searchInput.focus();
  }

  function handleGenreCardClick(genreId: string) {
    executeSearch(genreId);
  }

  function handlePlaySearchResult(song: Song) {
    // Immediately seed the authentic YouTube Music mood queue for the searched song
    playSong(song);
  }
</script>

<div class="search-page-container">
  <!-- Header -->
  <header class="search-header">
    <h1 class="search-title">SEARCH</h1>
  </header>

  <!-- Input Field -->
  <div class="input-wrapper">
    <div class="input-relative">
      <input
        type="text"
        bind:this={searchInput}
        bind:value={query}
        on:input={handleInput}
        on:keydown={handleKeydown}
        placeholder="songs, artists, films, genres..."
        class="search-input"
      />
      {#if query.length > 0}
        <button
          type="button"
          class="clear-input-btn"
          on:click={clearSearch}
          aria-label="Clear search"
        >
          ✕
        </button>
      {/if}
    </div>
  </div>

  <!-- States -->
  {#if isSearching}
    <div class="status-msg">SEARCHING...</div>
  {:else if query.trim().length >= 2}
    {#if results.length > 0}
      <div class="results-header">
        {results.length} RESULTS FOR '{query}'
      </div>
      <div class="song-list">
        {#each results as song (song.id)}
          <SongRow
            {song}
            onPlay={handlePlaySearchResult}
            onAddToQueue={addToQueue}
          />
        {/each}
      </div>
    {:else if hasSearched}
      <div class="no-results">
        <div class="no-results-main">NO SONGS FOUND</div>
        <div class="no-results-sub">try a different search</div>
      </div>
    {/if}
  {:else}
    <!-- Empty Query: Genre Browse Grid -->
    <div class="browse-section">
      <div class="browse-header">BROWSE BY GENRE</div>
      <div class="genre-grid">
        {#each GENRE_CARDS as gc}
          <button
            type="button"
            class="genre-card"
            on:click={() => handleGenreCardClick(gc.id)}
          >
            <div class="gc-name">{gc.name}</div>
            <div class="gc-count">{gc.count}</div>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .search-page-container {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    padding-bottom: 160px;
    box-sizing: border-box;
  }

  .search-header {
    padding: 16px;
  }

  .search-title {
    color: #ffffff;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 2px;
    margin: 0;
  }

  .input-wrapper {
    padding: 0 16px 16px;
  }

  .input-relative {
    position: relative;
    width: 100%;
    display: flex;
    align-items: center;
  }

  .search-input {
    width: 100%;
    height: 52px;
    background: #111111;
    border: 2px solid #ffffff;
    color: #ffffff;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 1rem;
    font-weight: 600;
    padding: 0 44px 0 16px;
    border-radius: 8px;
    box-shadow: 4px 4px 0 #ffffff;
    outline: none;
    box-sizing: border-box;
    transition: all 0.15s ease;
  }

  .clear-input-btn {
    position: absolute;
    right: 14px;
    background: #222222;
    color: #ffffff;
    border: 1px solid #ffffff;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 11px;
    font-weight: 700;
    padding: 0;
    transition: all 0.15s ease;
  }

  .clear-input-btn:hover {
    background: #e8192c;
    border-color: #e8192c;
  }

  .search-input::placeholder {
    color: #444444;
  }

  .search-input:focus {
    border-color: #e8192c;
    box-shadow: 4px 4px 0 #e8192c;
  }

  .status-msg {
    text-align: center;
    color: #555555;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 2px;
    padding: 40px 16px;
  }

  .results-header {
    color: #555555;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    margin: 0 16px 12px;
    text-transform: uppercase;
  }

  .song-list {
    display: flex;
    flex-direction: column;
    padding: 0 16px;
  }

  .no-results {
    text-align: center;
    padding: 60px 16px;
  }

  .no-results-main {
    color: #555555;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 2px;
  }

  .no-results-sub {
    color: #333333;
    font-size: 12px;
    margin-top: 6px;
  }

  /* Browse Grid */
  .browse-section {
    padding: 0 16px;
  }

  .browse-header {
    color: #555555;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2px;
    margin-bottom: 12px;
  }

  .genre-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .genre-card {
    background: #111111;
    border: 2px solid #ffffff;
    box-shadow: 3px 3px 0 #ffffff;
    padding: 20px;
    border-radius: 8px;
    text-align: left;
    cursor: pointer;
    transition: transform 0.08s ease, box-shadow 0.08s ease;
  }

  .genre-card:active {
    transform: translate(3px, 3px);
    box-shadow: none;
  }

  .gc-name {
    color: #ffffff;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 1px;
  }

  .gc-count {
    color: #888888;
    font-size: 12px;
    margin-top: 4px;
  }
</style>
