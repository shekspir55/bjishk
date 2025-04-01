// Frontend types

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  error?: string;
}

// Service types
export interface Service {
  url: string;
  email: string;
  checkInterval: number;
}

export interface StatusResponse {
  url: string;
  isUp: boolean;
  statusCode: number | null;
  responseTime: number | null;
  title: string | null;
  lastChecked: string;
  error: string | null;
}

export interface ServiceWithStatus extends Service {
  latestStatus?: StatusResponse;
  uptime?: number;
}

// Dashboard types
export interface DashboardSummary {
  totalServices: number;
  servicesUp: number;
  servicesDown: number;
  totalPeers: number;
  peersUp: number;
  peersDown: number;
  recentIncidents: RecentIncident[];
}

export interface RecentIncident {
  id: number;
  serviceUrl: string;
  timestamp: string;
  status: 'up' | 'down';
  source: 'local' | 'peer';
  peerUrl?: string;
}

// Peer types
export interface Peer {
  url: string;
  isUp?: boolean;
  lastChecked?: string;
}

// Config types
export interface Config {
  instanceName: string;
  refreshInterval: number;
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