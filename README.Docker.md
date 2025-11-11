# Docker Deployment Guide

## Quick Start

### Build and run with Docker Compose
```bash
docker-compose up -d
```

### View logs
```bash
docker-compose logs -f bjishk
```

### Stop the service
```bash
docker-compose down
```

## Manual Docker Commands

### Build the image
```bash
cd server
docker build -t bjishk:latest .
```

### Run the container
```bash
docker run -d \
  --name bjishk \
  -p 3015:3015 \
  -v $(pwd)/.bjishk.toml:/app/.bjishk.toml:ro \
  -v $(pwd)/.services.toml:/app/.services.toml:ro \
  -v $(pwd)/data:/app/data \
  bjishk:latest
```

## Configuration

The container expects the following files to be mounted:
- `.bjishk.toml` - Main configuration file (read-only)
- `.services.toml` - Services to monitor (read-only)
- `./data/` - SQLite database directory (read-write)

## Image Details

- **Base image**: Alpine Linux (minimal)
- **Final size**: ~15-20 MB
- **User**: Non-root user `bjishk` (UID 1000)
- **Port**: 3015 (configurable in .bjishk.toml)
- **Health check**: Enabled on `/api/health`

## Environment Variables

Optional environment variables:
- `TZ` - Timezone (default: UTC)

## Multi-platform Build

Build for multiple architectures:
```bash
docker buildx build --platform linux/amd64,linux/arm64 -t bjishk:latest .
```

## Production Deployment

### With resource limits
```yaml
deploy:
  resources:
    limits:
      cpus: '0.5'
      memory: 256M
```

### With restart policy
```bash
docker run -d --restart=unless-stopped ...
```

## Troubleshooting

### Check container logs
```bash
docker logs bjishk
```

### Shell into container
```bash
docker exec -it bjishk /bin/sh
```

### Check health status
```bash
docker inspect --format='{{.State.Health.Status}}' bjishk
```
