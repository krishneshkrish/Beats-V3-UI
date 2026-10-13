<script lang="ts">
  import { onMount } from 'svelte';
  import { getUserStats } from '$lib/api';
  import { getLocalUserId, getUserName } from '$lib/user';
  import type { UserStats } from '$lib/types';

  export let statsData: UserStats | null = null;

  let loading = true;
  let userName: string | null = null;
  let tasteProfile: string =
    'Heavy rotation on Malayalam underground hip-hop and high-energy Tamil anthem drops. Consistent late-night listening spike around 9 PM to midnight.';

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const HOURS = Array.from({ length: 24 }, (_, i) => i);

  let refreshing = false;

  async function loadStats(showSpinner = false) {
    if (showSpinner) refreshing = true;
    const userId = getLocalUserId();
    const data = await getUserStats(userId);
    if (data) {
      statsData = data;
      if ((data as any).taste_profile) {
        tasteProfile = (data as any).taste_profile;
      }
    }
    refreshing = false;
    loading = false;
  }

  onMount(() => {
    userName = getUserName();
    loadStats();
    if (typeof window !== 'undefined') {
      const onFocus = () => loadStats(false);
      window.addEventListener('focus', onFocus);
      return () => window.removeEventListener('focus', onFocus);
    }
  });

  function getCellColor(count: number): string {
    if (count <= 0) return '#111111';
    if (count <= 2) return '#4a0a0e';
    if (count <= 5) return '#8b1520';
    return '#e8192c';
  }
</script>

