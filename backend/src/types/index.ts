// Shared type definitions for the bjishk healthcheck system

// Service object representing a monitored service
export interface Service {
  url: string;
  name?: string; // Optional as it may be auto-fetched from page title
  email: string;
  checkInterval: number;
  status?: 'up' | 'down' | 'unknown'; // Current status of the service
  lastCheckTime?: Date; // Last time the service was checked
  responseTime?: number; // Response time in ms
}

// Configuration for the bjishk instance
export interface Config {
  name: string;
  adminEmail: string;
  port: number;
  baseUrl: string;
  notificationKey: string;
  services: Service[];
  peers: string[];
  monitoring: {
    defaultCheckInterval: number;
    retries: number;
    retryDelay: number;
    peerCheckInterval: number;
  };
  email: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    smtpFrom: string;
    smtpTls: boolean;
  };
  database: {
    path: string;
  };
  ui: {
    refreshInterval: number;
  };
}

// Historical check record
export interface CheckRecord {
  id?: number;
  serviceUrl: string;
  timestamp: Date;
  status: 'up' | 'down';
  responseTime?: number;
  source: 'local' | 'peer';
  peerUrl?: string;
}

// Peer instance info
export interface PeerInstance {
  url: string;
  name?: string;
  status: 'up' | 'down' | 'unknown';
  lastCheckTime?: Date;
  services?: Service[];
}

// Notification record
export interface Notification {
  id?: number;
  timestamp: Date;
  serviceUrl: string;
  peerUrl?: string;
  recipient: string;
  status: 'up' | 'down';
}

// Dashboard summary data
export interface DashboardSummary {
  totalServices: number;
  servicesUp: number;
  servicesDown: number;
  totalPeers: number;
  peersUp: number;
  peersDown: number;
  recentIncidents: Notification[];
}

// Status change event sent to peers
export interface StatusChangeEvent {
  serviceUrl: string;
  timestamp: Date;
  status: 'up' | 'down';
  responseTime?: number;
  sourcePeer: string;
  notificationKey: string;
}

// Service history with uptime data
export interface ServiceHistory {
  serviceUrl: string;
  serviceName?: string;
  data: Array<{
    timestamp: Date;
    status: 'up' | 'down';
    responseTime?: number;
  }>;
  uptimePercentage: number;
} 