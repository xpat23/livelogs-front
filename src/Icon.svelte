<script>
  let { name, size = 18 } = $props();

  const icons = {
    menu: 'M4 6h16M4 12h16M4 18h16',
    up: 'm6 14 6-6 6 6',
    down: 'm6 10 6 6 6-6',
    board: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm5 0v14m6-14v14',
    report: 'M4 4v15a1 1 0 0 0 1 1h15M9 15v-3m4 3V8m4 7V5',
    plus: 'M12 5v14M5 12h14',
    arrow: 'm9 6 6 6-6 6',
    calendar: 'M7 3v4m10-4v4M4 10h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
    clock: 'M12 8v4l2.5 2.5M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    close: 'm6 6 12 12M18 6 6 18',
    edit: 'm14 6 4 4M5 15 16 4a1.4 1.4 0 0 1 2 0l2 2a1.4 1.4 0 0 1 0 2L9 19l-5 1 1-5z',
    trash: 'M4 7h16m-10 4v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3',
    layers: 'm12 3 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 16l9 5 9-5',
    check: 'm5 12 4 4L19 6',
    folder: 'M4 7h6l2 2h8v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7z',
  };
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d={icons[name]} />
</svg>
