# Pantera — Strapi CMS

Headless CMS для сайта Pantera. Локально по умолчанию SQLite; в Strapi Cloud — PostgreSQL.

```bash
npm install
npm run develop   # http://localhost:1337/admin
```

Схемы контента в `src/api/`. Архитектура и стек: [docs/architecture-and-stack.md](docs/architecture-and-stack.md). Связь с сайтом и вынос CMS из монорепозитория: [docs/frontend-monorepo-integration.md](docs/frontend-monorepo-integration.md). Эксплуатация на VPS (Nginx, PM2, обновления): [docs/vps-nginx-operations.md](docs/vps-nginx-operations.md).
