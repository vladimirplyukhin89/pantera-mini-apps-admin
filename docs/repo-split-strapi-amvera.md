# Разделение репозитория: Strapi на Amvera, фронтенд на Beget

Пошаговый runbook для безопасного разделения текущего репозитория на два:

- отдельный репозиторий `strapi-cms` (деплой на Amvera);
- текущий репозиторий как фронтенд-only (`astro-app`, деплой на Beget).

Документ рассчитан на миграцию без простоя сайта и с возможностью быстрого отката.

---

## 1) Целевая схема

| Компонент | Где живет | Где деплоится |
|-----------|-----------|---------------|
| Frontend (Astro) | текущий repo (`pantera-mini-apps`) | Beget |
| CMS/API (Strapi) | новый repo (`pantera-mini-apps-admin`) | Amvera |

Фронтенд собирается против публичного API Strapi:

- `STRAPI_URL=https://admin.pantera-boxing.ru`
- `STRAPI_TOKEN=<read-only token>`

---

## 2) Почему так безопаснее делать

1. Сначала поднимаем и проверяем Strapi в новом репозитории.
2. Только потом переключаем фронтенд на новый `STRAPI_URL`.
3. Лишь после этого убираем `strapi-cms` из текущего репозитория.

Так действующий Beget-деплой продолжает работать, пока не будет подтверждено, что Amvera-CMS стабильна.

---

## 3) Подготовка перед переносом

Перед началом:

- убедитесь, что рабочее дерево чистое (`git status`);
- зафиксируйте текущие секреты и переменные (GitHub/Amvera/локальные `.env`);
- проверьте, что фронтенд и Strapi запускаются локально;
- сохраните текущий production `STRAPI_URL` как значение для rollback.

Рекомендуемый freeze:

- на время миграции ограничить контент-правки в текущей Strapi админке;
- если правки идут активно, заранее согласовать окно миграции.

---

## 4) Создание нового репозитория под Strapi

### Вариант репозитория

Рекомендуется создать **свой отдельный GitHub-репозиторий** под `strapi-cms` и подключить его к Amvera.

Почему:

- вы сохраняете полный контроль над Git и CI;
- легче настраивать права команды;
- Amvera выступает как платформа деплоя, а не как источник истины для кода.

Использовать «репозиторий от Amvera» имеет смысл только если это ваш обычный рабочий Git-remote и вам так удобнее поддержка. В большинстве случаев отдельный GitHub-репозиторий проще и прозрачнее.

### Перенос с историей папки (`git subtree`)

Выполнить из корня текущего репозитория:

```bash
git checkout main
git pull
git subtree split --prefix=strapi-cms -b split/strapi-cms
git remote add strapi-new git@github.com:vladimirplyukhin89/pantera-mini-apps-admin.git
git push -u strapi-new split/strapi-cms:main
```

Если remote `strapi-new` уже существует, обновите URL:

```bash
git remote set-url strapi-new git@github.com:vladimirplyukhin89/pantera-mini-apps-admin.git
git push -u strapi-new split/strapi-cms:main
```

Проверка:

- в новом репозитории в корне лежит Strapi-проект (`package.json`, `config/`, `src/`);
- история коммитов по `strapi-cms` сохранена.

---

## 5) Запуск Strapi в новом репозитории (локально)

```bash
git clone <URL_НОВОГО_REPO>
cd <НОВЫЙ_REPO>
npm ci
npm run build
npm run develop
```

Проверить:

- админка доступна (`/admin`);
- API отвечает (`/api/hero?populate=*`);
- контент и медиа корректно отдаются.

---

## 6) Деплой нового Strapi репозитория на Amvera

1. Подключите новый репозиторий к Amvera.
2. Создайте managed PostgreSQL в Amvera:
   - на главной странице выберите `PostgreSQL` → `Создать базу данных`;
   - задайте `Название проекта`, тариф (рекомендуется не ниже «Начальный»), `Имя создаваемой БД`, `Имя пользователя`, `Пароль пользователя`, размер кластера;
   - дождитесь статуса `PostgreSQL запущен`;
   - откройте карточку БД и сохраните параметры подключения (host `...-rw`, port, db name, username, password).
3. В Strapi-проекте на Amvera откройте раздел `Переменные` и добавьте переменные/секреты.
   В первую очередь:
   - `NODE_ENV=production`
   - `APP_KEYS`
   - `API_TOKEN_SALT`
   - `ADMIN_JWT_SECRET`
   - `TRANSFER_TOKEN_SALT`
   - `JWT_SECRET`
   - `ENCRYPTION_KEY`
4. Добавьте переменные БД для Postgres:
   - `DATABASE_CLIENT=postgres`
   - `DATABASE_HOST=<internal-rw-host-from-amvera-postgres>`
   - `DATABASE_PORT=5432`
   - `DATABASE_NAME=<db-name>`
   - `DATABASE_USERNAME=<db-user>`
   - `DATABASE_PASSWORD=<db-password>`
   - `DATABASE_SSL=false` (для внутреннего подключения между сервисами Amvera; для внешнего POSTGRES-домена обычно нужен `true`)
5. Откуда брать `DATABASE_*`:
   - если используете новую БД Amvera — из параметров созданного PostgreSQL-кластера;
   - если переносите существующую БД — из текущего production окружения/провайдера БД;
   - значения не генерируются автоматически Strapi или Amvera-приложением, их задаете вы из реквизитов целевой БД.
