# Avato Mobile Release Service

This directory deploys a self-hosted Android release service for `apps/mobile`:

- Xavia OTA implements the Expo Updates protocol and serves OTA manifests and assets.
- `deploy/mobile-release/xavia-ota` builds a patched Xavia image that fixes the upstream Postgres manifest query for `update_id`.
- Nginx exposes both the OTA dashboard/API and a static `/apk/` directory for direct APK downloads.
- `deploy/mobile-release/postgres/init/001-schema.sql` initializes the required release tracking tables on a fresh Postgres volume.

The default public base URL is `http://8.217.101.26:3212`.

For the day-to-day release workflow, validation steps, and troubleshooting notes, see [RUNBOOK.md](./RUNBOOK.md).

## Public URLs

- OTA manifest base: `http://8.217.101.26:3212/api/manifest`
- Dashboard: `http://8.217.101.26:3212`
- Canary APK latest: `http://8.217.101.26:3212/apk/canary/latest.apk`

## Deploy user

- Server upload user: `avato_release`
- Recommended CI auth: `AVATO_SERVER_SSH_PRIVATE_KEY`
- Password auth is disabled for `avato_release`; use SSH key auth only.

## Server layout

- `/opt/avato-mobile-release/.env`
- `/opt/avato-mobile-release/docker-compose.yml`
- `/opt/avato-mobile-release/nginx/default.conf`
- `/opt/avato-mobile-release/xavia-ota`
- `/opt/avato-mobile-release/postgres/init/001-schema.sql`
- `/opt/avato-mobile-release/data/releases`
- `/opt/avato-mobile-release/apk/canary/versions`

## Deployment

From `/opt/avato-mobile-release` on the server:

- `docker compose build xavia-ota`
- `docker compose up -d`

## Local commands

From `apps/mobile`:

- `npm run build:android:canary`
- `npm run publish:ota:canary`
- `npm run sync:android:release`
- `npm run upload:apk:canary`

## Required local env

- `AVATO_OTA_SERVER_URL`
- `AVATO_OTA_UPLOAD_KEY`
- `AVATO_SERVER_PASSWORD`
- `AVATO_SERVER_SSH_KEY_PATH`
- `AVATO_SERVER_PORT`
- `AVATO_RELEASE_PUBLIC_BASE_URL`
- `AVATO_RELEASE_STORE_FILE`
- `AVATO_RELEASE_STORE_PASSWORD`
- `AVATO_RELEASE_KEY_ALIAS`
- `AVATO_RELEASE_KEY_PASSWORD`

## GitHub Actions secrets

- `AVATO_OTA_SERVER_URL`
- `AVATO_OTA_UPLOAD_KEY`
- `AVATO_ANDROID_KEYSTORE_BASE64`
- `AVATO_RELEASE_STORE_PASSWORD`
- `AVATO_RELEASE_KEY_ALIAS`
- `AVATO_RELEASE_KEY_PASSWORD`
- `AVATO_SERVER_HOST`
- `AVATO_SERVER_PORT`
- `AVATO_SERVER_USER` with value `avato_release`
- `AVATO_SERVER_SSH_PRIVATE_KEY`
- `AVATO_SERVER_PASSWORD` is optional fallback for local manual uploads only
- `AVATO_RELEASE_PUBLIC_BASE_URL`
- `AVATO_RELEASE_SERVER_DIR`
