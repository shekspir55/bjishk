# BJISHK (բժիշկ)

> *բժիշկ* means "doctor" in Armenian

Lightweight health monitoring for services and bjishk instances with a clean dashboard.

![Bjishk monitoring bjishk instances](image/bjishkner.png)

## Features

- Monitor HTTP/HTTPS endpoints
- Visual status history dashboard
- Auto-refresh every 30s
- Single 9.8MB Go binary
- Docker support

## Quick Start

```bash
# Run with Go
cd server && go build -o ../bjishk ./cmd/bjishk && cd .. && ./bjishk

# Run with Docker
docker build -t bjishk .
docker run -p 3015:3015 -v ./data:/app/data bjishk
```

## Configuration

**`bjishk.toml`:**
```toml
name = "Բժիշկ Ստեփանավանի"
caregiver = "me@example.com"
port = 3015
base_url = "http://localhost:3015"
max_days_logs = 30

[email]
smtp_host = "smtp.gmail.com"
smtp_port = 587
smtp_user = "me@gmail.com"
smtp_pass = "app-password-here"
smtp_from = "me@gmail.com"
smtp_tls = true

[database]
path = "./data/bjishk.sqlite"

[monitoring]
default_check_interval = 300
retries = 3
retry_delay = 10
peer_check_interval = 60

[ui]
refresh_interval = 30
```

**`patients.toml`:**
```toml
[[patients]]
url = "https://թ.չոլ.հայ/"
check_interval = 300
caregiver = ""  # Optional: email for notifications

[[patients]]
url = "http://localhost:3015/api/health"  # Other bjishk instances
caregiver = "me@example.com"
```

## API

`GET /api/health` - Instance status and stats

`GET /api/patients?start=<ISO8601>&end=<ISO8601>` - Patient logs

`GET /api/config` - UI configuration

## Build

```bash
cd server
go build -ldflags="-s -w" -o ../bjishk ./cmd/bjishk  # 9.8MB

cd ../client
npm install && npm run build
```

## License

MIT
