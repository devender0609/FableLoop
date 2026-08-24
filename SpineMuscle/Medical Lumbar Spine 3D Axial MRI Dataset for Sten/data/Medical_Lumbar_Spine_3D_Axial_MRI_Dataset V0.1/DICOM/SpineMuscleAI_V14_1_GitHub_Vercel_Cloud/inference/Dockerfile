FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    SPINEMUSCLE_WORKDIR=/tmp/spinemuscle

RUN apt-get update && apt-get install -y --no-install-recommends \
    git dcm2niix build-essential libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN python -m pip install --upgrade pip && \
    pip install -r /app/requirements.txt

# Install the official open-source MuscleMap toolbox.
RUN git clone --depth 1 https://github.com/MuscleMap/MuscleMap.git /opt/MuscleMap && \
    pip install -e /opt/MuscleMap

COPY app.py /app/app.py

EXPOSE 8080

CMD ["sh","-c","uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080}"]
