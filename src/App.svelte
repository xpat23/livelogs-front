<script>
  import { onMount } from 'svelte';
  import { request } from './api.js';
  import { dateLabel, localDate } from './dates.js';
  import Board from './Board.svelte';
  import ColumnSettings from './ColumnSettings.svelte';
  import ConfirmDelete from './ConfirmDelete.svelte';
  import Icon from './Icon.svelte';
  import Modal from './Modal.svelte';
  import Report from './Report.svelte';
  import TaskDetail from './TaskDetail.svelte';

  let projects = $state([]);
  let columns = $state([]);
  let configuring = $state(false);
  let menuOpen = $state(false);
  let sprints = $state([]);
  let view = $state({ type: 'home' });
  let board = $state(null);
  let boardError = $state('');
  let revision = $state(0);
  let loading = $state(true);
  let workspaceError = $state('');
  let notice = $state('');
  let dialog = $state(null);
  let selected = $state(null);
  let saving = $state(false);
  let formError = $state('');
  let name = $state('');
  let description = $state('');
  let projectID = $state(undefined);
  let start = $state('');
  let end = $state('');
  let plannedDate = $state('');
  let todayDate = $state('');
  let nextDayAt = $state('');

  const activeProject = $derived(view.type === 'projects' ? projects.find((item) => item.id === view.id) : null);
  const activeSprint = $derived(view.type === 'sprints' ? sprints.find((item) => item.id === view.id) : null);
  const title = $derived(activeProject?.name ?? activeSprint?.name ?? (view.type === 'today' ? 'Сегодня' : view.type === 'report' ? 'Отчёт по времени' : 'Личное пространство'));
  const sprintForm = $derived(dialog === 'sprint' || dialog === 'edit-sprint');
  const editing = $derived(dialog?.startsWith('edit-'));
  const deleting = $derived(dialog?.startsWith('delete-'));
  const dialogTitle = $derived({
    project: 'Новый проект',
    sprint: 'Новый спринт',
    task: 'Новая задача',
    'edit-project': 'Редактировать проект',
    'edit-sprint': 'Редактировать спринт',
    'delete-project': 'Удалить проект',
    'delete-sprint': 'Удалить спринт',
  }[dialog]);
  const taskCount = $derived(board ? Object.values(board).reduce((total, tasks) => total + tasks.length, 0) : 0);

  onMount(() => { loadWorkspace(); });

  async function loadWorkspace() {
    loading = true;
    workspaceError = '';
    try {
      [projects, sprints, columns] = await Promise.all([request('/projects'), request('/sprints'), request('/columns')]);
      if (view.type === 'home') openDefault();
    } catch (err) {
      workspaceError = err.message;
    } finally {
      loading = false;
    }
  }

  function openDefault() {
    if (sprints.length) navigate('sprints', sprints[0].id);
    else if (projects.length) navigate('projects', projects[0].id);
    else navigate('home');
  }

  function navigate(type, id) {
    menuOpen = false;
    if (view.type === type && view.id === id) return;
    notice = '';
    board = null;
    view = { type, id };
  }

  $effect(() => {
    const { type, id } = view;
    const currentRevision = revision;
    if (!id && type !== 'today') return;

    const controller = new AbortController();
    boardError = '';
    request(type === 'today' ? '/boards/today' : `/${type}/${id}/board`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted && revision === currentRevision) {
          if (type === 'today') {
            todayDate = data.date;
            nextDayAt = data.next_day_at;
            board = data.board;
          } else board = data;
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) boardError = err.message;
      });
    return () => controller.abort();
  });

  $effect(() => {
    if (view.type !== 'today' || !nextDayAt) return;
    const timer = setTimeout(() => revision++, Math.max(1000, Date.parse(nextDayAt) - Date.now() + 100));
    return () => clearTimeout(timer);
  });

  function refreshToday() {
    if (view.type === 'today') revision++;
  }

  function openDialog(mode) {
    menuOpen = false;
    formError = '';
    const sprint = mode === 'edit-sprint' ? activeSprint : null;
    const project = mode === 'edit-project' ? activeProject : null;
    name = sprint?.name ?? project?.name ?? '';
    description = '';
    plannedDate = view.type === 'today' ? todayDate : '';
    projectID = activeProject?.id ?? projects[0]?.id;
    start = sprint?.start_date ?? localDate();
    end = sprint?.end_date ?? start;
    dialog = mode === 'task' && !projects.length ? 'project' : mode;
  }

  async function save(event) {
    event.preventDefault();
    if (!name.trim()) {
      formError = 'Введите название.';
      return;
    }
    saving = true;
    formError = '';
    notice = '';
    try {
      if (dialog === 'project') {
        const project = await request('/projects', { method: 'POST', body: { name } });
        projects = [...projects, project];
        navigate('projects', project.id);
      } else if (dialog === 'edit-project') {
        const id = activeProject.id;
        await request(`/projects/${id}`, { method: 'PUT', body: { name } });
        projects = projects.map((project) => project.id === id ? { ...project, name: name.trim() } : project);
      } else if (sprintForm) {
        const body = { name: name.trim(), start_date: start, end_date: end };
        if (editing) {
          const id = activeSprint.id;
          await request(`/sprints/${id}`, { method: 'PUT', body });
          sprints = sprints.map((sprint) => sprint.id === id ? { id, ...body } : sprint);
        } else {
          const sprint = await request('/sprints', { method: 'POST', body });
          sprints = [sprint, ...sprints];
          navigate('sprints', sprint.id);
        }
        sprints = [...sprints].sort((a, b) => b.start_date.localeCompare(a.start_date) || b.id - a.id);
      } else {
        let task = await request(`/projects/${projectID}/tasks`, {
          method: 'POST', body: { title: name, description, planned_date: plannedDate || null },
        });
        if (activeSprint && task.sprint_id == null) {
          const sprint_id = activeSprint.id;
          try {
            await request(`/tasks/${task.id}/sprint`, { method: 'PUT', body: { sprint_id } });
            task = { ...task, sprint_id };
          } catch {
            notice = 'Задача создана в проекте. Выберите спринт в карточке задачи, чтобы добавить её на эту доску.';
            selected = task;
          }
        } else if (activeSprint && task.sprint_id !== activeSprint.id) {
          const sprint = sprints.find((item) => item.id === task.sprint_id);
          notice = `Задача создана в спринте «${sprint?.name ?? task.sprint_id}», выбранном по плановой дате.`;
          selected = task;
        }
        revision++;
      }
      dialog = null;
    } catch (err) {
      formError = err.message;
    } finally {
      saving = false;
    }
  }

  async function removeEntity() {
    saving = true;
    formError = '';
    const { type, id } = view;
    try {
      await request(`/${type}/${id}`, { method: 'DELETE' });
      if (type === 'projects') projects = projects.filter((project) => project.id !== id);
      else sprints = sprints.filter((sprint) => sprint.id !== id);
      dialog = null;
      openDefault();
    } catch (err) {
      formError = err.message;
    } finally {
      saving = false;
    }
  }

  function columnsChanged(nextColumns) {
    columns = nextColumns;
    revision++;
  }

  function taskDeleted() {
    selected = null;
    revision++;
  }

  function taskChanged(task) {
    selected = task;
    revision++;
  }

  async function moveTask(task, status) {
    saving = true;
    notice = '';
    const previousBoard = board;
    const previousView = view;
    board = Object.fromEntries(Object.entries(board).map(([column, tasks]) => [
      column,
      column === status
        ? [...tasks, { ...task, status }]
        : tasks.filter((item) => item.id !== task.id),
    ]));
    try {
      await request(`/tasks/${task.id}/status`, { method: 'PUT', body: { status } });
      revision++;
    } catch (err) {
      if (view === previousView) board = previousBoard;
      notice = err.message;
    } finally {
      saving = false;
    }
  }
