<script>
  import { onMount } from 'svelte';
  import { request } from './api.js';
  import { dateLabel, duration, localDateTime, logLabel } from './dates.js';
  import ConfirmDelete from './ConfirmDelete.svelte';
  import Icon from './Icon.svelte';
  import Modal from './Modal.svelte';

  let { task, project, sprints, columns, close, changed, deleted } = $props();
  let entries = $state(null);
  let busy = $state(false);
  let error = $state('');
  let logError = $state('');
  let mode = $state('detail');
  let activeEntry = $state(null);
  let taskDraft = $state({ title: '', description: '', plannedDate: '' });
  let timeDraft = $state({ started: localDateTime(), minutes: undefined, note: '' });
  let entryDraft = $state({ started: '', minutes: undefined, note: '' });
  const controller = new AbortController();
  const path = $derived(`/tasks/${task.id}`);
  const title = $derived({
    detail: task.title,
    'edit-task': 'Редактировать задачу',
    'delete-task': 'Удалить задачу',
    'edit-entry': 'Редактировать запись времени',
    'delete-entry': 'Удалить запись времени',
  }[mode]);

  onMount(() => {
    loadEntries();
    return () => controller.abort();
  });

  async function loadEntries() {
    logError = '';
    try {
      entries = await request(path + '/time-entries', { signal: controller.signal });
    } catch (err) {
      if (!controller.signal.aborted) logError = err.message;
    }
  }

  function show(nextMode, entry = null) {
    error = '';
    activeEntry = entry;
    mode = nextMode;
    if (nextMode === 'edit-task') {
      taskDraft = { title: task.title, description: task.description, plannedDate: task.planned_date ?? '' };
    }
    if (nextMode === 'edit-entry') {
      entryDraft = { started: localDateTime(new Date(entry.started_at)), minutes: entry.minutes, note: entry.note };
    }
  }

  function back() {
    show('detail');
  }

  function closeDialog() {
    if (mode === 'detail') close();
    else back();
  }

  async function update(event, field) {
    const control = event.currentTarget;
    const value = control.value;
    error = '';
    busy = true;
    const body = field === 'status' ? { status: value } : { sprint_id: value ? Number(value) : null };
    try {
      await request(path + '/' + field, { method: 'PUT', body });
      changed({ ...task, ...body });
    } catch (err) {
      control.value = field === 'status' ? task.status : (task.sprint_id ?? '');
      error = err.message;
    } finally {
      busy = false;
    }
  }

  async function saveTask(event) {
    event.preventDefault();
    const title = taskDraft.title.trim();
    if (!title) {
      error = 'Введите название.';
      return;
    }
    error = '';
    busy = true;
    try {
      const body = { title, description: taskDraft.description, planned_date: taskDraft.plannedDate || null };
      await request(path, { method: 'PUT', body });
      changed({ ...task, ...body });
      back();
    } catch (err) {
      error = err.message;
    } finally {
      busy = false;
    }
  }

  async function saveTime(event, draft, entry = null) {
    event.preventDefault();
    error = '';
    busy = true;
    try {
      const originalStart = entry && localDateTime(new Date(entry.started_at));
      const started_at = draft.started === originalStart ? entry.started_at : new Date(draft.started).toISOString();
      await request(path + '/time-entries' + (entry ? '/' + entry.id : ''), {
        method: entry ? 'PUT' : 'POST',
        body: { started_at, minutes: draft.minutes, note: draft.note },
      });
      if (entry) back();
      else timeDraft = { started: draft.started, minutes: undefined, note: '' };
      await loadEntries();
    } catch (err) {
      error = err.message;
    } finally {
      busy = false;
    }
  }

  async function remove() {
    error = '';
    busy = true;
    try {
      if (mode === 'delete-task') {
        await request(path, { method: 'DELETE' });
        deleted();
      } else {
        await request(path + '/time-entries/' + activeEntry.id, { method: 'DELETE' });
        back();
        await loadEntries();
      }
    } catch (err) {
      error = err.message;
    } finally {
      busy = false;
    }
  }
</script>

