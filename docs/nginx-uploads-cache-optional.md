# Опциональное кэширование медиа в Nginx (`/uploads/`)

Strapi в этом репозитории может отдавать **долгий `Cache-Control`** для путей `/uploads/…` (см. `src/middlewares/uploads-cache.ts` и [vps-nginx-operations.md](vps-nginx-operations.md)). Тогда **браузер и внешний CDN** кэшируют по заголовкам, а Nginx в роли чистого `proxy_pass` эти заголовки **пробрасывает** — отдельный кэш в Nginx **не обязателен**.

## Когда имеет смысл `proxy_cache` на Nginx

- Нужно **снизить повторные обращения к Node/Strapi** к **одним и тем же** URL (много посетителей, одни и те же картинки).
- Нужен **серверный** кэш (на диске/в зоне памяти воркера) независимо от клиента.

При **низком** трафике эффект часто **небольшой**; нагрузка на диск/память — на ваше усмотрение.

Имена файлов в локальном upload-провайдере: `/uploads/{hash}{ext}` — при смене файла меняется URL, **ручной purge** кэша Nginx обычно **не** нужен.

## Что сделать

### 1. Зона кэша в блоке `http { … }`

`proxy_cache_path` **нельзя** объявлять внутри `server { }` — только в `http` (например в `/etc/nginx/nginx.conf` или в подключаемом `conf.d/*.conf`).

Пример:

```nginx
proxy_cache_path /var/cache/nginx/pantera-uploads
    levels=1:2
    keys_zone=pantera_uploads:20m
    max_size=2g
    inactive=60d
    use_temp_path=off;
```

**Один раз** на сервере (пользователь процесса Nginx, обычно `www-data`):

```bash
sudo mkdir -p /var/cache/nginx/pantera-uploads
sudo chown -R www-data:www-data /var/cache/nginx/pantera-uploads
```

`max_size` / `keys_zone` / `inactive` — под нагрузку и свободное место.

### 2. Отдельный `location` в HTTPS-`server` (до общего `location /`)

Vhost: например [`/etc/nginx/sites-available/pantera-admin.conf`](vps-nginx-operations.md). В **443**-блоке добавьте **`location ^~ /uploads/`** **выше** общего `location / { … }`.

В вашем `location /` для админки часто стоит `proxy_buffering off`. **Для `proxy_cache` на ответ upstream буферизация должна быть включена** в этом `location` — поэтому вынос `/uploads/` в отдельный блок.

```nginx
location ^~ /uploads/ {
    proxy_pass http://127.0.0.1:1337;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;

    proxy_buffering on;

    proxy_cache pantera_uploads;
    proxy_cache_valid 200 301 365d;
    proxy_cache_key "$scheme$host$request_uri";
    proxy_cache_use_stale error timeout invalid_header updating http_500 http_502 http_503 http_504;
    # опционально, для отладки:
    # add_header X-Cache-Status $upstream_cache_status always;
}
```

`Upgrade` / `Connection` для WebSocket в `/uploads/` **не** нужны; админка остаётся в общем `location / { … }`.

### 3. Проверка и перезагрузка

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## См. также

- [vps-nginx-operations.md](vps-nginx-operations.md) — vhost, лимиты тела, certbot, правка под `root`/`sudo`.
- [what-is-nginx.md](what-is-nginx.md) — `nginx -t`, `nginx -T`, роли `root` и `deploy`.
