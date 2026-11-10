<script>
  import { onDestroy } from 'svelte';
  import { flip } from 'svelte/animate';
  import { dateLabel } from './dates.js';
  import Icon from './Icon.svelte';

  let { board, projects, columns, showProjects, openTask, addTask, moveTask, busy } = $props();
  let dragged = $state(null);
  let target = $state('');
  let lastDrop = $state(null);
  let arrivalTimer;
  let preview;
  const laneIcons = { backlog: 'layers', in_progress: 'clock', done: 'check' };

  onDestroy(() => {
    preview?.remove();
    clearTimeout(arrivalTimer);
  });

  function start(event, task) {
    if (busy) {
      event.preventDefault();
      return;
    }
    const source = event.currentTarget;
    const rect = source.getBoundingClientRect();
    const style = getComputedStyle(source);
    preview = source.cloneNode(true);
    preview.classList.add('drag-preview');
    preview.setAttribute('aria-hidden', 'true');
    preview.tabIndex = -1;
    Object.assign(preview.style, {
      position: 'fixed', left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px',
    });
    for (const variable of ['--lane-border', '--lane-mark', '--lane-ink']) {
      preview.style.setProperty(variable, style.getPropertyValue(variable));
    }
    document.body.append(preview);
    event.dataTransfer.setDragImage(preview, event.clientX - rect.left, event.clientY - rect.top);
    setTimeout(() => { preview?.remove(); preview = null; }, 0);
    dragged = task;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(task.id));
  }

  function over(event, status) {
    if (dragged && !busy && dragged.status !== status) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      target = status;
    }
  }

  function leave(event, status) {
    if (target === status && !event.currentTarget.contains(event.relatedTarget)) target = '';
  }

  function drop(event, status) {
    event.preventDefault();
    const task = dragged;
    clearDrag();
    if (task && task.status !== status && !busy) {
      lastDrop = task.id;
      clearTimeout(arrivalTimer);
      arrivalTimer = setTimeout(() => lastDrop = null, 400);
      moveTask(task, status);
    }
  }

  function clearDrag() {
    dragged = null;
    target = '';
  }
</script>

<div class="board" style:--column-count={columns.length}>
  {#each columns as column, index (column.id)}
    {@const tasks = board[column.id] ?? []}
    <section class:drop-target={target === column.id} class="lane" data-color={column.color} aria-label={column.name}
      ondragover={(event) => over(event, column.id)} ondragleave={(event) => leave(event, column.id)}
      ondrop={(event) => drop(event, column.id)}>
      <header class="lane-heading">
        <span class="lane-icon"><Icon name={laneIcons[column.id] ?? 'board'} size={16} /></span>
        <h2>{column.name}</h2>
        <span class="lane-count">{tasks.length}</span>
        {#if index === 0}
          <button class="icon-button lane-add" aria-label="Добавить задачу" onclick={addTask}><Icon name="plus" size={17} /></button>
        {/if}
      </header>
      <div class="lane-cards">
        {#each tasks as task (task.id)}
          <button class:dragging={dragged?.id === task.id} class:drop-arrival={lastDrop === task.id} class="task-card"
            animate:flip={{ duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160 }}
            draggable={!busy} ondragstart={(event) => start(event, task)} ondragend={clearDrag}
            onclick={() => openTask(task)}>
            <span class="task-meta">
              <span class="task-id">#{task.id}</span>
              {#if showProjects}<span class="project-tag" data-tone={task.project_id % 4}>{projects.find((item) => item.id === task.project_id)?.name ?? 'Проект'}</span>{/if}
              <span class="task-grip"><Icon name="grip" size={15} /></span>
            </span>
            <span class="task-title">{task.title}</span>
            {#if task.description}<span class="task-description">{task.description}</span>{/if}
            {#if task.planned_date}<span class="task-planned-date"><Icon name="calendar" size={14} /> {dateLabel(task.planned_date)}</span>{/if}
            <span class="task-footer"><Icon name="clock" size={15} /> Время и детали <Icon name="arrow" size={13} /></span>
          </button>
        {/each}
        {#if target === column.id}
          <div class="drop-placeholder">Переместить сюда</div>
        {:else if tasks.length === 0}
          <div class="empty-lane">
            {#if index === 0}
              <button class="text-button" onclick={addTask}><Icon name="plus" size={16} /> Добавить задачу</button>
            {:else}
              Пока пусто
            {/if}
          </div>
        {/if}
      </div>
    </section>
  {/each}
</div>
