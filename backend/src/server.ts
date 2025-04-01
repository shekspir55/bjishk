import express from 'express';
import path from 'path';
import morgan from 'morgan';
import cors from 'cors';
import fs from 'fs';
import * as TOML from '@iarna/toml';
import { Config } from './types';
import { setupDatabase } from './database';
import { setupMonitoringService } from './services/monitor';
import { setupFederationService } from './services/federation';
import { setupApiRoutes } from './routes';
import { logger } from './utils/logger';

// Logo to display at startup
const LOGO = "🩺բժիշկ";

interface TOMLConfig {
  name: string;
  admin_email: string;
  port: number;
  base_url: string;
  notification_key: string;
  services: Array<{
    url: string;
    email: string;
    check_interval: number;
  }>;
  peers: string[];
  monitoring?: {
    default_check_interval?: number;
    retries?: number;
    retry_delay?: number;
    peer_check_interval?: number;
  };
  email?: {
    smtp_host?: string;
    smtp_port?: number;
    smtp_user?: string;
    smtp_pass?: string;
    smtp_from?: string;
    smtp_tls?: boolean;
  };
  database?: {
    path?: string;
  };
  ui?: {
    refresh_interval?: number;
  };
}

// Read configuration from the .bjishk.toml file
const loadConfig = (): Config => {
  // Try multiple locations for the config file
  const possiblePaths = [
    path.resolve(process.cwd(), '.bjishk.toml'),            // Current working directory
    path.resolve(process.cwd(), '../.bjishk.toml'),         // Parent directory
    path.resolve(__dirname, '../../.bjishk.toml'),          // Project root when running from dist
    path.resolve(__dirname, '../../../.bjishk.toml')        // Project root when running from src
  ];
  
  let configPath = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      configPath = p;
      break;
    }
  }
  
  if (!configPath) {
    logger.error('Configuration file .bjishk.toml not found in any of the expected locations');
    logger.error('Searched in: ' + possiblePaths.join(', '));
    process.exit(1);
  }
  
  try {
    logger.info(`Loading configuration from ${configPath}`);
    const configFile = fs.readFileSync(configPath, 'utf-8');
    const parsedConfig = TOML.parse(configFile) as unknown as TOMLConfig;
    
    // Convert from TOML format to our Config interface
    const config: Config = {
      name: parsedConfig.name,
      adminEmail: parsedConfig.admin_email,
      port: parsedConfig.port,
      baseUrl: parsedConfig.base_url,
      notificationKey: parsedConfig.notification_key,
      services: (parsedConfig.services || []).map(service => ({
        url: service.url,
        email: service.email,
        checkInterval: service.check_interval,
      })),
      peers: parsedConfig.peers || [],
      monitoring: {
        defaultCheckInterval: parsedConfig.monitoring?.default_check_interval || 300,
        retries: parsedConfig.monitoring?.retries || 3,
        retryDelay: parsedConfig.monitoring?.retry_delay || 10,
        peerCheckInterval: parsedConfig.monitoring?.peer_check_interval || 60,
      },
      email: {
        smtpHost: parsedConfig.email?.smtp_host || '',
        smtpPort: parsedConfig.email?.smtp_port || 587,
        smtpUser: parsedConfig.email?.smtp_user || '',
        smtpPass: parsedConfig.email?.smtp_pass || '',
        smtpFrom: parsedConfig.email?.smtp_from || '',
        smtpTls: parsedConfig.email?.smtp_tls ?? true,
      },
      database: {
        path: parsedConfig.database?.path || './data/bjishk.sqlite',
      },
      ui: {
        refreshInterval: parsedConfig.ui?.refresh_interval || 30,
      },
    };
    
    return config;
  } catch (error) {
    logger.error('Failed to parse configuration file:', error);
    process.exit(1);
  }
};

// Main application initialization
async function startServer() {
  // Load configuration
  const config = loadConfig();
  
  // Create data directory if it doesn't exist
  const dataDir = path.dirname(config.database.path);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // Set up the database
  const db = await setupDatabase(config);
  
  // Initialize express app
  const app = express();
  
  // Middleware
  app.use(cors());
  app.use(morgan('dev'));
  app.use(express.json());
  
  // Set up API routes
  setupApiRoutes(app, config, db);
  
  // Serve static frontend assets
  app.use(express.static(path.join(__dirname, '../public')));
  
  // For any routes not matched by API or static files, return the main app HTML
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });
  
  // Start the server
  const server = app.listen(config.port, () => {
    // Display logo and server info
    console.log(`\n${LOGO} ${config.name}`);
    logger.info(`${LOGO} bjishk server started on port ${config.port}`);
    logger.info(`${LOGO} Web interface available at ${config.baseUrl}`);
    logger.info(`${LOGO} Instance name: ${config.name}`);
  });
  
  // Initialize monitoring service
  const monitoringService = setupMonitoringService(config, db);
  monitoringService.startMonitoring();
  
  // Initialize federation service
  const federationService = setupFederationService(config, db);
  federationService.startFederation();
  
  // Handle process termination
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      logger.info('HTTP server closed.');
      monitoringService.shutdown();
      federationService.shutdown();
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    logger.info('SIGINT received. Shutting down gracefully...');
    server.close(() => {
      logger.info('HTTP server closed.');
      monitoringService.shutdown();
      federationService.shutdown();
      process.exit(0);
    });
  });
}

// Start the server
startServer().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
}); 