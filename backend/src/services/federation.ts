import axios from 'axios';
import * as punycode from 'punycode';
import { URL } from 'url';
import { Config } from '../types';
import { DB, ServiceStatus } from '../database';
import { logger } from '../utils/logger';

interface FederationService {
  startFederation: () => void;
  checkPeers: () => Promise<{ url: string; isUp: boolean; error?: string; services?: number; lastChecked: string; }[]>;
  fetchPeerStatuses: (peerUrl: string) => Promise<ServiceStatus[]>;
  shutdown: () => void;
}

export function setupFederationService(config: Config, db: DB): FederationService {
  let timer: NodeJS.Timeout | null = null;
  
  // Ensure config.peers is always an array
  if (!config.peers) {
    logger.warn('config.peers is undefined, initializing as empty array');
    config.peers = [];
  } else if (!Array.isArray(config.peers)) {
    logger.warn(`config.peers is not an array (type: ${typeof config.peers}), converting to array`);
    try {
      // Try to convert to array if possible
      if (typeof config.peers === 'string') {
        config.peers = [config.peers];
      } else {
        config.peers = [];
      }
    } catch (err) {
      logger.error(`Failed to convert peers to array: ${err}`);
      config.peers = [];
    }
  }
  
  // Process URL to handle IDNs with punycode
  function processUrl(inputUrl: string): string {
    try {
      const urlObj = new URL(inputUrl);
      
      // Convert IDN hostname to punycode if needed
      if (/[^\u0000-\u007F]/.test(urlObj.hostname)) {
        logger.debug(`Converting internationalized domain: ${urlObj.hostname}`);
        const punycodeHostname = punycode.toASCII(urlObj.hostname);
        urlObj.hostname = punycodeHostname;
        logger.debug(`Converted to punycode: ${punycodeHostname}`);
        return urlObj.toString();
      }
      
      return inputUrl;
    } catch (err) {
      logger.error(`Error processing URL ${inputUrl}: ${err}`);
      return inputUrl; // Return original URL if processing fails
    }
  }
  
  async function checkPeer(peerUrl: string): Promise<{ isUp: boolean; error?: string; services?: number }> {
    try {
      // Process URL for internationalized domain names
      const processedUrl = processUrl(peerUrl);
      logger.info(`Checking peer: ${peerUrl} -> ${processedUrl}`);
      
      const response = await axios.get(`${processedUrl}/api/health`, {
        timeout: 10000,
        headers: {
          'X-BJISHK-NODE': config.baseUrl,
          'X-BJISHK-KEY': config.notificationKey
        }
      });
      
      // If we get a successful response, try to get the services count
      let servicesCount: number | undefined = undefined;
      try {
        const servicesResponse = await axios.get(`${processedUrl}/api/instance`, {
          timeout: 5000,
          headers: {
            'X-BJISHK-NODE': config.baseUrl,
            'X-BJISHK-KEY': config.notificationKey
          }
        });
        
        if (servicesResponse.status === 200 && servicesResponse.data && servicesResponse.data.data) {
          servicesCount = servicesResponse.data.data.services || 0;
        }
      } catch (servicesError) {
        logger.warn(`Could not fetch services count from peer ${peerUrl}: ${servicesError}`);
      }
      
      return { 
        isUp: response.status === 200,
        services: servicesCount
      };
    } catch (error: any) {
      let errorMessage = 'Unknown error';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Connection timed out';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'DNS resolution failed';
      } else if (error.response) {
        errorMessage = `HTTP error: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = 'No response received';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      logger.error(`Failed to connect to peer ${peerUrl}: ${errorMessage}`);
      return { 
        isUp: false,
        error: errorMessage
      };
    }
  }
  
  async function fetchStatuses(peerUrl: string): Promise<ServiceStatus[]> {
    try {
      // Process URL for internationalized domain names
      const processedUrl = processUrl(peerUrl);
      
      const response = await axios.get(`${processedUrl}/api/services/statuses`, {
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
      const peerStatus = await checkPeer(peerUrl);
      logger.info(`Peer ${peerUrl} is ${peerStatus.isUp ? 'UP' : 'DOWN'}`);
      
      if (peerStatus.isUp) {
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
      logger.info(`Federation service initialized with peers config: ${JSON.stringify(config.peers)}`);
      
      if (!config.peers || config.peers.length === 0) {
        logger.info('No peers configured, federation service not started');
        return;
      }
      
      logger.info(`Starting federation service with ${config.peers.length} peers`);
      runFederationCheck();
    },
    
    async checkPeers() {
      const results = [];
      for (const peerUrl of config.peers) {
        const peerStatus = await checkPeer(peerUrl);
        results.push({ 
          url: peerUrl,
          isUp: peerStatus.isUp,
          error: peerStatus.error,
          services: peerStatus.services,
          lastChecked: new Date().toISOString()
        });
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