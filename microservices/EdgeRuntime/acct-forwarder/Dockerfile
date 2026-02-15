FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for psycopg2 and clickhouse-driver
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libpq-dev gcc && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY forwarder.py .

# Run as non-root
RUN useradd -r -s /bin/false appuser
USER appuser

CMD ["python", "-u", "forwarder.py"]
