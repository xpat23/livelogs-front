<script>
  let { description, confirm, cancel, busy, error } = $props();
  let confirmation = $state('');

  function submit(event) {
    event.preventDefault();
    if (!busy && confirmation === 'удалить') confirm();
  }
</script>

<form class="create-form" onsubmit={submit}>
  <p class="delete-description">{description}</p>
  <label><span>Для подтверждения введите <strong>удалить</strong></span>
    <input bind:value={confirmation} autocomplete="off" spellcheck="false" disabled={busy} />
  </label>
  {#if error}<p class="alert" role="alert">{error}</p>{/if}
  <div class="form-actions">
    <button type="button" class="button secondary" onclick={cancel} disabled={busy}>Отмена</button>
    <button class="button destructive" disabled={busy || confirmation !== 'удалить'}>
      {busy ? 'Удаляем…' : 'Удалить'}
    </button>
  </div>
</form>
