# Работа с VPS (Beget), Nginx и Strapi

Краткий справочник по текущему деплою **Pantera Strapi** на VPS.

## Что к чему относится

- **Репозиторий на GitHub** — исходный код. На сервере лежит **клон** (например `/var/www/pantera-mini-apps-admin`).
- **URL** `https://admin.pantera-boxing.ru` — это адрес **уже запущенного** приложения за Nginx. Браузер не «открывает репозиторий», а ходит к процессу Strapi на VPS.
- Путь **`/admin`** — маршрут админки Strapi (не папка в `public_html` на shared-хостинге).

Обновления кода на проде: GitHub Actions по push в `main` (SSH под `deploy`: `git fetch` + `git checkout -B main origin/main`) → `npm ci` / build → PM2. Руками на сервере — та же схема синхронизации с `origin/main`, без коммитов из `/var/www/...`.

## Доступ и пользователи

| Кто | Зачем |
|-----|--------|
| `root` | Система: `apt`, UFW, `/etc/nginx`, `certbot`, `systemctl` |
| `deploy` | Код: `git`, `npm`, PM2, файлы в `/var/www/...` |

Вход по SSH (с вашего ПК):

```bash
ssh root@45.153.191.22
```

Переключение на приложение:

```bash
su - deploy
. "$HOME/.nvm/nvm.sh"
cd /var/www/pantera-mini-apps-admin
```

## Окружение Node и PM2

В репозитории зафиксирована **Node 20** (файлы `.nvmrc` и `.node-version`, поле `engines` в `package.json`). После обновления кода из Git (`git pull` локально или синхронизация с `origin/main` на VPS) выравнивайте версию так:

```bash
cd /var/www/pantera-mini-apps-admin
. "$HOME/.nvm/nvm.sh"
nvm install
nvm use
nvm alias default 20
```

GitHub Actions при деплое выполняет `nvm install` / `nvm use` уже после обновления кода из `origin/main`, так что сборка на сервере идёт на той же major-версии, что и в проекте.

PM2 и Node ставятся у `deploy` через **nvm**. Перед командами `pm2` всегда подгружайте nvm:

```bash
. "$HOME/.nvm/nvm.sh"
pm2 list
pm2 logs pantera-admin --lines 100
```

Полезное:

```bash
pm2 restart pantera-admin
pm2 save
```

Автозапуск PM2 после перезагрузки VPS настраивается командой `pm2 startup` (один раз; вывод выполняется под `root`), затем снова под `deploy`: `pm2 save`.

## Переменные окружения

Файл на сервере:

```text
/var/www/pantera-mini-apps-admin/.env
```

Редактирование:

```bash
nano /var/www/pantera-mini-apps-admin/.env
```

После изменений:

```bash
. "$HOME/.nvm/nvm.sh"
pm2 restart pantera-admin --update-env
```

Рекомендуется для прода:

- `NODE_ENV=production`
- `PUBLIC_URL=https://admin.pantera-boxing.ru`
- `UPLOAD_MAX_FILE_SIZE_MB=50` (или ваш рабочий лимит)
- `UPLOAD_REQUEST_TIMEOUT_MS=360000` (должно быть **не меньше**, чем `UPLOAD_HEADERS_TIMEOUT_MS` — иначе Node падает с `ERR_OUT_OF_RANGE`)
- `UPLOAD_HEADERS_TIMEOUT_MS=300000`
- `UPLOAD_KEEP_ALIVE_TIMEOUT_MS=65000`
- секреты из `.env.example` — уникальные значения, не из репозитория

## Обновление приложения после изменений в Git

Под `deploy`:

```bash
su - deploy
. "$HOME/.nvm/nvm.sh"
cd /var/www/pantera-mini-apps-admin

# SQLite: бэкап перед изменениями
mkdir -p backups
cp .tmp/data.db "backups/data-$(date +%F-%H%M).db"

git fetch origin
git checkout -B main origin/main
npm ci
export NODE_OPTIONS=--max-old-space-size=3072
NODE_ENV=production npm run build
pm2 restart pantera-admin --update-env || pm2 start ./node_modules/.bin/strapi --name pantera-admin --cwd /var/www/pantera-mini-apps-admin -- start
pm2 save
```

