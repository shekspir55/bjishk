import axios from 'axios';
import { Config } from '../types';
import { DB, ServiceStatus } from '../database';
import { logger } from '../utils/logger';

interface FederationService {
  startFederation: () => void;
  checkPeers: () => Promise<{ url: string; isUp: boolean; }[]>;
  fetchPeerStatuses: (peerUrl: string) => Promise<ServiceStatus[]>;
  shutdown: () => void;
}

export function setupFederationService(config: Config, db: DB): FederationService {
  let timer: NodeJS.Timeout | null = null;
  
  async function checkPeer(peerUrl: string): Promise<boolean> {
    try {
      logger.info(`Checking peer: ${peerUrl}`);
      const response = await axios.get(`${peerUrl}/api/health`, {
        timeout: 10000,
        headers: {
          'X-BJISHK-NODE': config.baseUrl,
          'X-BJISHK-KEY': config.notificationKey
        }
      });
      
      return response.status === 200;
    } catch (error) {
      logger.error(`Failed to connect to peer ${peerUrl}:`, error);
      return false;
    }
  }
  
  async function fetchStatuses(peerUrl: string): Promise<ServiceStatus[]> {
    try {
      const response = await axios.get(`${peerUrl}/api/services/statuses`, {
        timeout: 15000,
        headers: {
          'X-BJISHK-NODE': config.baseUrl,
          'X-BJISHK-KEY': config.notificationKey
        }
      });
      
      if (response.status === 200 && Array.isArray(response.data)) {
        return response.data.map((status: any) => ({
          url: status.url,
          statusCode: status.statusCode || null,
          responseTime: status.responseTime || null,
          title: status.title || null,
          lastChecked: new Date(status.lastChecked),
          isUp: !!status.isUp,
          error: status.error || null
        }));
      }
      
      return [];
    } catch (error) {
      logger.error(`Failed to fetch statuses from peer ${peerUrl}:`, error);
      return [];
    }
  }
  
  async function runFederationCheck() {
    for (const peerUrl of config.peers) {
      const isUp = await checkPeer(peerUrl);
      logger.info(`Peer ${peerUrl} is ${isUp ? 'UP' : 'DOWN'}`);
      
      if (isUp) {
        // Fetch service statuses from peer
        const statuses = await fetchStatuses(peerUrl);
        logger.info(`Received ${statuses.length} status updates from peer ${peerUrl}`);
        
        // Store the status updates in our database
        for (const status of statuses) {
          try {
            await db.addStatusCheck({
              ...status,
              url: `${peerUrl}:${status.url}` // Prefix with peer URL to avoid conflicts
            });
          } catch (err) {
            logger.error(`Failed to store peer status for ${status.url}:`, err);
          }
        }
      }
    }
    
    // Schedule next check
    timer = setTimeout(
      runFederationCheck,
      config.monitoring.peerCheckInterval * 1000
    );
  }
  
  return {
    startFederation() {
      if (config.peers.length === 0) {
        logger.info('No peers configured, federation service not started');
        return;
      }
      
      logger.info(`Starting federation service with ${config.peers.length} peers`);
      runFederationCheck();
    },
    
    async checkPeers() {
      const results = [];
      for (const peerUrl of config.peers) {
        const isUp = await checkPeer(peerUrl);
        results.push({ url: peerUrl, isUp });
      }
      return results;
    },
    
    async fetchPeerStatuses(peerUrl: string) {
      return fetchStatuses(peerUrl);
    },
    
    shutdown() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      logger.info('Federation service shut down');
    }
  };
}

// Process status update from peer
export async function processStatusUpdate(
  data: any,
  db: DB,
  config: Config
): Promise<void> {
  if (!data || !data.serviceUrl || !data.status || !data.sourcePeer) {
    logger.warn('Received invalid status update from peer');
    return;
  }
  
  logger.debug(`Received status update from peer ${data.sourcePeer} for service ${data.serviceUrl}: ${data.status}`);
  
  try {
    // Record this check from peer in our database
    await db.recordCheck(
      data.serviceUrl,
      data.status,
      data.responseTime,
      'peer',
      data.sourcePeer
    );
    
    // Update the peer service status in our database
    // This should be implemented when needed
  } catch (err) {
    const error = err as Error;
    logger.error(`Failed to process peer status update: ${error.message}`);
  }
}

// Process notification record from peer
export async function processNotificationRecord(
  data: any,
  db: DB
): Promise<void> {
  if (!data || !data.serviceUrl || !data.status || !data.sourcePeer) {
    logger.warn('Received invalid notification record from peer');
    return;
  }
  
  logger.debug(`Peer ${data.sourcePeer} has sent notification for service ${data.serviceUrl}`);
  
  try {
    // Record this notification from peer in our database
    // This should prevent us from sending duplicate notifications
    await db.recordNotification(
      data.serviceUrl,
      'peer-notification',
      data.status,
      data.sourcePeer
    );
  } catch (err) {
    const error = err as Error;
    logger.error(`Failed to process peer notification record: ${error.message}`);
  }
} 