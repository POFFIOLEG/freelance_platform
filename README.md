# Freelance Platform

Веб-приложение для фриланс-платформы:
- backend: Django + Django REST Framework
- база данных: PostgreSQL
- администрирование БД: pgAdmin
- frontend: отдельное приложение в папке `frontend/`

## Структура проекта

- `backend/` — серверная часть Django
- `frontend/` — клиентская часть
- `docker-compose.yml` — запуск backend, PostgreSQL и pgAdmin

## Требования

- Docker Desktop (Windows/macOS) или Docker Engine + Docker Compose (Linux)
- Свободные порты: `5432` (PostgreSQL), `8000` (backend), `5050` (pgAdmin)

## Быстрый запуск через Docker

Из корня проекта:

```bash
docker compose up -d
```

После запуска будут доступны:
- backend: `http://localhost:8000`
- pgAdmin: `http://localhost:5050`

## Доступ к pgAdmin

Параметры входа:
- Email: `admin@admin.com`
- Password: `admin123`

### Подключение сервера PostgreSQL в pgAdmin

1. Открыть `http://localhost:5050`
2. Войти под учётными данными выше
3. Нажать **Register -> Server**
4. Заполнить:
   - **General / Name**: `freelance_db` (любое имя)
   - **Connection / Host name/address**: `db`
   - **Port**: `5432`
   - **Maintenance database**: `freelance_db`
   - **Username**: `freelance_user`
   - **Password**: `freelance_pass`
5. Сохранить

## Миграции Django

Вариант 1 (если сервисы уже подняты):

```bash
docker compose exec backend python manage.py migrate
```

Вариант 2 (разовый запуск контейнера):

```bash
docker compose run --rm backend python manage.py migrate
```

## Создание суперпользователя

```bash
docker compose exec backend python manage.py createsuperuser
```

## Полезные команды

Остановить проект:

```bash
docker compose down
```

Остановить и удалить тома БД:

```bash
docker compose down -v
```

Просмотр логов:

```bash
docker compose logs -f
```

## Переменные и параметры по умолчанию

В текущей конфигурации используются значения:
- DB: `freelance_db`
- DB user: `freelance_user`
- DB password: `freelance_pass`

При необходимости их можно изменить в `docker-compose.yml`.

## Локальный запуск backend без Docker (опционально)

Из папки `backend/`:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```
