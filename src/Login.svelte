<script>
  import { onMount } from 'svelte';
  import { getConfig, login, logout, request } from './api.js';
  let { onlogin } = $props();
  let button;
  let error = $state('');
  let busy = $state(false);
  let ready = $state(false);
  let active = true;

  async function signIn(response) {
    if (busy || !active) return;
    busy = true;
    error = '';
    try {
      await login(response.credential);
      const user = await request('/me');
      if (active) onlogin(user);
    } catch (err) {
      logout();
      if (active) error = err.message;
    } finally { busy = false; }
  }

  async function initialize() {
    error = '';
    try {
      const config = await getConfig();
      if (!config.google_client_id) throw new Error('Для входа нужно настроить GOOGLE_CLIENT_ID.');
      if (!window.google?.accounts?.id) await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        const timer = setTimeout(() => { script.remove(); reject(new Error('Не удалось загрузить вход Google. Проверьте соединение.')); }, 15000);
        script.onload = () => { clearTimeout(timer); resolve(); };
        script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Не удалось загрузить вход Google.')); };
        document.head.appendChild(script);
      });
      if (!active) return;
      google.accounts.id.initialize({ client_id: config.google_client_id, callback: signIn, auto_select: false });
      google.accounts.id.renderButton(button, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: 280, locale: 'ru' });
      ready = true;
    } catch (err) { if (active) error = err.message; }
  }
  onMount(() => { initialize(); return () => { active = false; }; });
</script>

<main class="login-page">
  <section class="login-card">
    <img src="/focus.svg" alt="" width="64" height="64" />
    <p class="eyebrow">Твой день. Твой ритм.</p>
    <h1>Место для фокуса</h1>
    <p>Проекты, спринты и время — в одном личном пространстве.</p>
    <div class="google-button" class:signing-in={busy} bind:this={button}></div>
    {#if busy}<p role="status">Открываем ваше пространство…</p>{/if}
    {#if error}<p class="alert" role="alert">{error}</p><button class="button" onclick={initialize}>Попробовать снова</button>{/if}
    {#if !ready && !error}<p role="status">Подключаем Google…</p>{/if}
    <small>Первый вход автоматически создаст ваше пространство.</small>
  </section>
</main>
