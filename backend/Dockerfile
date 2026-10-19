# Build from the repository root:  docker build -f backend/Dockerfile -t portfolio-api .
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv/backend

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ /srv/backend/
COPY content/ /srv/content/

RUN useradd --create-home app && chown -R app /srv
USER app

EXPOSE 8000
# Migrations run on startup (see app/main.py). Use $PORT when the host sets it.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
