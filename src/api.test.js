import { test } from 'node:test';
import assert from 'node:assert/strict';

let index = 0;
async function setup(expiry = 0) {
  const values = new Map();
  globalThis.localStorage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const legacyValues = new Map();
  globalThis.sessionStorage = { getItem: (key) => legacyValues.get(key), setItem: (key, value) => legacyValues.set(key, value), removeItem: (key) => legacyValues.delete(key) };
  Object.defineProperty(globalThis.navigator, 'locks', { value: undefined, configurable: true });
  globalThis.window = new EventTarget();
  const calls = [];
  let refreshCount = 0;
  let failRefresh = false;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, ...options });
    if (url === '/config.json') return Response.json({ api_url: 'https://api.test', auth_url: 'https://auth.test' });
    if (url.endsWith('/open-auth')) return Response.json({ accessToken: 'old-token', refreshToken: 'refresh-1', accessTokenExpiresAt: expiry });
    if (url.endsWith('/refresh-token')) {
      refreshCount++;
      await new Promise((resolve) => setTimeout(resolve, 15));
      if (failRefresh) return new Response('', { status: 401 });
      return Response.json({ accessToken: 'new-token', refreshToken: 'refresh-2', accessTokenExpiresAt: Date.now() / 1000 + 3600 });
    }
    return Response.json({ email: 'test@example.com' });
  };
  const api = await import(`./api.js?test=${++index}`);
  await api.login('google-credential');
  return { api, calls, values, legacyValues, count: () => refreshCount, fail: () => { failRefresh = true; } };
}

test('direct auth exchange, single refresh for concurrent requests and Bearer header', async () => {
  const { api, calls, count } = await setup();
  await Promise.all([api.request('/projects'), api.request('/sprints'), api.request('/columns')]);
  assert.equal(count(), 1);
  assert.equal(calls[1].url, 'https://auth.test/api/auth/open-auth');
  assert.deepEqual(JSON.parse(calls[1].body), { id_token: 'google-credential' });
  assert.equal(calls.filter((c) => c.url.startsWith('https://api.test')).length, 3);
  assert.ok(calls.filter((c) => c.url.startsWith('https://api.test')).every((c) => c.headers.Authorization === 'Bearer new-token'));
});
test('logout during refresh cannot restore tokens or send an API request', async () => {
  const { api, calls, values } = await setup();
  const pending = api.request('/projects');
  await new Promise((resolve) => setTimeout(resolve, 5));
  api.logout();
  await assert.rejects(pending, api.AuthRequired);
  assert.equal(api.hasTokens(), false);
  assert.equal(values.size, 0);
  assert.ok(!calls.some((c) => c.url.startsWith('https://api.test')));
});
test('rejected refresh clears tokens and emits auth-expired', async () => {
  const { api, fail } = await setup();
  let events = 0;
  window.addEventListener('auth-expired', () => events++);
  fail();
  await assert.rejects(api.request('/me'), api.AuthRequired);
  assert.equal(events, 1);
  assert.equal(api.hasTokens(), false);
});
test('API 401 refreshes and retries once', async () => {
  const { api, calls, count } = await setup(Date.now() / 1000 + 3600);
  const original = globalThis.fetch;
  globalThis.fetch = (url, opts) => url.startsWith('https://api.test') && opts.headers.Authorization === 'Bearer old-token'
    ? Promise.resolve(new Response('', { status: 401 })) : original(url, opts);
  assert.equal((await api.request('/me')).email, 'test@example.com');
  assert.equal(count(), 1);
  assert.ok(calls.some((c) => c.url.endsWith('/me') && c.headers.Authorization === 'Bearer new-token'));
});
test('temporary refresh error retains tokens for retry', async () => {
  const { api } = await setup();
  const original = globalThis.fetch;
  globalThis.fetch = (url, opts) => url.endsWith('/refresh-token') ? Promise.resolve(new Response('', { status: 503 })) : original(url, opts);
  await assert.rejects(api.request('/me'), /временно недоступен/);
  assert.equal(api.hasTokens(), true);
});


test('tokens survive a fresh module and rotated pair persists after expired access token', async () => {
  const { api, values, count } = await setup();
  assert.equal(values.has('livelogs.tokens'), true);
  const reopened = await import(`./api.js?test=${++index}`);
  assert.equal(reopened.hasTokens(), true);
  await reopened.request('/me');
  assert.equal(count(), 1);
  assert.equal(JSON.parse(values.get('livelogs.tokens')).refreshToken, 'refresh-2');
  const again = await import(`./api.js?test=${++index}`);
  await again.request('/me');
  assert.equal(count(), 1);
  api.logout();
});

test('existing sessionStorage login migrates to localStorage', async () => {
  const { values, legacyValues } = await setup(Date.now() / 1000 + 3600);
  const old = values.get('livelogs.tokens');
  values.clear(); legacyValues.set('livelogs.tokens', old);
  const migrated = await import(`./api.js?test=${++index}`);
  assert.equal(migrated.hasTokens(), true);
  assert.equal(JSON.parse(values.get('livelogs.tokens')).refreshToken, 'refresh-1');
  assert.equal(legacyValues.size, 0);
});

test('two tabs serialize rotating refresh tokens with a shared lock', async () => {
  const { api, count } = await setup();
  const secondTab = await import(`./api.js?test=${++index}`);
  let queue = Promise.resolve();
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request: (_name, callback) => { const next = queue.then(callback); queue = next.catch(() => {}); return next; },
  } });
  await Promise.all([api.request('/projects'), secondTab.request('/sprints')]);
  assert.equal(count(), 1);
});

test('logout in another tab invalidates local identity through storage event', async () => {
  const { api, values } = await setup();
  const secondTab = await import(`./api.js?test=${++index}`);
  api.logout();
  const event = new Event('storage');
  Object.defineProperties(event, { key: { value: 'livelogs.tokens' }, storageArea: { value: localStorage } });
  window.dispatchEvent(event);
  assert.equal(secondTab.hasTokens(), false);
  assert.equal(values.size, 0);
  await assert.rejects(secondTab.request('/me'), secondTab.AuthRequired);
});
