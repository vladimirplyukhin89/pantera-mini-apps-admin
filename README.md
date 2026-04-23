# Pantera — Strapi CMS

Headless CMS для сайта Pantera. Локально по умолчанию SQLite; в Strapi Cloud — PostgreSQL.

```bash
npm install
npm run develop   # http://localhost:1337/admin
```

Схемы контента в `src/api/`. Архитектура и стек: [docs/architecture-and-stack.md](docs/architecture-and-stack.md). Связь с сайтом и вынос CMS из монорепозитория: [docs/frontend-monorepo-integration.md](docs/frontend-monorepo-integration.md). Эксплуатация на VPS (Nginx, PM2, обновления): [docs/vps-nginx-operations.md](docs/vps-nginx-operations.md).

## Продакшен (VPS) и деплой

Единый способ обновлять CMS на сервере: **SSH** под пользователем `deploy` — те же шаги, что в [`.github/workflows/deploy-vps.yml`](.github/workflows/deploy-vps.yml) (`git pull` → `npm ci` → `npm run build` → `pm2 …`). Секреты GitHub: [docs/github-actions-vps-secrets.md](docs/github-actions-vps-secrets.md). Команда **`npm run deploy`** в этом репозитории — CLI Strapi Cloud (`strapi deploy`), **не** деплой на ваш VPS; для Pantera на VPS она не используется.
