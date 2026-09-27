# Mintaly

Тёмный адаптивный сайт с лаунчер-подписками: регистрация с подтверждением email, форум,
новости, тикеты, redeem-ключи, HWID-привязка, защищённые загрузки и панель разработчика.

Стек: **React 19 + TypeScript + Vite + Tailwind** (фронтенд) и **Node.js (Express ESM) + MySQL/MariaDB** (бэкенд).

---

## 1. Требования

- Node.js 20+
- MySQL 8 или MariaDB 10.6+

## 2. Установка

```bash
npm install
```

## 3. Настройка

Создайте `server/.env` (шаблон — `server/.env.example`) и `DATABASE`:

```sql
CREATE DATABASE mintaly CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Минимально нужные значения:

```ini
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=secret
DB_NAME=mintaly
PORT=8000
```

Для фронтенда — `.env` в корне:

```ini
VITE_API_URL=http://localhost:8000
```

`VITE_API_URL` может быть пустым, если фронтенд и API на одном домене
(в продакшене Express отдаёт `dist/` сам).

## 4. Импорт базы и запуск

```bash
npm run db:import          # создаст таблицы и заполнит планы/разделы/настройки
npm run user:create -- --name=Dev --email=dev@example.com --password=secret123 --dev
npm run dev                # API :8000 + Vite :5173
```

Продакшен:

```bash
npm run build              # сборка фронтенда в dist/
npm start                  # Express отдаёт API и dist/
```

## 5. CLI

```bash
# пользователь (создать или обновить)
npm run user:create -- --name=Dev --email=dev@example.com --password=secret123 --dev --subdays=30

# лицензионные ключи
npm run key:create -- --sub=2 --count=5
npm run key:create -- --sub=2 --count=1 --days=90 --note="reseller"

# повторный импорт схемы
npm run db:import -- --file=./schema.sql
```

## 6. Как работает API

Один endpoint — `POST /` (и `POST /api` как алиас):

```jsonc
// запрос
{ "action": "auth", "email": "user@example.com", "password": "secret123" }

// успех
{ "success": true, "status": "success", "message": "Вход выполнен", "token": "…" }

// бизнес-ошибка (HTTP 200)
{ "success": false, "status": "error", "message": "Неверный email или пароль" }
```

Ошибки доступа возвращаются с HTTP 401/403/503. Список всех действий — `GET /actions`,
состояние БД — `GET /health`.

Токен хранится в `users.token` и передаётся как `Authorization: Bearer <token>`.
Выход и смена пароля обнуляют токен, поэтому старые сессии перестают работать.

### Уровни доступа

| Уровень | Что входит |
| --- | --- |
| `public` | `reg`, `auth`, `forgot_password`, `reset_password`, `resend_verify`, `settings_get` |
| `any` (нужен вход) | `logout`, `verify_email` |
| `user` (вход + подтверждённый email) | профиль, форум, новости, тикеты, redeem, сброс HWID, покупка |
| `sub` (активная подписка) | `downloads_list`, `download_token` |
| `dev` (`users.dev = 1`) | все `admin_*`, `ban`, `unban`, `balance_add`, `admin_sub_*`, `admin_download_*`, `admin_key_*`, `admin_news_*`, `admin_orders`, `admin_order_status`, `admin_tickets`, `admin_ticket_*`, `admin_logs`, `admin_stats`, `admin_settings_update` |

## 7. Скачивание файлов

1. Клиент вызывает `download_token` → получает одноразовый токен (TTL 15 минут).
2. Браузер открывает `GET /download?token=<64 hex>`.
3. Сервер проверяет: токен существует, не использован, не истёк, аккаунт не забанен,
   подписка активна, IP и User-Agent совпадают.
4. Токен сразу помечается использованным, файл отдаётся из `STORAGE_DIR`.
   В ответе есть заголовок `X-Checksum-Sha256`, чтобы клиент мог проверить архив.

Настоящее имя файла клиенту не отдаётся. В списке у пользователя показываются только
опубликованные сборки, архив которых реально лежит на диске.

### Как выпустить сборку

1. Положите архив в папку `STORAGE_DIR` (по умолчанию `./storage`), имя файла —
   латиница, цифры, `.`, `_`, `-` (например `mintaly-loader-1.0.1.zip`).
2. В админке откройте вкладку **Сборки** → **Добавить сборку**: укажите название,
   версию, имя файла, changelog и при необходимости сразу опубликуйте.
3. Размер и SHA-256 считаются автоматически из файла на сервере. Если файла ещё нет,
   сборку можно создать скрытой — она появится в списке, как только архив загружен.

Удаление сборки из списка не трогает файл на диске и удаляет её выданные токены.

## 8. Письма

Если SMTP не настроен, коды печатаются в консоль и пишутся в `server/logs/mail.log` —
это удобно для разработки. Для боевого режима заполните `SMTP_*` в `server/.env`.

Коды: 6 цифр, TTL 15 минут, не более 5 попыток, старые коды инвалидируются.

## 9. Правила сервиса

- Ник: 4–32 символа, буквы/цифры/пробел/`_.-`
- Пароль: от 6 символов, хранится как PBKDF2-SHA512 (210k итераций)
- Ключ активации: ровно 64 символа `[A-Za-z0-9]`, одна попытка в час (настраивается),
  недоступен при активной подписке
- Сброс HWID: раз в `hwid_reset_days` дней (по умолчанию 30)
- Бан блокирует вход и все действия кроме подтверждения email

## 10. Структура

```
schema.sql                 таблицы + начальные данные
tailwind.config.js         не используется: Tailwind v4 настроен в src/index.css
server/
  index.js                 Express, CORS, единый action endpoint, статика
  config.js                чтение .env
  db.js                    MySQL pool, query, transaction
  auth.js                  resolveUser, requireAuth/requireSub/requireDev
  helpers.js               пароли, коды, валидаторы, даты, пагинация
  mailer.js                Nodemailer + файловый fallback
  settings-store.js        кэш настроек сайта
  downloads.js             GET /download?token=
  actions/
    index.js               реестр действий и уровни доступа
    auth.js  user.js  content.js  subscriptions.js  support.js  admin.js
  scripts/                 createUser, createKey, importSql
storage/                   архивы сборок (STORAGE_DIR, не в git)
src/
  api/client.ts            все вызовы API
  context/AuthContext.tsx  сессия
  components/Layout.tsx    сайдбар, шапка, футер
  pages/                   все страницы
```

## 11. Настройки сайта

Значения хранятся в таблице `settings` и редактируются в админке → «Настройки»:
название сайта, открытость регистрации/форума, режим обслуживания, интервалы
HWID/redeem и тексты соглашения и возврата (`/settings?page=terms|refund`).
"# mintalyS" 