6. Какие значения хранить как секреты:
   - секреты: `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY`, `DATABASE_PASSWORD`;
   - обычные переменные: `NODE_ENV`, `DATABASE_CLIENT`, `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USERNAME`, `DATABASE_SSL`.
7. Убедитесь, что сборка выполняется командами из Strapi-проекта (`npm ci`, `npm run build`, `npm run start`).
8. Перезапустите контейнеры/сделайте redeploy (в Amvera переменные окружения применяются после перезапуска).
9. После деплоя проверьте публичные endpoints:
   - `/api/hero?populate=*`
   - `/api/events?populate=*` (или актуальный endpoint вашего проекта)
   - `/admin`

Для текущего проекта целевой публичный адрес CMS:

- `https://admin.pantera-boxing.ru`

Если используете SQLite, заранее проверьте политику хранения данных в окружении Amvera (персистентность диска и бэкапы). Для production обычно лучше управляемая БД.

---

## 7) Переключение фронтенда на новый Strapi URL

В текущем фронтенд-репозитории:

1. Обновите `STRAPI_URL` и `STRAPI_TOKEN`:
   - локально (`astro-app/.env`);
   - в GitHub Secrets для CI.
2. Локально прогоните:

```bash
cd astro-app
npm ci
npm run build
```

3. Проверьте критичные страницы:
   - главная;
   - галерея и события;
   - спортсмены;
   - медиа (картинки/видео).
4. Сделайте push в `main` и дождитесь деплоя на Beget.

---

## 8) CI после разделения (обязательно)

После разделения должны работать два независимых CI-контура.

### 8.1 Frontend-репозиторий (`pantera-mini-apps`)

Оставить:

- frontend проверки (`format`, `astro check`, `build`);
- деплой статики на Beget;
- `rebuild-static.yml` (manual/webhook/schedule).

Убрать/изменить:

- удалить `check-backend` из `.github/workflows/deploy.yml`;
- изменить `deploy-beget.needs` с `[check-frontend, check-backend]` на `[check-frontend]`.

Секреты и переменные в этом репозитории:

- `STRAPI_URL`, `STRAPI_TOKEN`;
- `BEGET_*` (FTP/SSH и флаги деплоя).

### 8.2 Strapi-репозиторий (`pantera-mini-apps-admin`)

Добавить отдельный workflow (пример):

- `npm ci`;
- `npm run build`;
- опционально деплой на Amvera при push в `main`.

Секреты в этом репозитории:

- Strapi app secrets (`APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY`);
- переменные БД (`DATABASE_*`);
- при необходимости сервисные токены Amvera.

### 8.3 Безопасный порядок переключения CI

1. Сначала запускаем CI в новом Strapi-репозитории и проверяем Amvera.
2. Затем обновляем `STRAPI_URL`/`STRAPI_TOKEN` во frontend-репозитории.
3. Делаем rebuild/deploy фронтенда на Beget.
4. И только после этого удаляем backend-джобы из frontend CI.

Параметры текущего окружения:

- frontend repo: `pantera-mini-apps`
- backend repo: `pantera-mini-apps-admin`
- production `STRAPI_URL`: `https://admin.pantera-boxing.ru`

---

## 9) Очистка текущего репозитория до frontend-only

Делать только после успешного переключения и smoke-тестов.

1. Удалить `strapi-cms/` из текущего репозитория.
2. Удалить/переписать файлы, которые были нужны только для Strapi-на-Amvera из этого repo:
   - корневой `amvera.yml`;
   - корневой `package.json` (если он только проксирует запуск `strapi-cms`).
3. Обновить CI:
   - убрать `check-backend` job из `.github/workflows/deploy.yml`;
   - оставить frontend проверки/деплой Beget.
4. Обновить документацию:
   - структура проекта;
   - где теперь живет CMS;
   - как обновлять `STRAPI_*` переменные.

---

## 10) Рекомендуемый план коммитов

Чтобы история была понятной:

1. В новом Strapi-репозитории:
   - `chore: init repository from strapi-cms subtree`
2. В текущем репозитории:
   - `docs: add strapi split and migration runbook`
   - `chore: switch frontend env to new strapi endpoint` (если есть изменения в коде/конфигах)
   - `chore: remove strapi-cms from frontend repository`
   - `ci: remove backend checks from frontend pipeline`

---

## 11) Rollback-план

Если после переключения есть проблемы:

1. Вернуть старый `STRAPI_URL`/`STRAPI_TOKEN` в GitHub Secrets.
2. Пересобрать фронтенд (`Rebuild static site` workflow или push).
3. Проверить восстановление сайта на Beget.

Rollback быстрый, потому что фронтенд статический и меняет только источник данных на этапе сборки.

---

## 12) Чеклист завершения

- [ ] Новый репозиторий `strapi-cms` создан и заполнен через `git subtree split`
- [ ] Strapi успешно деплоится на Amvera
- [ ] API и `/admin` работают на новом домене
- [ ] Фронтенд собирается с новым `STRAPI_URL`
- [ ] Деплой на Beget успешен, smoke-тест пройден
- [ ] `strapi-cms` удален из текущего репозитория
- [ ] CI текущего репозитория frontend-only
- [ ] Документация обновлена в обоих репозиториях

