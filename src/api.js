const env = import.meta.env || {};
let configRequest;
const storageKey = 'livelogs.tokens';
let tokens = null;
let storageAvailable = true;
let generation = 0;
let refreshing;

function readTokens(value) {
  try {
    const pair = JSON.parse(value || 'null');
    return typeof pair?.accessToken === 'string' && typeof pair?.refreshToken === 'string'
      ? { ...pair, loginID: pair.loginID || pair.refreshToken } : null;
  } catch { return null; }
}
try { tokens = readTokens(localStorage.getItem(storageKey)); } catch { storageAvailable = false; }
if (!tokens) {
  try {
    tokens = readTokens(sessionStorage.getItem(storageKey));
    if (tokens) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(tokens));
        storageAvailable = true;
      } catch { storageAvailable = false; }
    }
  } catch { /* Legacy storage may be unavailable. */ }
}
if (storageAvailable) {
  try { sessionStorage.removeItem(storageKey); } catch { /* Legacy storage may be unavailable. */ }
}

function syncStoredTokens() {
  if (!storageAvailable) return;
  let latest;
  try { latest = readTokens(localStorage.getItem(storageKey)); } catch { return; }
  const identityChanged = tokens?.loginID !== latest?.loginID;
  tokens = latest;
  if (identityChanged) {
    generation++;
    refreshing = undefined;
    window.dispatchEvent(new Event('auth-changed'));
  }
}
window.addEventListener('storage', (event) => {
  if (!storageAvailable) return;
  if (event.storageArea === localStorage && (event.key === storageKey || event.key === null)) syncStoredTokens();
});

export class AuthRequired extends Error {
  constructor() { super('Войдите через Google, чтобы продолжить.'); }
}

export function getConfig() {
  if (env.DEV) return Promise.resolve({
    api_url: env.VITE_API_URL || 'http://127.0.0.1:8068',
    auth_url: env.VITE_AUTH_URL || 'https://auth.finlogs.org',
    google_client_id: env.VITE_GOOGLE_CLIENT_ID || '',
  });
  configRequest ??= fetch('/config.json').then(async (response) => {
    if (!response.ok) throw new Error('Не удалось загрузить настройки.');
    return response.json();
  }).catch((error) => { configRequest = undefined; throw error; });
  return configRequest;
}

export function hasTokens() { return !!tokens?.accessToken && !!tokens?.refreshToken; }
function persist(pair) {
  tokens = pair;
  try {
    if (pair) localStorage.setItem(storageKey, JSON.stringify(pair));
    else localStorage.removeItem(storageKey);
  } catch { storageAvailable = false; /* Keep tokens in memory when storage is unavailable. */ }
  try { sessionStorage.removeItem(storageKey); } catch { /* Legacy storage may be unavailable. */ }
}
export function logout() { generation++; persist(null); refreshing = undefined; }
function expired() {
  logout();
  window.dispatchEvent(new Event('auth-expired'));
  throw new AuthRequired();
}
function expiry() {
  if (tokens?.accessTokenExpiresAt) return Number(tokens.accessTokenExpiresAt);
  try { return JSON.parse(atob(tokens.accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp || 0; }
  catch { return 0; }
}
async function exchange(path, body) {
  const config = await getConfig();
  const response = await fetch(config.auth_url.replace(/\/+$/, '') + '/api/auth/' + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!response.ok) {
    if (response.status === 400 || response.status === 401 || response.status === 403) throw new AuthRequired();
    throw new Error('Сервис входа временно недоступен. Попробуйте ещё раз.');
  }
  const pair = await response.json();
  if (!pair.accessToken || !pair.refreshToken) throw new Error('Сервис входа вернул неполный ответ.');
  return pair;
}
export async function login(credential) {
  const version = ++generation;
  const pair = await exchange('open-auth', { id_token: credential });
  if (version !== generation) throw new AuthRequired();
  persist({ ...pair, loginID: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}` });
}
async function refresh(rejectedToken) {
  if (!hasTokens()) throw new AuthRequired();
  if (!refreshing) {
    const version = generation;
    const renew = async () => {
      syncStoredTokens();
      if (version !== generation || !hasTokens()) throw new AuthRequired();
      if (rejectedToken ? tokens.accessToken !== rejectedToken : expiry() > Date.now() / 1000 + 30) return;
      const { refreshToken, loginID } = tokens;
      try {
        const pair = await exchange('refresh-token', { refresh_token: refreshToken });
        syncStoredTokens();
        if (version !== generation) throw new AuthRequired();
        persist({ ...pair, loginID });
      } catch (error) {
        syncStoredTokens();
        if (version !== generation) throw new AuthRequired();
        if (error instanceof AuthRequired) expired();
        throw error;
      }
    };
    const locks = globalThis.navigator?.locks;
    const pending = (locks ? locks.request('livelogs.refresh', renew) : renew())
      .finally(() => { if (refreshing === pending) refreshing = undefined; });
    refreshing = pending;
  }
  return refreshing;
}
export async function request(path, { method = 'GET', body, signal } = {}) {
  if (!hasTokens()) throw new AuthRequired();
  const version = generation;
  const config = await getConfig();
  if (expiry() <= Date.now() / 1000 + 30) await refresh();
  if (version !== generation) throw new AuthRequired();
  const sentToken = tokens.accessToken;
  const send = () => fetch(config.api_url.replace(/\/+$/, '') + '/api' + path, {
    method, signal,
    headers: { Authorization: `Bearer ${tokens.accessToken}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let response = await send();
  if (version !== generation) throw new AuthRequired();
  if (response.status === 401) {
    if (tokens.accessToken === sentToken) await refresh(sentToken);
    if (version !== generation) throw new AuthRequired();
    response = await send();
  }
  if (version !== generation) throw new AuthRequired();
  if (response.status === 401) expired();
  if (response.ok) return response.status === 204 ? undefined : response.json();
  if (response.status === 404) throw new Error('Запись не найдена. Обновите страницу.');
  if (response.status === 400) throw new Error('Проверьте заполнение полей.');
  throw new Error('Сервис временно недоступен. Попробуйте ещё раз.');
}
