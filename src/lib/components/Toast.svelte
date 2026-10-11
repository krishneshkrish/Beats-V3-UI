<script lang="ts">
  import { toasts } from '$lib/stores/toast';
  import { fly } from 'svelte/transition';
</script>

<div class="toast-container" aria-live="polite">
  {#each $toasts as t (t.id)}
    <div
      class="toast"
      class:error={t.type === 'error'}
      class:success={t.type === 'success'}
      class:info={t.type === 'info'}
      in:fly={{ y: -30, duration: 250 }}
      out:fly={{ y: -30, duration: 200 }}
    >
      <span class="toast-icon">
        {#if t.type === 'error'}
          ✕
        {:else if t.type === 'success'}
          ✓
        {:else}
          ●
        {/if}
      </span>
      <span class="toast-message">{t.message}</span>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    pointer-events: none;
    width: calc(100% - 32px);
    max-width: 400px;
  }

  .toast {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 12px 20px;
    background: #111111;
    border: 2px solid #ffffff;
    border-radius: 8px;
    box-shadow: 3px 3px 0 #ffffff;
    color: #ffffff;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.5px;
    pointer-events: auto;
  }

  .toast.error {
    background: #e8192c;
    border-color: #ffffff;
  }

  .toast.success {
    background: #111111;
    border-color: #ffffff;
  }

  .toast-icon {
    font-weight: 700;
  }

  .toast-message {
    word-break: break-word;
  }
</style>
