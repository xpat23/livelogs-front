<script>
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';

  let { title, subtitle = '', close, locked = false, children } = $props();
  let dialog;

  onMount(() => dialog.showModal());

  function cancel(event) {
    event.preventDefault();
    if (!locked) close();
  }
</script>

<dialog bind:this={dialog} oncancel={cancel} aria-labelledby="modal-title">
  <header class="modal-heading">
    <div>
      {#if subtitle}<div class="eyebrow">{subtitle}</div>{/if}
      <h2 id="modal-title">{title}</h2>
    </div>
    <button type="button" class="icon-button close-button" aria-label="Закрыть" onclick={close} disabled={locked}>
      <Icon name="close" />
    </button>
  </header>
  {@render children()}
</dialog>
