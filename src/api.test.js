import { test } from 'node:test';
import assert from 'node:assert/strict';

let index = 0;
async function setup(expiry = 0) {
  const values = new Map();
  globalThis.sessionStorage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
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
  return { api, calls, values, count: () => refreshCount, fail: () => { failRefresh = true; } };
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
