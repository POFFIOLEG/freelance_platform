# Taskora / Freelance Platform

Платформа для заказчиков и исполнителей: публикация и каталог заданий, отклики и назначение, сдача результата и приёмка, доработки и снятие исполнителя, чат по сделке (только при активном назначении), уведомления в шапке (опрос API + WebSocket), портфолио, отзывы, модерация, календарь дедлайнов, биржа и конкурсы, демо-баланс при завершении сделки.

---

## Стек

| Часть | Технологии |
|--------|------------|
| Backend | Python 3.12 (рекомендуется), Django 5.1, Django REST Framework 3.15, Django Channels 4.2 + Daphne (ASGI, WebSocket), SQLite по умолчанию или PostgreSQL через `DATABASE_URL` |
| Frontend | React 19, Vite 6, React Router 7 |
| Инфраструктура (опционально) | Docker Compose (PostgreSQL 16, pgAdmin, backend в контейнере) |

Корневые URL API см. в `backend/config/urls.py` — префиксы `/api/auth/`, `/api/jobs/`, `/api/chat/`, `/api/reviews/`, `/api/hub/`.

---

## Что нужно на новом устройстве перед запуском

| Компонент | Минимум |
|-----------|---------|
| Git | для клонирования репозитория |
| Python | 3.11 или 3.12 (в Docker-образе backend указан 3.12) |
| Node.js | 20 LTS или новее (для Vite 6) |
| npm | идёт вместе с Node |

**Windows.** Если PowerShell блокирует активацию venv, выполните один раз для текущего пользователя:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**macOS / Linux.** Дополнительно может понадобиться пакет для сборки `psycopg2` только если вы ставите PostgreSQL локально (заголовки `libpq`).

---

## Запуск на новом устройстве (без Docker, пошагово)

### Шаг 0. Клонирование

```bash
git clone <url-вашего-репозитория>
cd freelance_platform
```

Дальше два терминала: один для backend, второй для frontend.

---

### Шаг 1. Backend — виртуальное окружение и зависимости

```bash
cd backend
python -m venv .venv
```

**Windows (PowerShell), из папки `backend`:**

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

**macOS / Linux:**

```bash
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

---

### Шаг 2. Backend — переменные окружения

В папке `backend` создайте файл `.env` (его не нужно коммитить с секретами). Пример для локальной разработки:

```env
DJANGO_SECRET_KEY=замените-на-длинную-случайную-строку
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0
```

Если фронт открываете не с `localhost:5173`, добавьте строки (через запятую, без пробелов вокруг):

```env
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
CSRF_TRUSTED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

**PostgreSQL вместо SQLite** (опционально):

```env
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DBNAME
```

Без `DATABASE_URL` используется файл `backend/db.sqlite3`.

---

### Шаг 3. Backend — миграции и суперпользователь

Из активированного venv, всё ещё в `backend`:

```bash
python manage.py migrate
python manage.py createsuperuser
```

Админка будет доступна по адресу `http://127.0.0.1:8000/admin/` после запуска сервера.

---

### Шаг 4. Backend — запуск сервера

Из папки `backend`:

```bash
python manage.py runserver 0.0.0.0:8000
```

В `INSTALLED_APPS` первым указан `daphne`, поэтому команда `runserver` в типичной конфигурации Channels обслуживает **и HTTP, и WebSocket** на порту `8000`. Корень API: `http://127.0.0.1:8000/` (список префиксов отдаёт JSON на `/`).

Если уведомления по WebSocket не доходят, запустите явно ASGI (из папки `backend`, venv активен):

```bash
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

---

### Шаг 5. Frontend — зависимости

Новый терминал, из корня репозитория:

```bash
cd frontend
npm install
```

---

### Шаг 6. Frontend — адрес API

Создайте файл `frontend/.env` или `frontend/.env.local`:

```env
VITE_API_URL=http://127.0.0.1:8000
```

Адрес **без** завершающего слэша. Если backend на другой машине в LAN, укажите её IP и порт, и добавьте этот origin в `CORS_ALLOWED_ORIGINS` и `CSRF_TRUSTED_ORIGINS` в `backend/.env`.

После изменения `.env` перезапустите `npm run dev`.

---

### Шаг 7. Frontend — dev-сервер

```bash
npm run dev
```

Откройте в браузере URL из вывода Vite (часто `http://localhost:5173`). Зарегистрируйте пользователей или создайте их в админке, назначьте роли (заказчик / исполнитель) по задумке сценария.

**Продакшен-сборка локально:**

```bash
npm run build
npm run preview
```

---

## Запуск через Docker Compose

Из **корня** репозитория (где лежит `docker-compose.yml`):

```bash
docker compose up -d --build
```

Поднимаются:

- **PostgreSQL** — порт `5432` (логин/пароль/БД см. в `docker-compose.yml`)
- **Backend** — порт `8000`, при старте выполняются `pip install`, `migrate`, `runserver`
- **pgAdmin** — порт `5050`, учётные данные по умолчанию в `docker-compose.yml`

**Фронтенд в compose не поднимается** — его нужно запустить на машине так же, как в шагах 5–7, указав в `frontend/.env`:

