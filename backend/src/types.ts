// Configuration interface for bjishk
export interface Config {
  name: string;
  adminEmail: string;
  port: number;
  baseUrl: string;
  notificationKey: string;
  services: Array<{
    url: string;
    email: string;
    checkInterval: number;
  }>;
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

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface StatusResponse {
  url: string;
  isUp: boolean;
  statusCode?: number;
  responseTime?: number;
  title?: string;
  lastChecked: string;
  error?: string;
}

export interface ServiceInfoResponse {
  url: string;
  email: string;
  checkInterval: number;
  latestStatus?: StatusResponse;
  uptime?: number;
}

export interface InstanceInfoResponse {
  name: string;
  version: string;
  services: number;
  peers: number;
}

export interface PeerStatusResponse {
  url: string;
  isUp: boolean;
  lastChecked: string;
  services?: number;
} 