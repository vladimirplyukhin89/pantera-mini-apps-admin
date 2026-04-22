# Работа с VPS (Beget), Nginx и Strapi

Краткий справочник по текущему деплою **Pantera Strapi** на VPS.

## Что к чему относится

- **Репозиторий на GitHub** — исходный код. На сервере лежит **клон** (например `/var/www/pantera-mini-apps-admin`).
- **URL** `https://admin.pantera-boxing.ru` — это адрес **уже запущенного** приложения за Nginx. Браузер не «открывает репозиторий», а ходит к процессу Strapi на VPS.
- Путь **`/admin`** — маршрут админки Strapi (не папка в `public_html` на shared-хостинге).

Обновления кода на проде: `git pull` на сервере (пользователь `deploy`) → сборка → перезапуск PM2.

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

git pull
npm ci
export NODE_OPTIONS=--max-old-space-size=3072
NODE_ENV=production npm run build
pm2 restart pantera-admin
pm2 save
```

## Nginx

Конфиг сайта (имя может совпадать):

- ` /etc/nginx/sites-available/pantera-admin.conf`
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

- **`pm2: command not found`** — не подгружен nvm: выполните `. "$HOME/.nvm/nvm.sh"`.
- **`deploy is not in the sudoers`** — системные команды только под `root` (`su -`).
- **403/404 вместо Strapi** — смотрите `sites-enabled`, не перехватывает ли запрос `default`; нужен `proxy_pass` на `127.0.0.1:1337` для `server_name admin.pantera-boxing.ru`.
- **HTTPS не открывается** — нет сертификата или nginx не слушает 443: `certbot --nginx`, затем `ss -ltnp | grep ':443'`.
