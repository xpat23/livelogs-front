# Livelogs Front

Svelte-интерфейс для персональных проектов, задач, спринтов и учёта времени. Включает доски с настраиваемыми колонками, логи времени и отчёт по проектам.

## Запуск

```sh
make up
make down
```

Интерфейс открывается на `http://127.0.0.1:4000`. По умолчанию браузер обращается к API по адресу `http://127.0.0.1:8068`.

API разворачивается отдельно из репозитория [xpat23/livelogs-api](https://github.com/xpat23/livelogs-api).

Для другого адреса API передайте переменную окружения при запуске.

```sh
API_URL=https://api.example.com make up
```

В контейнере небольшой Go-сервер раздаёт статическую сборку Svelte и конфигурацию `/config.json` на порту `4000`. Браузер отправляет запросы напрямую к API.

## Разработка

Требуется Node.js 24.

```sh
npm ci
npm run dev
```

Vite запускается на `http://127.0.0.1:4000`. Адрес API можно задать через `VITE_API_URL`.

```sh
VITE_API_URL=http://127.0.0.1:8068 npm run dev
npm run build
```

## Публикация образа

```sh
docker login
make release-front TAG=v1.0.0
```

Команда собирает и публикует образ `xpat23/livelogs-front`. По умолчанию используется тег `latest` и платформа `linux/amd64`. Для ARM передайте `RELEASE_PLATFORM=linux/arm64`.

## Kubernetes

Задайте контейнеру `API_URL` с публичным адресом API без пути, например `https://api.example.com`. Этот адрес должен быть доступен из браузера. Если фронтенд открыт по HTTPS, API тоже должен быть доступен по HTTPS.

На бэкенде задайте `CORS_ALLOWED_ORIGINS` с адресом фронтенда со схемой, например `https://tasks.example.com`.
