# Bjishk Implementation Plan (Deno Server)

## Project Overview
Bjishk is a minimal, decentralized healthcheck/monitoring software that:
- Monitors website uptime
- Sends email notifications when services go down
- Federates with other Bjishk instances (peer-to-peer)
- Notifies peer admins when their instance goes down
- Uses SQLite for simplicity

## Technology Stack
- **Runtime**: Deno 2.x
- **Database**: SQLite (using `@db/sqlite` or `sqlite3`)
- **HTTP Client**: Deno native `fetch`
- **Email**: SMTP client (using `npm:nodemailer` or native implementation)
- **Config Parser**: TOML parser (using `@std/toml`)
- **Web Server**: Minimal HTTP server for federation API only (no UI)
- **Compilation**: `deno compile` for standalone binary

## Project Structure
```
bjishk/
├── deno.json                 # Deno configuration
├── main.ts                   # Entry point
├── src/
│   ├── config.ts            # Configuration loader (TOML parsing)
│   ├── database.ts          # SQLite database setup and queries
│   ├── monitor.ts           # Service monitoring logic
│   ├── notification.ts      # Email notification handler
│   ├── federation.ts        # Peer instance communication
│   ├── server.ts            # Minimal HTTP server for federation API
│   └── types.ts             # TypeScript types/interfaces
├── .bjishk.toml             # Main configuration
├── .services.toml           # Services to monitor
└── data/
    └── bjishk.sqlite        # SQLite database (auto-created)
```

## Implementation Steps

### Phase 1: Core Infrastructure
1. **Setup Deno Project**
   - Create `deno.json` with tasks and dependencies
   - Configure TypeScript settings
   - Setup compilation target

2. **Configuration Management** (`src/config.ts`)
   - Load and parse `.bjishk.toml`
   - Load and parse `.services.toml`
   - Validate configuration
   - Export typed configuration objects

3. **Database Layer** (`src/database.ts`)
   - Initialize SQLite database
   - Create tables:
     - `services` (id, url, name, check_interval, last_check, status, consecutive_failures)
     - `notifications` (id, service_id, timestamp, message, sent)
     - `peers` (id, url, admin_email, last_check, status)
     - `logs` (id, timestamp, service_id, status, response_time, message)
   - Implement CRUD operations
   - Auto-cleanup old logs based on `max_days_logs`

### Phase 2: Core Monitoring
4. **Service Monitor** (`src/monitor.ts`)
   - Implement health check logic:
     - HTTP GET request to service URL
     - Timeout handling
     - Retry logic with configurable retries/delays
     - Parse HTML title for service name
   - Track consecutive failures
   - Calculate response times
   - Update database with check results
   - Trigger notifications on status changes

5. **Notification System** (`src/notification.ts`)
   - SMTP email sender using configuration
   - Email templates for:
     - Service down notification
     - Service recovered notification
     - Peer instance down notification
   - Queue system to avoid spam
   - Track sent notifications in database

### Phase 3: Federation
6. **Peer Federation** (`src/federation.ts`)
   - Parse peer instances from config (`url:email` format)
   - Health check peer Bjishk instances
   - Endpoint: `GET /api/health` (returns JSON with instance status)
   - Notify peer admins when their instance is down
   - Sync mechanism (optional: share status data)

7. **HTTP Server** (`src/server.ts`)
   - Setup minimal HTTP server with routes:
     - `GET /api/health` - Health endpoint for federation (returns instance status)
   - No static files or UI (backend only)

### Phase 4: Main Application
8. **Entry Point** (`main.ts`)
   - Load configuration
   - Initialize database
   - Start HTTP server
   - Start monitoring loops:
     - Service monitoring (based on individual check_interval)
     - Peer monitoring (based on peer_check_interval)
   - Display startup message with peer connection string:
     ```
     📡 Add this to peer instances:
     http://localhost:3015:me@example.com
     ```
   - Graceful shutdown handling

9. **Types** (`src/types.ts`)
   - Define TypeScript interfaces:
     - `BjishkConfig`
     - `Service`
     - `Peer`
     - `NotificationLog`
     - `MonitorLog`
     - `HealthCheck`

### Phase 5: Compilation & Deployment
10. **Build Configuration**
    - Configure `deno compile` command in `deno.json`
    - Include necessary permissions:
      - `--allow-net` (HTTP requests and SMTP)
      - `--allow-read` (config files, database)
      - `--allow-write` (database, logs)
      - `--allow-env` (optional for overrides)
    - Target multiple platforms:
      - `--target x86_64-unknown-linux-gnu`
      - `--target x86_64-pc-windows-msvc`
      - `--target x86_64-apple-darwin`
      - `--target aarch64-apple-darwin`