## Nginx

### Кто за что отвечает (разные «юзеры»)

| Сущность | Роль |
|----------|------|
| **`root`** | Правит файлы в `/etc/nginx/`, `nginx -t`, `systemctl reload nginx`, `certbot` |
| **`www-data`** | Только *процесс* nginx: читает конфиги и логи; **не** деплоит приложение |
| **`deploy`** | Код, `pm2`, Node; слушает **только** `127.0.0.1:1337` (снаружи порт 1337 не обязателен) |
| **Публичный IP `45.153.191.22`** | DNS `admin` → этот A-записью; Nginx на VPS принимает `80/443` |

Версия **nginx/1.24.x (Ubuntu)** — директивы ниже с ней совместимы. Редактирование vhost: только под `root` или `sudo`.

### WebSocket и переменная `$connection_upgrade`

Если в `location` используете `proxy_set_header Connection $connection_upgrade;`, в блоке **`http { ... }`** файла `/etc/nginx/nginx.conf` (или в отдельном файле из `/etc/nginx/conf.d/`, подключаемом **до** `sites-enabled`) должно быть:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
```

Иначе `nginx -t` выдаст `unknown "connection_upgrade" variable`. Не помещайте `map` внутрь `server { }`.

### Актуальный прокси под `.env` (таймауты 360s, один `location /`)

Для прода с `UPLOAD_REQUEST_TIMEOUT_MS=360000` таймауты Nginx логично держать **на уровне `server`** **360s**, один блок **`location /`** на весь Strapi (не дублировать `location ^~ /api`, `/upload` и т.д. с другими таймаутами). После certbot правьте существующий SSL-`server`, пути к сертификатам не меняйте.

Пример фрагмента для **443** (строки `listen` / `ssl_*` оставьте как выдал Certbot):

```nginx
server {
    server_name admin.pantera-boxing.ru;

    client_max_body_size 50m;
    client_body_timeout 360s;

    location / {
        proxy_pass http://127.0.0.1:1337;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        proxy_connect_timeout 60s;
        proxy_send_timeout 360s;
        proxy_read_timeout 360s;

        proxy_request_buffering off;
        proxy_buffering off;
    }

    # listen 443 ssl; ssl_certificate ... — managed by Certbot
}
```

### Полный пример vhost (HTTP → дальше certbot)

1. **Первая выкладка** (только порт 80, чтобы был ответ 200 и certbot мог выписать сертификат). Файл, например:

   `/etc/nginx/sites-available/pantera-admin`

2. Симлинк и проверка (под `root`):

   ```bash
   ln -sf /etc/nginx/sites-available/pantera-admin /etc/nginx/sites-enabled/pantera-admin
   # отключить дефолт, если мешает:
   # rm -f /etc/nginx/sites-enabled/default
   nginx -t && systemctl reload nginx
   ```

3. Сертификат:

   ```bash
   certbot --nginx -d admin.pantera-boxing.ru
   ```

   Certbot **сам** добавит блок `listen 443 ssl` и редирект с `:80` на HTTPS — после этого не дублируйте `server` вручную, правьте существующий.

Пример **начального** файла (только `listen 80`), интрассылка в Strapi на `127.0.0.1:1337`:

```nginx
# /etc/nginx/sites-available/pantera-admin
# Strapi: PM2 у пользователя deploy, порт 1337

server {
    listen 80;
    listen [::]:80;
    server_name admin.pantera-boxing.ru;

    client_max_body_size 50m;
    client_body_timeout 360s;

    location / {
        proxy_pass http://127.0.0.1:1337;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;

        proxy_connect_timeout 60s;
        proxy_send_timeout 360s;
        proxy_read_timeout 360s;

        proxy_request_buffering off;
    }
}
```

После выпуска сертификата и настройки `map` в `http` добавьте в этот же `location` строки `Upgrade` / `Connection $connection_upgrade`, как в разделе «Актуальный прокси» выше.

Убедитесь, что в `.env` на сервере задано `PUBLIC_URL=https://admin.pantera-boxing.ru` (после включения HTTPS).

Конфиг сайта (имя файла может отличаться):