```env
VITE_API_URL=http://127.0.0.1:8000
```

Если браузер на хосте, а API в контейнере, `8000` проброшен на localhost — этого достаточно.

Просмотр логов backend:

```bash
docker compose logs -f backend
```

---

## WebSocket и уведомления

- Канал уведомлений: `ws://<хост-api>/ws/notify/?token=<токен>` (в dev токен передаётся в query для простоты; для публичного продакшена такой способ не рекомендуется без доработки).
- Слой каналов по умолчанию: `InMemoryChannelLayer` в `settings.py` — достаточно для одного процесса разработки. Для нескольких воркеров или продакшена обычно подключают Redis.
- На фронте опрос дашборда и снимки в `localStorage` дополняют сокет (см. `frontend/src/utils/platformNotifications.js`, `frontend/src/components/Navbar.jsx`, `frontend/src/hooks/useNotifySocket.js`).
- Событие `job-notify-live` на `window` обновляет открытую карточку задания при назначении, сдаче, доработке и снятии исполнителя (см. `frontend/src/pages/JobDetails.jsx`).

---

## Переменные окружения (справочник)

| Переменная | Назначение |
|------------|------------|
| `DJANGO_SECRET_KEY` | Секрет Django; обязателен к замене вне dev |
| `DJANGO_DEBUG` | `true` в разработке, **`false` на продакшене** |
| `DJANGO_ALLOWED_HOSTS` | Список хостов через запятую; в `DEBUG` к списку может добавляться `*` (см. `settings.py`) |
| `DATABASE_URL` | PostgreSQL; если не задан — SQLite `db.sqlite3` |
| `CORS_ALLOWED_ORIGINS` | Разрешённые origins фронта (через запятую) |
| `CSRF_TRUSTED_ORIGINS` | Доверенные origins для CSRF (через запятую) |
| `VITE_API_URL` | Базовый URL API для фронта **без** слэша в конце |

---

## Обзор функциональности (актуально по коду)

**Учётные записи и профиль**

- Регистрация и вход, токен DRF, эндпоинт `me`, профиль, смена роли заказчик/исполнитель.
- Аватар, обложка карточки на главной, портфолио, KYC-документы, публичное портфолио по `/u/:id/portfolio`.
- **Демо-баланс** (`demo_balance` в профиле) — при приёмке работы с баланса заказчика условно списывается сумма и зачисляется исполнителю (не платёжный шлюз).

**Задания**

- Публикация с валидацией полей, категории и подкатегории (константы на фронте согласованы с фильтрами каталога).
- Каталог с фильтрами, сохранённые поиски, типы заказ/биржа/конкурс, избранное в `localStorage` по id пользователя.
- Отклик, назначение исполнителя, сдача результата (в т.ч. вложения), статусы задания `draft` → `open` → `in_progress` → `submitted` → `completed` и др. (см. `Job.Status` в `backend/jobs/models.py`).
- Приёмка: принять, вернуть на доработку, снять исполнителя; при снятии удаляются все сдачи этого исполнителя по заданию.
- Заказчик в блоке проверки видит **только последнюю** сдачу текущего исполнителя (остальные версии скрыты на UI).

**Уведомления в шапке**

- Отклики, сдача на проверку, назначение исполнителя, возврат на доработку, снятие исполнителя, чат, напоминание об отзыве — через опрос API и снимки в `localStorage`.
- Push по WebSocket для части событий (назначение, сдача заказчику, доработка, снятие) для быстрой реакции UI.

**Чат**

- Привязан к заданию. Доступен **только пока у задания назначен исполнитель** (`assigned_to`). После снятия исполнителя API возвращает 403, в списке чатов на фронте такие задания не показываются.

**Прочее**

- Отзывы, модерация, календарь (в т.ч. экспорт), споры/арбитраж и этапы по коду в приложении `jobs` и связанных страницах.
- Обработка ошибок API в едином клиенте (`frontend/src/api/client.js`, класс `ApiError`).

---

## Полезные команды

```bash
# Backend (из папки backend, venv активен)
python manage.py createsuperuser
python manage.py makemigrations
python manage.py migrate
python manage.py check

# Frontend (из папки frontend)
npm run lint
npm run build
```

---

## Типичные проблемы при первом запуске

| Симптом | Что проверить |
|---------|----------------|
| CORS error в консоли браузера | `CORS_ALLOWED_ORIGINS` и точный origin (порт 5173 vs 5174) |
| 403 на POST при логине с другого origin | `CSRF_TRUSTED_ORIGINS` |
| WebSocket не соединяется | Backend на ASGI (`runserver` с daphne в `INSTALLED_APPS` или явный `daphne`); один процесс с InMemory channel layer |
| `Activate.ps1` заблокирован | `Set-ExecutionPolicy RemoteSigned` для CurrentUser |
| Ошибка при `migrate` в Docker | `docker compose logs backend` — часто нужен актуальный `requirements.txt` в образе |

---

## Лицензия и контакты

Укажите лицензию и контакты автора при публикации репозитория.
