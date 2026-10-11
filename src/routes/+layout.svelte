<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import Toast from '$lib/components/Toast.svelte';
  import MiniPlayer from '$lib/components/MiniPlayer.svelte';
  import BoomboxPlayer from '$lib/components/BoomboxPlayer.svelte';

  $: pathname = $page.url.pathname;
  $: isHome = pathname === '/';
  $: isSearch = pathname.startsWith('/search');
  $: isStats = pathname.startsWith('/stats');
</script>

<svelte:head>
  <title>Beats — Music for Everyone</title>
</svelte:head>

<div class="app-root">
  <!-- Toast notifications -->
  <Toast />

  <!-- Main view slot -->
  <main class="page-content">
    <slot />
  </main>

  <!-- Persistent Mini Player -->
  <MiniPlayer />

  <!-- Fullscreen Boombox Player Overlay -->
  <BoomboxPlayer />

  <!-- Bottom Navigation Tab Bar -->
  <nav class="bottom-tab-bar" aria-label="Main Navigation">
    <!-- Home Tab -->
    <a href="/" class="tab-item" class:active={isHome} aria-current={isHome ? 'page' : undefined}>
      <svg class="tab-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
      <span class="tab-label">HOME</span>
      {#if isHome}
        <span class="active-dot"></span>
      {/if}
    </a>

    <!-- Search Tab -->
    <a href="/search" class="tab-item" class:active={isSearch} aria-current={isSearch ? 'page' : undefined}>
      <svg class="tab-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <span class="tab-label">SEARCH</span>
      {#if isSearch}
        <span class="active-dot"></span>
      {/if}
    </a>

    <!-- Stats Tab -->
    <a href="/stats" class="tab-item" class:active={isStats} aria-current={isStats ? 'page' : undefined}>
      <svg class="tab-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
      <span class="tab-label">STATS</span>
      {#if isStats}
        <span class="active-dot"></span>
      {/if}
    </a>
  </nav>
</div>

<style>
  .app-root {
    min-height: 100vh;
    min-height: 100dvh;
    background: #0a0a0a;
    color: #ffffff;
    display: flex;
    flex-direction: column;
  }

  .page-content {
    flex: 1;
    width: 100%;
    position: relative;
  }

  .bottom-tab-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 64px;
    background: #0a0a0a;
    border-top: 2px solid #ffffff;
    display: flex;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    z-index: 50;
    box-sizing: border-box;
  }

  .tab-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    color: #555555;
    text-decoration: none;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1px;
    position: relative;
    user-select: none;
    transition: color 0.1s ease;
  }

  .tab-item.active {
    color: #ffffff;
  }

  .tab-icon {
    display: block;
    stroke: currentColor;
  }

  .tab-label {
    line-height: 1;
  }

  .active-dot {
    position: absolute;
    bottom: 4px;
    width: 3px;
    height: 3px;
    background: #e8192c;
    border-radius: 50%;
  }
</style>