11. **Compilation Script**
    ```bash
    deno compile \
      --allow-net \
      --allow-read \
      --allow-write \
      --allow-env \
      --output bjishk \
      main.ts
    ```

## Key Features Implementation Details

### Service Monitoring Algorithm
```typescript
async function checkService(service: Service): Promise<CheckResult> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const start = Date.now();
    try {
      const response = await fetch(service.url, {
        signal: AbortSignal.timeout(10000)
      });
      const responseTime = Date.now() - start;

      if (response.ok) {
        // Extract title from HTML for service name
        const html = await response.text();
        const title = html.match(/<title>(.*?)<\/title>/)?.[1];
        return { status: 'up', responseTime, title };
      }
    } catch (error) {
      if (attempt < retries) {
        await delay(retry_delay * 1000);
        continue;
      }
      return { status: 'down', error: error.message };
    }
  }
}
```

### Peer Connection Format
- Format: `url:email`
- Example: `http://թ.չոլ.հայ:3015:admin@example.com`
- Parse URL and email separately
- Use email to notify admin when peer is down

### Database Schema Considerations
- Use indexes on frequently queried columns (service_id, timestamp)
- Auto-increment IDs
- Cascade deletes for related records
- Store timestamps as ISO strings or Unix timestamps

## Configuration Files

### deno.json
```json
{
  "tasks": {
    "dev": "deno run --allow-net --allow-read --allow-write --allow-env main.ts",
    "compile": "deno compile --allow-net --allow-read --allow-write --allow-env --output bjishk main.ts"
  },
  "imports": {
    "@std/toml": "jsr:@std/toml@^1.0.0",
    "@db/sqlite": "jsr:@db/sqlite@^0.11.0"
  },
  "compilerOptions": {
    "strict": true,
    "lib": ["deno.window"]
  }
}
```

## Testing Strategy
1. Unit tests for each module
2. Integration tests for monitoring flow
3. Test federation between two local instances
4. Test email notifications (use mailtrap.io for testing)
5. Test database operations and cleanup
6. Load testing for multiple services

## Security Considerations
- Validate all URLs before fetching
- Sanitize HTML when extracting titles
- Rate limit health checks to avoid DDoS
- Secure email credentials (consider env vars)
- HTTPS for production deployments
- Authentication for admin API endpoints (future)

## Future Enhancements
- Web UI dashboard (HTML/CSS/JS frontend)
- Web UI for adding/removing services (currently only via .services.toml)
- Full REST API for service management
- Authentication/authorization for admin panel
- Webhook notifications (Discord, Slack, etc.)
- TCP/UDP port monitoring
- Keyword monitoring (check if specific text exists on page)
- Incident reports and uptime statistics
- Docker image distribution
- Status page generation (public URL showing uptime)

## Dependencies
```json
{
  "@std/toml": "Parse TOML configuration files",
  "@db/sqlite": "SQLite database driver",
  "npm:nodemailer": "SMTP email sending (or native implementation)"
}
```

## Compilation Output
- Binary name: `bjishk`
- Binary size: ~50-70MB (includes Deno runtime)
- Platform-specific binaries for distribution
- Single executable with no external dependencies

## Running the Compiled Binary
```bash
# After compilation
./bjishk

# Configuration files must be in the same directory:
# - .bjishk.toml
# - .services.toml

# Database will be created at configured path
```

## Development Workflow
1. Implement core modules (config, database, types)
2. Implement monitoring logic
3. Implement notification system
4. Implement federation
5. Implement minimal API server
6. Test thoroughly
7. Compile for target platforms
8. Distribute binaries

## Estimated Timeline
- Phase 1-2: 2-3 days (core infrastructure + monitoring)
- Phase 3: 1-2 days (federation + minimal API)
- Phase 4: 1 day (integration)
- Phase 5: 1 day (compilation & testing)
- **Total: ~5-7 days** for complete backend implementation

## Success Criteria
- ✅ Monitors services at configured intervals
- ✅ Sends email notifications on status changes
- ✅ Federates with peer instances
- ✅ Provides `/api/health` endpoint for federation
- ✅ Compiles to standalone binary
- ✅ Handles Unicode URLs with punycode (թ.չոլ.հայ)
- ✅ Auto-cleans old logs
- ✅ Graceful error handling and retries
