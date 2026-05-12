# Taskora / Freelance Platform

Платформа для заказчиков и исполнителей: задания, отклики, чат, портфолио, отзывы, модерация, календарь дедлайнов.

## Стек

| Часть | Технологии |
|--------|------------|
| Backend | Django 5, Django REST Framework, Channels (WebSocket), SQLite по умолчанию или PostgreSQL через `DATABASE_URL` |
| Frontend | React 19, Vite 6, React Router 7 |
| Опционально | Docker Compose (PostgreSQL + pgAdmin) |

---

## Запуск на новом устройстве (без Docker)

### 1. Клонирование и ветка

```bash
git clone <url-репозитория>
cd freelance_platform
```

### 2. Backend

```bash
cd backend
python -m venv .venv
```

**Windows (PowerShell):**

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**macOS / Linux:**

```bash
source .venv/bin/activate
pip install -r requirements.txt
```

При необходимости создайте файл `backend/.env` (не коммитьте секреты в открытый репозиторий):

```env
DJANGO_SECRET_KEY=случайная-длинная-строка
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
```

Для PostgreSQL вместо SQLite добавьте строку подключения:

```env
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DBNAME
```

Примените миграции и запустите сервер:

```bash
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

API будет доступен по адресу **http://127.0.0.1:8000/**  
Админка: **http://127.0.0.1:8000/admin/** (создайте пользователя: `python manage.py createsuperuser`).

### 3. Frontend

В новом терминале:

```bash
cd frontend
npm install
```

Создайте `frontend/.env` (или `.env.local`), чтобы браузер обращался к вашему backend:

```env
VITE_API_URL=http://127.0.0.1:8000
```

Запуск dev-сервера:

```bash
npm run dev
```

Откройте в браузере адрес из вывода Vite (обычно **http://localhost:5173**).

Сборка продакшена:

```bash
npm run build
npm run preview
```

---

## Запуск через Docker Compose

Из корня проекта:

```bash
docker compose up -d
```

Затем миграции:

```bash
docker compose exec backend python manage.py migrate
```

Порты по умолчанию смотрите в `docker-compose.yml` (часто backend `:8000`, pgAdmin `:5050`, PostgreSQL `:5432`).

Подключение к БД в pgAdmin и типовые учётные данные — см. комментарии в `docker-compose.yml` и предыдущие версии этого README.

---

## Переменные окружения (кратко)

| Переменная | Назначение |
|------------|------------|
| `DJANGO_SECRET_KEY` | Секрет Django |
| `DJANGO_DEBUG` | `true` в разработке, **`false` на продакшене** |
| `DJANGO_ALLOWED_HOSTS` | Список хостов через запятую |
| `DATABASE_URL` | PostgreSQL (если не используете SQLite) |
| `CORS_ALLOWED_ORIGINS` | Origins фронта, например `http://localhost:5173` |
| `VITE_API_URL` | Базовый URL API для фронта (без слэша в конце) |

---

## Что сделано по проекту (обзор функций)

- **Учётные записи и профиль**: регистрация, роли заказчик/исполнитель, профиль, аватар, поле **баннера карточки на главной** (`card_cover`), портфолио работ с файлами.
- **Задания**: публикация, фильтры и сохранённые поиски, отклики, назначение исполнителя, ссылка на публичное портфолио из отклика.
- **Чат по заданию**: список диалогов, сообщения с **несколькими вложениями** (до 12 файлов, до 10 МБ каждый), скрепка в **правом верхнем углу** области чата, прокрутка истории.
- **Главная страница**: блок исполнителей в слотах, карточки с текстом, аватаром и **изображением карточки**, значок **верификации** для проверенных пользователей.
- **Отзывы и рейтинг**: лента отзывов, топ исполнителей по рейтингу (API).
- **Верификация (KYC)**: загрузка документов, статус профиля; у верифицированных отображается значок (главная, шапка сайта, профиль).
- **Календарь**: ICS-экспорт этапов и напоминаний (исправлена совместимость с актуальным Django для UTC).
- **Обработка ошибок API**: единый JSON для ошибок `/api/*`, без HTML-страниц в клиенте при сбоях.

Подробности по отдельным модулям — в коде сериализаторов и страниц `frontend/src/pages/`.

---

## Полезные команды

```bash
# Django: создать суперпользователя
python manage.py createsuperuser

# Django: новые миграции после изменения моделей
python manage.py makemigrations
python manage.py migrate

# Frontend: линтер
cd frontend && npm run lint
```

---

## Лицензия и контакты

Уточните лицензию и контакты владельца репозитория при публикации проекта.
