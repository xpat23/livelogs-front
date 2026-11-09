<script>
  import { onMount } from 'svelte';
  import { request } from './api.js';
  import { duration, localDate, localDay } from './dates.js';
  import Icon from './Icon.svelte';

  const today = new Date();
  let start = $state(localDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  let end = $state(localDate(today));
  let totals = $state(null);
  let busy = $state(false);
  let error = $state('');
  const controller = new AbortController();

  let minutes = $derived(totals?.reduce((sum, item) => sum + item.minutes, 0) ?? 0);
  let max = $derived(Math.max(1, ...(totals?.map((item) => item.minutes) ?? [])));

  onMount(() => {
    load();
    return () => controller.abort();
  });

  async function load(event) {
    event?.preventDefault();
    error = '';
    busy = true;
    try {
      const until = localDay(end);
      until.setDate(until.getDate() + 1);
      const params = new URLSearchParams({ from: localDay(start).toISOString(), to: until.toISOString() });
      totals = await request('/reports/time-by-project?' + params, { signal: controller.signal });
    } catch (err) {
      if (!controller.signal.aborted) error = err.message;
    } finally {
      busy = false;
    }
  }
</script>

<form class="report-filter" onsubmit={load}>
  <label>С даты <input required type="date" bind:value={start} max={end} disabled={busy} /></label>
  <label>По дату <input required type="date" bind:value={end} min={start} disabled={busy} /></label>
  <button class="button primary" disabled={busy}>{busy ? 'Загрузка…' : 'Показать'}</button>
</form>

{#if error}<p class="alert" role="alert">{error}</p>{/if}
{#if totals}
  <div class="report-totals">
    <div class="metric"><span><Icon name="clock" size={17} /> Записанное время</span><strong>{duration(minutes)}</strong></div>
    <div class="metric"><span><Icon name="folder" size={17} /> Проекты с записями</span><strong>{totals.length}</strong></div>
  </div>
  <section class="report-panel" aria-label="Время по проектам">
    <h2>Время по проектам</h2>
    {#each totals as item (item.project_id)}
      <div class="report-row" data-tone={item.project_id % 4}>
        <span>{item.project_name}</span>
        <div class="bar-track" aria-hidden="true"><div class="bar-fill" style:width={`${100 * item.minutes / max}%`}></div></div>
        <strong>{duration(item.minutes)}</strong>
      </div>
    {:else}
      <p class="muted">За выбранный период записей нет.</p>
    {/each}
  </section>
{/if}
