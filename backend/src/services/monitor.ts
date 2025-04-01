import axios from 'axios';
import * as cheerio from 'cheerio';
import * as punycode from 'punycode';
import { URL } from 'url';
import { Config } from '../types';
import { DB, ServiceStatus } from '../database';
import { logger } from '../utils/logger';
import { sendNotification } from './notification';

interface MonitoringService {
  startMonitoring: () => void;
  pauseMonitoring: () => void;
  resumeMonitoring: () => void;
  checkServiceNow: (url: string) => Promise<ServiceStatus>;
  shutdown: () => void;
}

export function setupMonitoringService(config: Config, db: DB): MonitoringService {
  const timers = new Map<string, NodeJS.Timeout>();
  let isPaused = false;
  
  // Check a single service and record the result
  async function checkService(url: string): Promise<ServiceStatus> {
    logger.info(`Checking service: ${url}`);
    const startTime = Date.now();
    let statusCode: number | null = null;
    let title: string | null = null;
    let isUp = false;
    let error: string | null = null;
    
    try {
      // Process URL for internationalized domain names
      const processedUrl = processUrl(url);
      logger.debug(`Processing URL: ${url} -> ${processedUrl}`);
      
      // Use axios with timeout (instead of fetch)
      const response = await axios.get(processedUrl, {
        timeout: 30000, // 30 second timeout
        validateStatus: () => true, // Don't throw on non-2xx status codes
      });
      
      statusCode = response.status;
      isUp = statusCode >= 200 && statusCode < 400;
      
      // If we have HTML content, extract the title
      if (response.headers['content-type']?.includes('text/html')) {
        title = extractPageTitle(response.data);
      }
      
      logger.info(`Service ${url} is ${isUp ? 'UP' : 'DOWN'} with status code ${statusCode}`);
    } catch (err) {
      const axiosError = err as any;
      if (axiosError.code === 'ECONNABORTED') {
        error = 'Request timed out';
      } else if (axiosError.code === 'ENOTFOUND') {
        error = 'DNS resolution failed';
      } else if (axiosError.response) {
        // The server responded with a status code outside the 2xx range
        statusCode = axiosError.response.status;
        error = `HTTP error: ${statusCode}`;
      } else if (axiosError.request) {
        // The request was made but no response was received
        error = 'No response received';
      } else {
        // Something else went wrong
        error = axiosError.message || 'Unknown error';
      }
      
      logger.error(`Error checking service ${url}: ${error}`);
    }
    
    const responseTime = Date.now() - startTime;
    
    // Prepare status object
    const status: ServiceStatus = {
      url,
      statusCode,
      responseTime,
      title,
      lastChecked: new Date(),
      isUp,
      error
    };
    
    // Save status to database
    await db.addStatusCheck(status);
    
    // Get previous status to check if state changed
    const previousStatus = await db.getLatestStatus(url);
    
    // If status changed, send a notification
    if (previousStatus && previousStatus.isUp !== isUp) {
      try {
        // Find service config for email
        const serviceConfig = config.services.find(s => s.url === url);
        if (serviceConfig) {
          await sendNotification({
            to: serviceConfig.email,
            subject: `Service ${isUp ? 'UP' : 'DOWN'}: ${url}`,
            message: `Service ${url} is now ${isUp ? 'UP' : 'DOWN'}.
            ${error ? `Error: ${error}` : ''}
            Status code: ${statusCode}
            Response time: ${responseTime}ms
            Checked at: ${new Date().toISOString()}`,
            config
          });
          logger.info(`Notification sent for service ${url} status change`);
        }
      } catch (notificationError) {
        logger.error(`Failed to send notification for ${url}: ${notificationError}`);
      }
    }
    
    return status;
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
  
  // Extract title from HTML
  function extractPageTitle(html: string): string | null {
    try {
      if (!html || typeof html !== 'string') {
        logger.debug('No HTML content to extract title from');
        return null;
      }
      const $ = cheerio.load(html);
      const title = $('title').text().trim();
      return title || null;
    } catch (err) {
      const error = err as Error;
      logger.error(`Failed to extract page title: ${error.message}`);
      return null;
    }
  }
  
  // Schedule monitoring for all services
  function scheduleAllServices() {
    // Clear any existing timers
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
    
    // Schedule new checks for each service
    for (const service of config.services) {
      scheduleServiceCheck(service.url, service.checkInterval);
    }
    
    logger.info(`Scheduled monitoring for ${config.services.length} services`);
  }
  
  // Schedule a single service check
  function scheduleServiceCheck(url: string, interval: number) {
    if (isPaused) return;
    
    const serviceConfig = config.services.find(s => s.url === url);
    
    if (!serviceConfig) {
      logger.warn(`Cannot schedule unknown service: ${url}`);
      return;
    }
    
    // Clear any existing timer for this service
    if (timers.has(url)) {
      clearTimeout(timers.get(url)!);
    }
    
    // Check service immediately
    checkService(url).catch(err => {
      logger.error(`Failed to check service ${url}:`, err);
    });
    
    // Schedule next check
    const timer = setTimeout(() => {
      // Remove the timer from the map
      timers.delete(url);
      
      // Schedule the next check
      scheduleServiceCheck(url, interval);
    }, interval * 1000);
    
    // Store the timer
    timers.set(url, timer);
  }
  
  return {
    startMonitoring() {
      isPaused = false;
      scheduleAllServices();
      logger.info('Monitoring service started');
    },
    
    pauseMonitoring() {
      isPaused = true;
      
      // Clear all timers
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
      
      logger.info('Monitoring service paused');
    },
    
    resumeMonitoring() {
      isPaused = false;
      scheduleAllServices();
      logger.info('Monitoring service resumed');
    },
    
    async checkServiceNow(url: string): Promise<ServiceStatus> {
      return checkService(url);
    },
    
    shutdown() {
      // Clear all timers
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
      
      logger.info('Monitoring service shut down');
    }
  };
} 