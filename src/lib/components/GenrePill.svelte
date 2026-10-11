<script lang="ts">
  export let genre: string = '';
  export let label: string = '';
  export let active: boolean = false;
  export let onClick: () => void = () => {};
</script>

<button
  type="button"
  class="genre-pill"
  class:active
  on:click={onClick}
  aria-pressed={active}
  data-genre={genre}
>
  {label}
</button>

<style>
  .genre-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 16px;
    border-radius: 4px;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1px;
    white-space: nowrap;
    cursor: pointer;
    background: #0a0a0a;
    color: #ffffff;
    border: 2px solid #ffffff;
    box-shadow: 3px 3px 0 #ffffff;
    transition: transform 0.08s ease, box-shadow 0.08s ease;
    user-select: none;
  }

  .genre-pill.active {
    background: #e8192c;
    color: #ffffff;
    border: 2px solid #e8192c;
    box-shadow: 3px 3px 0 #ffffff;
  }

  .genre-pill:active {
    transform: translate(3px, 3px);
    box-shadow: none;
  }
</style>
