<script>
  import { request } from './api.js';
  import ConfirmDelete from './ConfirmDelete.svelte';
  import Icon from './Icon.svelte';
  import Modal from './Modal.svelte';

  let { columns, changed, close } = $props();
  let mode = $state('list');
  let selected = $state(null);
  let name = $state('');
  let color = $state('violet');
  let destination = $state('');
  let busy = $state(false);
  let error = $state('');
  const colors = [
    { id: 'violet', name: 'Лавандовый' },
    { id: 'amber', name: 'Персиковый' },
    { id: 'mint', name: 'Мятный' },
    { id: 'blue', name: 'Голубой' },
    { id: 'rose', name: 'Розовый' },
  ];

  const title = $derived({
    list: 'Колонки доски',
    new: 'Новая колонка',
    edit: 'Редактировать колонку',
    delete: 'Удалить колонку',
  }[mode]);

  function show(nextMode, column = null) {
    error = '';
    selected = column;
    name = column?.name ?? '';
    color = column?.color ?? 'violet';
    destination = columns.find((item) => item.id !== column?.id)?.id ?? '';
    mode = nextMode;
  }

  function back() {
    show('list');
  }

  function closeDialog() {
    if (mode === 'list') close();
    else back();
  }

  async function save(event) {
    event.preventDefault();
    if (!name.trim()) {
      error = 'Введите название колонки.';
      return;
    }
    busy = true;
    error = '';
    try {
      const body = { name: name.trim(), color };
      if (mode === 'new') {
        const column = await request('/columns', { method: 'POST', body });
        changed([...columns, column]);
      } else {
        const id = selected.id;
        await request('/columns/' + id, { method: 'PUT', body });
        changed(columns.map((column) => column.id === id ? { id, ...body } : column));
      }
      back();
    } catch (err) {
      error = err.message;
    } finally {
      busy = false;
    }
  }

  async function reorder(index, offset) {
    busy = true;
    error = '';
    const next = [...columns];
    const [column] = next.splice(index, 1);
    next.splice(index + offset, 0, column);
    try {
      await request('/columns/order', { method: 'PUT', body: { ids: next.map((item) => item.id) } });
      changed(next);
    } catch (err) {
      error = err.message;
    } finally {
      busy = false;
    }
  }

  async function remove() {
    if (!destination) return;
    busy = true;
    error = '';
    try {
      const params = new URLSearchParams({ move_to: destination });
      await request('/columns/' + selected.id + '?' + params, { method: 'DELETE' });
      changed(columns.filter((column) => column.id !== selected.id));
      back();
    } catch (err) {
      error = err.message;
    } finally {
      busy = false;
    }
  }
</script>

<Modal {title} close={closeDialog} locked={busy}>
  {#if mode === 'list'}
    <p class="settings-description">Колонки общие для проектов и спринтов. Новые задачи попадают в первую колонку.</p>
    <ol class="column-list">
      {#each columns as column, index (column.id)}
        <li>
          <span class="column-swatch" data-color={column.color}></span>
          <span class="column-name">{column.name}</span>
          <div class="column-actions">
            <button class="icon-button" aria-label={`Поднять «${column.name}»`} title="Поднять"
              disabled={busy || index === 0} onclick={() => reorder(index, -1)}><Icon name="up" size={16} /></button>
            <button class="icon-button" aria-label={`Опустить «${column.name}»`} title="Опустить"
              disabled={busy || index === columns.length - 1} onclick={() => reorder(index, 1)}><Icon name="down" size={16} /></button>
            <button class="icon-button" aria-label={`Редактировать «${column.name}»`} title="Редактировать"
              disabled={busy} onclick={() => show('edit', column)}><Icon name="edit" size={16} /></button>
            <button class="icon-button danger" aria-label={`Удалить «${column.name}»`} title="Удалить"
              disabled={busy || columns.length < 2} onclick={() => show('delete', column)}><Icon name="trash" size={16} /></button>
          </div>
        </li>
      {/each}
    </ol>
    {#if error}<p class="alert" role="alert">{error}</p>{/if}
    <button class="button primary" disabled={busy} onclick={() => show('new')}><Icon name="plus" size={17} /> Добавить колонку</button>
  {:else if mode === 'delete'}
    <label class="column-destination">Перенести задачи в
      <select bind:value={destination} disabled={busy}>
        {#each columns.filter((column) => column.id !== selected.id) as column (column.id)}
          <option value={column.id}>{column.name}</option>
        {/each}
      </select>
    </label>
    <ConfirmDelete description={`Колонка «${selected.name}» будет удалена со всех досок. Её задачи и записи времени сохранятся.`}
      confirm={remove} cancel={back} {busy} {error} />
  {:else}
    <form class="create-form" onsubmit={save}>
      <label>Название <input bind:value={name} maxlength="60" required disabled={busy} /></label>
      <label>Цвет
        <select bind:value={color} disabled={busy}>
          {#each colors as option (option.id)}<option value={option.id}>{option.name}</option>{/each}
        </select>
      </label>
      {#if error}<p class="alert" role="alert">{error}</p>{/if}
      <div class="form-actions">
        <button type="button" class="button secondary" onclick={back} disabled={busy}>Отмена</button>
        <button class="button primary" disabled={busy}>Сохранить</button>
      </div>
    </form>
  {/if}
</Modal>
