let configRequest;

function getAPIOrigin() {
  if (import.meta.env.DEV) return import.meta.env.VITE_API_URL || 'http://127.0.0.1:8068';

  configRequest ??= fetch('/config.json').then(async (response) => {
    if (!response.ok) throw new Error('Не удалось загрузить адрес API.');
    const config = await response.json();
    return config.api_url;
  }).catch((error) => {
    configRequest = undefined;
    throw error;
  });
  return configRequest;
}

export async function request(path, { method = 'GET', body, signal } = {}) {
  const origin = (await getAPIOrigin()).replace(/\/+$/, '');
  const response = await fetch(origin + '/api' + path, {
    method,
    signal,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.ok) return response.status === 204 ? undefined : response.json();

  if (response.status === 404) throw new Error('Запись не найдена. Обновите страницу.');
  if (response.status === 400) throw new Error('Проверьте заполнение полей.');
  throw new Error('Сервис временно недоступен. Попробуйте ещё раз.');
}
