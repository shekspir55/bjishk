# bjishk - Distributed Federated Healthcheck System

bjishk is a distributed, federated healthcheck system built with Node.js. It allows users to monitor their web services while collaborating with trusted peers to create a decentralized monitoring network.

## Features

- **Decentralized Resilience**: The network continues monitoring even when individual bjishk instances go down
- **Federated Monitoring**: Connect with trusted peers to establish a distributed monitoring network
- **Service Health Monitoring**: Regularly check if services return 200 HTTP status codes
- **Automatic Service Name Detection**: Service names are automatically extracted from page titles
- **Single Notification Policy**: Only one notification is sent per downtime incident until service recovers
- **Email Notifications**: Receive alerts when your services go down or when a peer instance goes down
- **Historical Data Storage**: All uptime/downtime data is stored for analysis and visualization
- **Web Interface with Timelines**: View current status and historical uptime charts for all services
- **TypeScript End-to-End**: Full type safety from backend to frontend
- **TOML Configuration**: Simple, human-readable configuration using TOML
- **One-way Peer Relationships**: Add peers without requiring them to add you back
- **SQLite Storage**: Uses SQLite for data persistence to simplify setup and deployment

## Quick Start

### Prerequisites

- Node.js 18 or higher
- npm

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/bjishk.git
   cd bjishk
   ```

2. Create a `.bjishk.toml` file in the root directory with your configuration (see Configuration section below).

3. Install dependencies and build both frontend and backend:
   ```
   # Install backend dependencies
   cd backend
   npm install
   cd ..
   
   # Install frontend dependencies
   cd frontend
   npm install
   npm run build
   cd ..
   ```

4. Start the server:
   ```
   cd backend
   npm start
   ```

5. Visit `http://localhost:3015` (or your configured URL) to access the web interface.

### Docker Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/bjishk.git
   cd bjishk
   ```

2. Create a `.bjishk.toml` file in the root directory with your configuration.

3. Build and run with Docker:
   ```
   docker build -t bjishk .
   docker run -d -p 3015:3015 -v $(pwd)/.bjishk.toml:/app/.bjishk.toml -v $(pwd)/data:/app/data --name bjishk bjishk
   ```

### Docker Compose Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/bjishk.git
   cd bjishk
   ```

2. Create a `.bjishk.toml` file in the root directory with your configuration.

3. Use the provided Makefile for easy management:
   ```
   # Build the Docker image
   make build
   
   # Start the containers in detached mode
   make up
   
   # Or start in development mode (with logs to console)
   make dev
   
   # View logs
   make logs
   
   # Stop the containers
   make down
   
   # Update, rebuild, and restart
   make deploy
   ```

4. Or manually with Docker Compose:
   ```
   # Build and start
   docker compose up -d
   
   # Stop
   docker compose down
   ```

5. Visit `http://localhost:3015` to access the web interface.

## Configuration

bjishk uses a TOML file (`.bjishk.toml`) for configuration. Here's a sample configuration file:

```toml
# Basic instance setup
name = "my-first-bjishk"
admin_email = "me@example.com"
port = 3015
base_url = "http://localhost:3015"
notification_key = "random-string-for-coordination"

# My services to monitor (URL is the unique identifier, names auto-fetched from page titles)
[[services]]
url = "https://example.com"
email = "me@example.com"
check_interval = 300

[[services]]
url = "https://example.org"
email = "me@example.com"
check_interval = 120

# Peer instances (just the URLs)
peers = [
  "https://bjishk.example.org"
]

# Email for notifications
[email]
smtp_host = "smtp.gmail.com"
smtp_port = 587
smtp_user = "me@gmail.com"
smtp_pass = "app-password-here"
smtp_from = "me@gmail.com"
smtp_tls = true

# Database path (SQLite)
[database]
path = "./data/bjishk.sqlite"
```

## Development

### Backend

```bash
cd backend
npm install
npm run dev
```

The backend will start on port 3015 (or your configured port).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend development server will start on port 5173 and will proxy API requests to the backend.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 