{#snippet timeFields(draft)}
  <div class="field-row">
    <label>Начало <input type="datetime-local" bind:value={draft.started} required disabled={busy} /></label>
    <label>Минуты <input type="number" min="1" step="1" placeholder="30" bind:value={draft.minutes} required disabled={busy} /></label>
  </div>
  <label>Заметка <input placeholder="Что удалось сделать" bind:value={draft.note} disabled={busy} /></label>
{/snippet}

<Modal {title} subtitle={`#${task.id} · ${project?.name ?? 'Проект'}`} close={closeDialog} locked={busy}>
  {#if mode === 'edit-task'}
    <form class="create-form" onsubmit={saveTask}>
      <label>Название <input bind:value={taskDraft.title} required disabled={busy} /></label>
      <label>Плановая дата <input type="date" bind:value={taskDraft.plannedDate} disabled={busy} /></label>
      <label>Описание <textarea bind:value={taskDraft.description} rows="3" disabled={busy}></textarea></label>
      {#if error}<p class="alert" role="alert">{error}</p>{/if}
      <div class="form-actions">
        <button type="button" class="button secondary" onclick={back} disabled={busy}>Отмена</button>
        <button class="button primary" disabled={busy}>Сохранить</button>
      </div>
    </form>
  {:else if mode === 'edit-entry'}
    <form class="create-form" onsubmit={(event) => saveTime(event, entryDraft, activeEntry)}>
      {@render timeFields(entryDraft)}
      {#if error}<p class="alert" role="alert">{error}</p>{/if}
      <div class="form-actions">
        <button type="button" class="button secondary" onclick={back} disabled={busy}>Отмена</button>
        <button class="button primary" disabled={busy}>Сохранить</button>
      </div>
    </form>
  {:else if mode === 'delete-task' || mode === 'delete-entry'}
    <ConfirmDelete description={mode === 'delete-task'
      ? `Задача «${task.title}» и все её записи времени будут удалены.`
      : `Запись за ${logLabel(activeEntry.started_at)} на ${duration(activeEntry.minutes)} будет удалена из задачи и отчёта.`}
      confirm={remove} cancel={back} {busy} {error} />
  {:else}
    <div class="detail-actions">
      <button class="text-button" disabled={busy} onclick={() => show('edit-task')}>
        <Icon name="edit" size={16} /> Редактировать задачу
      </button>
      <button class="text-button danger" disabled={busy} onclick={() => show('delete-task')}>
        <Icon name="trash" size={16} /> Удалить задачу
      </button>
    </div>
    {#if task.planned_date}<p class="task-planned-date"><Icon name="calendar" size={15} /> {dateLabel(task.planned_date)}</p>{/if}
    {#if task.description}<p class="detail-description">{task.description}</p>{/if}
    {#if error}<p class="alert" role="alert">{error}</p>{/if}
    <div class="field-row">
      <label>Статус
        <select value={task.status} onchange={(event) => update(event, 'status')} disabled={busy}>
          {#each columns as column (column.id)}<option value={column.id}>{column.name}</option>{/each}
        </select>
      </label>
      <label>Спринт
        <select value={task.sprint_id ?? ''} onchange={(event) => update(event, 'sprint')} disabled={busy}>
          <option value="">Без спринта</option>
          {#each sprints as sprint (sprint.id)}<option value={sprint.id}>{sprint.name}</option>{/each}
        </select>
      </label>
    </div>

    <section class="time-section">
      <header>
        <h3><Icon name="clock" size={19} /> Учёт времени</h3>
        {#if entries}<strong>{duration(entries.reduce((sum, entry) => sum + entry.minutes, 0))}</strong>{/if}
      </header>
      {#if logError}
        <p class="alert" role="alert">{logError} <button class="text-button" onclick={loadEntries}>Повторить</button></p>
      {:else if entries === null}
        <p class="muted" role="status">Загружаем записи…</p>
      {:else}
        <div class="entries">
          {#each entries as entry (entry.id)}
            <div class="entry">
              <div><strong>{duration(entry.minutes)}</strong> <span>{logLabel(entry.started_at)}</span>
                {#if entry.note}<p>{entry.note}</p>{/if}
              </div>
              <div class="entry-actions">
                <button class="icon-button" aria-label="Редактировать запись" title="Редактировать запись"
                  disabled={busy} onclick={() => show('edit-entry', entry)}><Icon name="edit" size={16} /></button>
                <button class="icon-button danger" aria-label="Удалить запись" title="Удалить запись"
                  disabled={busy} onclick={() => show('delete-entry', entry)}><Icon name="trash" size={16} /></button>
              </div>
            </div>
          {:else}
            <p class="muted">У задачи ещё нет записей.</p>
          {/each}
        </div>
      {/if}

      <form class="time-form" onsubmit={(event) => saveTime(event, timeDraft)}>
        {@render timeFields(timeDraft)}
        <button class="button primary" disabled={busy}><Icon name="plus" size={17} /> Записать время</button>
      </form>
    </section>
  {/if}
</Modal>