- `/etc/nginx/sites-available/pantera-admin` (или `pantera-admin.conf`)
- симлинк в `sites-enabled/`

Проверка и перезагрузка (под `root`):

```bash
nginx -t
systemctl reload nginx
```

Статус:

```bash
systemctl status nginx --no-pager
```

### Рекомендуемые настройки для upload (502/413)

Если в `error.log` есть `upstream prematurely closed connection while reading response header from upstream` на `POST /upload`, начните с усиления лимитов/таймаутов в `server` блоке сайта:

```nginx
server {
    server_name admin.pantera-boxing.ru;

    # Должен быть не меньше лимита Strapi upload/body parser.
    client_max_body_size 50m;
    client_body_timeout 360s;

    location / {
        proxy_pass http://127.0.0.1:1337;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        # Для долгой обработки изображений/медленного диска (согласовать с UPLOAD_REQUEST_TIMEOUT_MS).
        proxy_connect_timeout 60s;
        proxy_send_timeout 360s;
        proxy_read_timeout 360s;

        # Уменьшает риск обрывов при multipart upload.
        proxy_request_buffering off;
    }
}
```

Применение под `root`:

```bash
nginx -t && systemctl reload nginx
```

Минимальная проверка:

```bash
# В браузере повторить загрузку того же файла
# и параллельно смотреть ошибки nginx
tail -f /var/log/nginx/error.log
```

Если 502 остаётся после этих настроек, причина обычно уже в Strapi/Node (исключение в upload, падение процесса или OOM), а не в самом Nginx.

## HTTPS (Let’s Encrypt / certbot)

Выпуск/обновление сертификата (под `root`):

```bash
certbot --nginx -d admin.pantera-boxing.ru
```

Проверка автообновления:

```bash
certbot renew --dry-run
```

Список сертификатов:

```bash
certbot certificates
```

## Файрвол (UFW)

Ожидаемые входящие правила: **22** (SSH), **80** (HTTP), **443** (HTTPS).

```bash
ufw status verbose
```

## DNS

Поддомен `admin` в зоне `pantera-boxing.ru` должен указывать **A-записью** на публичный IPv4 VPS из панели Beget. После смены IP подождите распространение DNS; проверка:

```bash
dig +short admin.pantera-boxing.ru
```

## Быстрая диагностика

Локально на сервере Strapi:

```bash
curl -I http://127.0.0.1:1337/admin
```

Через Nginx (подставьте нужный Host):

```bash
curl -I -H "Host: admin.pantera-boxing.ru" http://127.0.0.1/admin
```

С вашего ПК:

```bash
curl -I https://admin.pantera-boxing.ru/admin
```

В ответе ожидается заголовок `X-Powered-By: Strapi`.

## Типичные проблемы

- **`curl: Failed to connect ... port 80/443`** — Nginx остановлен: `systemctl status nginx`, затем `systemctl start nginx`; проверка `ss -ltnp | grep -E ':80|:443'`. Убедитесь, что UFW разрешает **80** и **443**.
- **`unknown "connection_upgrade" variable`** — директива `map` для `$connection_upgrade` должна быть в **`http { }`**, не в `server`. См. раздел выше.
- **`pm2: command not found`** — не подгружен nvm: выполните `. "$HOME/.nvm/nvm.sh"`.
- **`deploy is not in the sudoers`** — системные команды только под `root` (`su -`).
- **403/404 вместо Strapi** — смотрите `sites-enabled`, не перехватывает ли запрос `default`; нужен `proxy_pass` на `127.0.0.1:1337` для `server_name admin.pantera-boxing.ru`.
- **HTTPS не открывается** — нет сертификата или nginx не слушает 443: `certbot --nginx`, затем `ss -ltnp | grep ':443'`.
- **В админке при загрузке фото `JSON.parse: unexpected character ...`** — обычно Nginx вернул HTML-ошибку (часто `413 Request Entity Too Large`) вместо JSON. Проверьте `client_max_body_size` в `server`/`http` блоке Nginx и сделайте лимит не ниже Strapi (`UPLOAD_MAX_FILE_SIZE_MB`, по умолчанию 10 МБ), затем `nginx -t && systemctl reload nginx`.