<div class="stats-container">
  <!-- Header -->
  <div class="stats-header">
    <div class="title-row">
      <h1 class="page-title">YOUR STATS</h1>
      <div class="header-badges">
        <span class="range-badge">LAST 30 DAYS</span>
        <button type="button" class="refresh-badge-btn" on:click={() => loadStats(true)} disabled={refreshing}>
          {refreshing ? 'UPDATING...' : '⟳ REFRESH'}
        </button>
      </div>
    </div>
    {#if userName}
      <div class="user-subtext">LISTENER: {userName.toUpperCase()}</div>
    {/if}
  </div>

  {#if loading && !statsData}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <span>CALCULATING METRICS...</span>
    </div>
  {:else if statsData}
    <!-- 2 Metric Cards -->
    <div class="cards-row">
      <div class="stat-card">
        <div class="stat-value">{statsData.total_songs}</div>
        <div class="stat-label">SONGS</div>
        <div class="stat-sub">this month</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">
          {typeof statsData.total_hours === 'number' ? statsData.total_hours.toFixed(1) : statsData.total_hours}
        </div>
        <div class="stat-label">HOURS</div>
        <div class="stat-sub">this month</div>
      </div>
    </div>

    <!-- Top Genres -->
    <div class="section-block">
      <div class="section-title">TOP GENRES</div>
      <div class="genres-list">
        {#each statsData.top_genres as g}
          <div class="genre-item">
            <div class="genre-name">{g.genre.toUpperCase()}</div>
            <div class="genre-bar-track">
              <div
                class="genre-bar-fill"
                style="width: {Math.max(8, Math.min(100, g.pct || Math.round((g.count / (statsData.total_songs || 1)) * 100)))}%;"
              ></div>
            </div>
            <div class="genre-count">{g.count} plays</div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Top Artists -->
    <div class="section-block">
      <div class="section-title">TOP ARTISTS</div>
      <div class="artists-list">
        {#each statsData.top_artists as a, idx}
          <div class="artist-item">
            <span class="artist-rank">#{idx + 1}</span>
            <span class="artist-name">{a.artist}</span>
            <span class="artist-dots"></span>
            <span class="artist-count">{a.count} plays</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Heatmap Section: The Screenshot Moment -->
    <div class="section-block heatmap-section">
      <div class="heatmap-header">
        <div class="section-title">LISTENING PATTERN</div>
        <div class="heatmap-sub">hours you listen most</div>
      </div>

      <div class="heatmap-card">
        <div class="heatmap-grid">
          <!-- Rows: 7 Days -->
          {#each DAYS as day, dIdx}
            <div class="heatmap-row">
              <span class="day-label">{day}</span>
              <div class="cells-row">
                {#each HOURS as hour}
                  {@const val = statsData.heatmap?.[String(dIdx)]?.[hour] || 0}
                  <div
                    class="heat-cell"
                    style="background-color: {getCellColor(val)};"
                    title="{day} {hour}:00 - {val} plays"
                  ></div>
                {/each}
              </div>
            </div>
          {/each}
        </div>

        <!-- Hour labels footer -->
        <div class="hour-axis">
          <span class="axis-spacer"></span>
          <div class="hour-labels">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:00</span>
          </div>
        </div>

        <!-- Heat Legend -->
        <div class="heat-legend">
          <span class="legend-text">LESS</span>
          <div class="legend-squares">
            <span class="leg-cell" style="background:#111111;"></span>
            <span class="leg-cell" style="background:#4a0a0e;"></span>
            <span class="leg-cell" style="background:#8b1520;"></span>
            <span class="leg-cell" style="background:#e8192c;"></span>
          </div>
          <span class="legend-text">MORE</span>
        </div>
      </div>
    </div>

    <!-- Taste Profile Section -->
    <div class="section-block">
      <div class="section-title">YOUR TASTE</div>
      <div class="taste-card">
        <p class="taste-text">{tasteProfile}</p>
        <div class="taste-footer">AI generated &middot; updates weekly</div>
      </div>
    </div>
  {/if}
</div>

<style>
  .stats-container {
    padding: 16px;
    padding-bottom: 160px;
    max-width: 600px;
    margin: 0 auto;
    box-sizing: border-box;
  }

  .stats-header {
    margin-bottom: 24px;
  }

  .title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .page-title {
    color: #ffffff;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 2px;
    margin: 0;
  }

  .header-badges {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .range-badge {
    color: #555555;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    border: 1px solid #333333;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .refresh-badge-btn {
    background: transparent;
    color: #e8192c;
    border: 1px solid #e8192c;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1px;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .refresh-badge-btn:hover:not(:disabled) {
    background: #e8192c;
    color: #ffffff;
  }

  .refresh-badge-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .user-subtext {
    color: #e8192c;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    margin-top: 4px;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 60px 0;
    color: #555555;
    font-weight: 700;
    letter-spacing: 2px;
    font-size: 12px;
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #222222;
    border-top-color: #e8192c;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Stats Cards */
  .cards-row {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
  }

  .stat-card {
    background: #111111;
    border: 2px solid #ffffff;
    box-shadow: 4px 4px 0 #e8192c;
    border-radius: 8px;
    padding: 16px;
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .stat-value {
    color: #ffffff;
    font-size: 36px;
    font-weight: 700;
    line-height: 1.1;
  }

  .stat-label {
    color: #555555;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2px;
    margin-top: 6px;
  }

  .stat-sub {
    color: #333333;
    font-size: 10px;
    font-weight: 600;
    margin-top: 2px;
  }

  /* Section Block */
  .section-block {
    margin-bottom: 28px;
  }

  .section-title {
    color: #ffffff;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 2px;
    margin-bottom: 12px;
  }

  /* Genres */
  .genres-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .genre-item {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .genre-name {
    color: #ffffff;
    font-size: 12px;
    font-weight: 700;
    width: 90px;
    flex-shrink: 0;
  }

  .genre-bar-track {
    flex: 1;
    background: #111111;
    height: 8px;
    border-radius: 4px;
    border: 1px solid #333333;
    overflow: hidden;
  }

  .genre-bar-fill {
    background: #e8192c;
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .genre-count {
    color: #555555;
    font-size: 11px;
    font-weight: 600;
    width: 55px;
    text-align: right;
    flex-shrink: 0;
  }

  /* Artists */
  .artists-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .artist-item {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 13px;
  }

  .artist-rank {
    color: #e8192c;
    font-weight: 700;
    font-size: 14px;
    width: 24px;
  }

  .artist-name {
    color: #ffffff;
    font-weight: 600;
    white-space: nowrap;
  }

  .artist-dots {
    flex: 1;
    border-bottom: 1px dotted #333333;
    margin: 0 4px;
  }

  .artist-count {
    color: #555555;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }

  /* Heatmap */
  .heatmap-section {
    position: relative;
  }

  .heatmap-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .heatmap-sub {
    color: #555555;
    font-size: 11px;
    font-weight: 600;
  }

  .heatmap-card {
    background: #111111;
    border: 2px solid #ffffff;
    box-shadow: 4px 4px 0 #ffffff;
    border-radius: 8px;
    padding: 16px 12px;
    overflow-x: auto;
  }

  .heatmap-grid {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 290px;
  }

  .heatmap-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .day-label {
    color: #555555;
    font-size: 10px;
    font-weight: 700;
    width: 28px;
    flex-shrink: 0;
    letter-spacing: 0.5px;
  }

  .cells-row {
    display: flex;
    gap: 3px;
    flex: 1;
  }

  .heat-cell {
    flex: 1;
    aspect-ratio: 1;
    min-width: 6px;
    max-width: 12px;
    border-radius: 1px;
    transition: transform 0.1s ease;
  }

  .heat-cell:hover {
    transform: scale(1.3);
    z-index: 2;
  }

  .hour-axis {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    min-width: 290px;
  }

  .axis-spacer {
    width: 28px;
    flex-shrink: 0;
  }

  .hour-labels {
    display: flex;
    justify-content: space-between;
    flex: 1;
    color: #555555;
    font-size: 9px;
    font-weight: 600;
  }

  .heat-legend {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 14px;
    padding-top: 10px;
    border-top: 1px solid #1f1f1f;
  }

  .legend-text {
    color: #555555;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1px;
  }

  .legend-squares {
    display: flex;
    gap: 3px;
  }

  .leg-cell {
    width: 8px;
    height: 8px;
    border-radius: 1px;
  }

  /* Taste Card */
  .taste-card {
    background: #111111;
    border: 2px solid #333333;
    border-radius: 8px;
    padding: 16px;
  }

  .taste-text {
    color: #ffffff;
    font-size: 14px;
    line-height: 1.6;
    margin: 0;
  }

  .taste-footer {
    color: #333333;
    font-size: 10px;
    font-weight: 600;
    text-align: right;
    margin-top: 10px;
    letter-spacing: 0.5px;
  }
</style>
