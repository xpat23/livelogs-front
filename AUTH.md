# Google login

Frontend calls `AUTH_URL/api/auth/open-auth` with a Google `id_token`. The auth service handles first login and returns access/refresh tokens. Tokens live in the browser's sessionStorage (per tab); closing the tab ends local persistence. The frontend renews access tokens directly via `AUTH_URL/api/auth/refresh-token`, serializes refresh requests, and retries an API 401 once. Logout clears local tokens; the auth service currently has no revocation endpoint, so issued tokens remain valid until expiry.

API has no sessions or refresh-token database. Each `/api/*` request must carry `Authorization: Bearer <accessToken>`. API verifies HS256 signature, expiration, issued-at and the `username` email claim. The email becomes the owner of projects, sprints, tasks, columns and time entries. `/healthz` is public; `/api/me` returns the authenticated email.

## Production Kubernetes

API env:

- `DATABASE_URL`: PostgreSQL DSN.
- `AUTH_JWT_SECRET`: Kubernetes Secret containing the same value as auth service `JWT_SECRET_KEY`. Never expose it to frontend.
- `CORS_ALLOWED_ORIGINS=https://live.finlogs.org`
- `LEGACY_OWNER_EMAIL=x.pat.kg@gmail.com`: moves old `anonymous` rows atomically on startup. Repeat runs are safe. Leave unset for new installations; remove after migration if desired.
- `HTTP_ADDR=:8068`

Frontend runtime env:

- `API_URL=https://api-live.finlogs.org`
- `AUTH_URL=https://auth.finlogs.org`
- `GOOGLE_CLIENT_ID=350839092167-6paoa2hq1ci7orhkptp42n9mp92mqp7l.apps.googleusercontent.com`

Auth service env:

- `CORS_ALLOWED_ORIGINS=https://live.finlogs.org,http://localhost:4000,http://127.0.0.1:4000`
- Existing `GOOGLE_CLIENT_ID` and `JWT_SECRET_KEY` stay configured there.

In Google Cloud OAuth client, add authorized JavaScript origins `https://live.finlogs.org`, `http://localhost:4000`, `http://127.0.0.1:4000`. Google Identity Services uses a JavaScript callback; this integration adds no redirect URL. Deploy the auth-service CORS change before browser login can work.

The runtime environment is read on container startup through `/config.json`, so one frontend image works across environments. `.env.production` is an example for deployment, not a file automatically loaded by Kubernetes. For Vite dev, use variables from `.env.example`.

## Local

Copy `.env.example` to `.env`, set the real auth signing key privately, then `make up`. Never use a made-up key with production auth: tokens will fail validation. API port 8068, frontend port 4000.
