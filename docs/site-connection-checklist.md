# Чеклист подключения админки к сайту (итерация со SQLite)

Этот чеклист для текущего этапа, когда Strapi админка работает на SQLite и миграция БД откладывается.

## 1) Базовая конфигурация Strapi (админ-репозиторий)

- [x] В `.env` задан `PUBLIC_URL=https://admin.pantera-boxing.ru`
- [x] В `.env` оставлен `DATABASE_CLIENT=sqlite`
- [?] Файл базы существует на сервере: `.tmp/data.db`
- [x] Настроены Cloudinary-переменные (`CLOUDINARY_NAME`, `CLOUDINARY_KEY`, `CLOUDINARY_SECRET`)
- [x] После изменений выполнен деплой (через CI или вручную)

## 2) Доступность админки и API в проде

- [x] Локально на VPS отвечает Strapi:
  `curl -I http://127.0.0.1:1337/admin`
- [x] Через домен и Nginx отвечает админка:
  `curl -I https://admin.pantera-boxing.ru/admin`
- [x] В ответах есть `X-Powered-By: Strapi`

## 3) Проверка CORS для сайта

Проверка preflight с origin сайта:

```bash
curl -s -D - -o /dev/null \
  -H "Origin: https://pantera-boxing.ru" \
  -H "Access-Control-Request-Method: GET" \
  -X OPTIONS "https://admin.pantera-boxing.ru/api"
```

Ожидаемо:

- [x] `HTTP/1.1 204 No Content` (или другой успешный код preflight)
- [x] `Access-Control-Allow-Origin: https://pantera-boxing.ru`
- [x] `Access-Control-Allow-Methods` содержит нужные методы
- [x] `Access-Control-Allow-Headers` содержит минимум `Content-Type, Authorization`

Примечание: для curl без `Origin` заголовок `Access-Control-Allow-Origin` может быть пустым — это нормально.

## 4) Проверка интеграции с сайтом

- [x] На сайте `STRAPI_URL` указывает на `https://admin.pantera-boxing.ru`
- [x] На стороне сайта запросы к API уходят именно на этот URL
- [ ] В Strapi у нужных коллекций открыты корректные permissions для чтения
- [ ] Тестовый контент, созданный в админке, читается на сайте

## 5) Операционный минимум перед переключением репозитория

- [ ] Последний деплой в GitHub Actions зеленый
- [ ] Ветка `main` защищена (работа через PR)
- [ ] Документация по VPS и секретам актуальна:
  - `docs/vps-nginx-operations.md`
  - `docs/github-actions-vps-secrets.md`

## 6) Что отложено на следующую итерацию

- [ ] Миграция с SQLite на целевую БД сайта (PostgreSQL/MySQL)
- [ ] Бэкап/план отката перед миграцией
- [ ] Сверка схемы и данных после переключения БД
