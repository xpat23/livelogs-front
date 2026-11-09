<script>
  import Icon from './Icon.svelte';

  let { board, projects, columns, showProjects, openTask, addTask, moveTask, busy } = $props();
  let dragged = $state(null);
  let target = $state('');
  const laneIcons = { backlog: 'layers', in_progress: 'clock', done: 'check' };

  function start(event, task) {
    dragged = task;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(task.id));
  }

  function over(event, status) {
    if (dragged && !busy) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      target = status;
    }
  }

  function drop(event, status) {
    event.preventDefault();
    const task = dragged;
    clearDrag();
    if (task && task.status !== status && !busy) moveTask(task, status);
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
      ondragover={(event) => over(event, column.id)} ondrop={(event) => drop(event, column.id)}>
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
          <button class:dragging={dragged?.id === task.id} class="task-card"
            draggable={!busy} ondragstart={(event) => start(event, task)} ondragend={clearDrag}
            onclick={() => openTask(task)}>
            <span class="task-meta">
              <span class="task-id">#{task.id}</span>
              {#if showProjects}<span class="project-tag" data-tone={task.project_id % 4}>{projects.find((item) => item.id === task.project_id)?.name ?? 'Проект'}</span>{/if}
            </span>
            <span class="task-title">{task.title}</span>
            {#if task.description}<span class="task-description">{task.description}</span>{/if}
            <span class="task-footer"><Icon name="clock" size={15} /> Время и детали <Icon name="arrow" size={13} /></span>
          </button>
        {:else}
          <div class="empty-lane">
            {#if index === 0}
              <button class="text-button" onclick={addTask}><Icon name="plus" size={16} /> Добавить задачу</button>
            {:else}
              Пока пусто
            {/if}
          </div>
        {/each}
      </div>
    </section>
  {/each}
</div>