</script>

<svelte:window onfocus={refreshToday} onkeydown={(event) => { if (event.key === 'Escape') menuOpen = false; }} />

<div class="workspace" class:menu-open={menuOpen}>
  <aside class="sidebar">
    <div class="sidebar-header">
      <button type="button" class="brand" onclick={openDefault} aria-label="Фокус — открыть доску">
        <img src="/focus.svg" alt="" width="42" height="42" />
        <span><strong>Фокус</strong><small>Личное пространство</small></span>
      </button>
      <button type="button" class="icon-button mobile-menu" aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
        aria-expanded={menuOpen} aria-controls="workspace-navigation" onclick={() => menuOpen = !menuOpen}>
        <Icon name={menuOpen ? 'close' : 'menu'} size={21} />
      </button>
    </div>

    <div id="workspace-navigation" class:menu-open={menuOpen} class="sidebar-navigation">
      <nav aria-label="Рабочее пространство">
        <button class:active={view.type === 'today'} class="nav-item" onclick={() => navigate('today')}
          aria-current={view.type === 'today' ? 'page' : undefined}>
          <Icon name="calendar" /> Сегодня
        </button>
        <button class:active={view.type !== 'report' && view.type !== 'today'} class="nav-item" onclick={openDefault}>
          <Icon name="board" /> Доски
        </button>
        <button class:active={view.type === 'report'} class="nav-item" onclick={() => navigate('report')}
          aria-current={view.type === 'report' ? 'page' : undefined}>
          <Icon name="report" /> Отчёт по времени
        </button>
      </nav>

      <div class="sidebar-group">
        <div class="sidebar-heading">
          <h2>Спринты</h2>
          <button class="icon-button" aria-label="Создать спринт" onclick={() => openDialog('sprint')}><Icon name="plus" size={17} /></button>
        </div>
        {#each sprints as sprint (sprint.id)}
          <button class:active={activeSprint?.id === sprint.id} class="nav-item" onclick={() => navigate('sprints', sprint.id)}
            aria-current={activeSprint?.id === sprint.id ? 'page' : undefined}>
            <Icon name="calendar" size={16} /><span>{sprint.name}</span>
          </button>
        {:else}
          <button class="nav-add" onclick={() => openDialog('sprint')}><Icon name="plus" size={15} /> Новый спринт</button>
        {/each}
      </div>

      <div class="sidebar-group">
        <div class="sidebar-heading">
          <h2>Проекты</h2>
          <button class="icon-button" aria-label="Создать проект" onclick={() => openDialog('project')}><Icon name="plus" size={17} /></button>
        </div>
        {#each projects as project (project.id)}
          <button class:active={activeProject?.id === project.id} class="nav-item" onclick={() => navigate('projects', project.id)}
            aria-current={activeProject?.id === project.id ? 'page' : undefined}>
            <span class="project-dot" data-tone={project.id % 4}></span>
            <span>{project.name}</span>
          </button>
        {:else}
          <button class="nav-add" onclick={() => openDialog('project')}><Icon name="plus" size={15} /> Новый проект</button>
        {/each}
      </div>

    </div>

    <div class="sidebar-foot"><span class="avatar">Я</span><strong>Моё пространство</strong></div>
  </aside>

  <main>
    <div class="topline">
      <span>Рабочее пространство</span><Icon name="arrow" size={13} />
      <strong>{view.type === 'report' ? 'Отчёты' : 'Доски'}</strong>
    </div>

    <header class="page-heading">
      <div>
        <p class="eyebrow"><span></span>{activeSprint ? 'Спринт' : activeProject ? 'Доска проекта' : view.type === 'report' ? 'Отчёты' : 'Планирование'}</p>
        <h1>{title}</h1>
        {#if view.type === 'today'}
          <p class="page-description"><Icon name="calendar" size={16} /> {todayDate ? dateLabel(todayDate) : 'Загружаем дату…'} <span>·</span> Все проекты</p>
        {:else if activeSprint}
          <p class="page-description"><Icon name="calendar" size={16} /> {dateLabel(activeSprint.start_date)} — {dateLabel(activeSprint.end_date)} <span>·</span> Все проекты</p>
        {:else if activeProject}
          <p class="page-description">Задачи проекта по статусам</p>
        {:else if view.type === 'report'}
          <p class="page-description">Сколько времени ушло на каждый проект за выбранный период.</p>
        {:else}
          <p class="page-description">Проекты, спринты и время в одном месте.</p>
        {/if}
      </div>
      {#if view.type !== 'report' && !loading && !workspaceError}
        <button class="button primary" onclick={() => openDialog(projects.length ? 'task' : 'project')} disabled={saving || (view.type === 'today' && !todayDate)}>
          <Icon name="plus" /> {projects.length ? 'Новая задача' : 'Новый проект'}
        </button>
      {/if}
    </header>

    {#if notice}<p class="alert" role="alert">{notice}</p>{/if}

    {#if loading}
      <p class="loading" role="status">Загружаем рабочее пространство…</p>
    {:else if workspaceError}
      <p class="alert" role="alert">{workspaceError} <button class="text-button" onclick={loadWorkspace}>Повторить</button></p>
    {:else if view.type === 'report'}
      <Report />
    {:else if view.type === 'home'}
      <section class="welcome">
        <div class="welcome-mark"><Icon name="layers" size={28} /></div>
        <h2>Начните с проекта</h2>
        <p>Создайте проект для личных дел или работы. Добавьте задачи, а когда будете готовы планировать неделю, соберите их в спринт.</p>
        <button class="button primary" onclick={() => openDialog('project')}><Icon name="plus" size={18} /> Создать первый проект</button>
      </section>
    {:else}
      <div class="board-toolbar">
        <span><Icon name="board" size={16} /> Канбан</span>
        <div class="board-tools">
          {#if board}<span class="board-count">Задач: {taskCount}</span>{/if}
          <button class="column-settings-button" aria-label="Настроить колонки" title="Настроить колонки"
            disabled={saving} onclick={() => configuring = true}>
            <Icon name="board" size={16} /> <span>Колонки</span>
          </button>
          {#if activeProject || activeSprint}
            {@const kind = activeProject ? 'проект' : 'спринт'}
            {@const entity = activeProject ? 'project' : 'sprint'}
            <button class="icon-button" aria-label={`Редактировать ${kind}`} title={`Редактировать ${kind}`}
              disabled={saving} onclick={() => openDialog(`edit-${entity}`)}><Icon name="edit" size={16} /></button>
            <button class="icon-button danger" aria-label={`Удалить ${kind}`} title={`Удалить ${kind}`}
              disabled={saving} onclick={() => openDialog(`delete-${entity}`)}><Icon name="trash" size={16} /></button>
          {/if}
        </div>
      </div>
      {#if boardError}
        <p class="alert" role="alert">{boardError} <button class="text-button" onclick={() => revision++}>Повторить</button></p>
      {:else if board}
        <Board {board} {projects} {columns} showProjects={view.type === 'sprints' || view.type === 'today'} openTask={(task) => selected = task}
          addTask={() => openDialog('task')} {moveTask} busy={saving} />
      {:else}
        <p class="loading" role="status">Загружаем доску…</p>
      {/if}
    {/if}
  </main>
</div>

{#if configuring}
  <ColumnSettings {columns} changed={columnsChanged} close={() => configuring = false} />
{:else if dialog}
  <Modal title={dialogTitle} close={() => dialog = null} locked={saving}>
    {#if deleting}
      <ConfirmDelete description={activeProject
        ? `Проект «${activeProject.name}», все его задачи и их записи времени будут удалены.`
        : `Спринт «${activeSprint.name}» будет удалён. Его задачи и записи времени останутся в проектах.`}
        confirm={removeEntity} cancel={() => dialog = null} busy={saving} error={formError} />
    {:else}
      <form class="create-form" onsubmit={save}>
        <label>Название
          <input bind:value={name} required disabled={saving}
            placeholder={dialog === 'project' ? 'Например, личные дела' : dialog === 'sprint' ? 'Например, первая неделя' : 'Что нужно сделать?'} />
        </label>
        {#if sprintForm}
          <div class="field-row">
            <label>Начало <input type="date" bind:value={start} required disabled={saving} /></label>
            <label>Конец <input type="date" bind:value={end} min={start} required disabled={saving} /></label>
          </div>
        {:else if dialog === 'task'}
          {#if !activeProject}
            <label>Проект <select bind:value={projectID} required disabled={saving}>
              {#each projects as project (project.id)}<option value={project.id}>{project.name}</option>{/each}
            </select></label>
          {/if}
          <label>Плановая дата <input type="date" bind:value={plannedDate} disabled={saving} /></label>
          <label>Описание <textarea bind:value={description} rows="3" disabled={saving} placeholder="Добавьте детали"></textarea></label>
        {/if}
        {#if formError}<p class="alert" role="alert">{formError}</p>{/if}
        <div class="form-actions">
          <button type="button" class="button secondary" onclick={() => dialog = null} disabled={saving}>Отмена</button>
          <button class="button primary" disabled={saving}>{saving ? 'Сохраняем…' : editing ? 'Сохранить' : 'Создать'}</button>
        </div>
      </form>
    {/if}
  </Modal>
{:else if selected}
  {#key selected.id}
    <TaskDetail task={selected} project={projects.find((item) => item.id === selected.project_id)}
      {sprints} {columns} close={() => selected = null} changed={taskChanged} deleted={taskDeleted} />
  {/key}
{/if}
