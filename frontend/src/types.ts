// Frontend types

// Service object representing a monitored service
export interface Service {
  url: string;
  name?: string;
  email: string;
  check_interval: number;
  status?: 'up' | 'down' | 'unknown';
  last_check_time?: string; 
  response_time?: number;
}

// Peer instance info
export interface Peer {
  url: string;
  name?: string;
  status: 'up' | 'down' | 'unknown';
  last_check_time?: string;
}

// Peer service
export interface PeerService {
  id: number;
  peer_url: string;
  service_url: string;
  name?: string;
  status: 'up' | 'down' | 'unknown';
  last_check_time?: string;
  response_time?: number;
}

// Historical check record
export interface CheckRecord {
  id: number;
  service_url: string;
  timestamp: string;
  status: 'up' | 'down';
  response_time?: number;
  source: 'local' | 'peer';
  peer_url?: string;
}

// Notification record
export interface Notification {
  id: number;
  timestamp: string;
  service_url: string;
  peer_url?: string;
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

// Configuration from server
export interface Config {
  name: string;
  refreshInterval: number;
}

// Chart data format for service history
export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    fill: boolean;
  }>;
} 