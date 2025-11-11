# BJISHK (բժիշկ)

> *բժիշկ* means "doctor" in Armenian

Lightweight, decentralized health monitoring. Services monitor each other peer-to-peer, sharing health status and alerts.

## Features

- 🔍 HTTP/HTTPS endpoint monitoring
- 🌐 Peer-to-peer federation
- 📧 Email notifications
- 🚀 Single 9.8MB binary
- 🐳 30MB Docker image

## Quick Start

```bash
# Binary
wget https://github.com/yourusername/bjishk/releases/latest/download/bjishk
chmod +x bjishk
./bjishk

# Docker
docker-compose up -d
```

## Configuration

**`.bjishk.toml`:**
```toml
name = "My Instance"
admin_email = "admin@example.com"
port = 3015
base_url = "http://your-server.com"

peer_instances = [
  "http://peer.example.com:3015:admin@peer.com"
]

[database]
path = "./data/bjishk.sqlite"

[email]
smtp_server = "smtp.gmail.com"
smtp_port = 587
smtp_user = "your@email.com"
smtp_password = "your-password"

[monitoring]
default_check_interval = 300
```

**`.services.toml`:**
```toml
[[services]]
url = "https://example.com"
check_interval = 300
```

## API

```
GET /api/health
```

Returns instance status and service statistics.

## Build

```bash
cd server
make release    # 9.8MB binary
make build      # dev build
```

## License

MIT
