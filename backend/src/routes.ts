import express, { Request, Response, Router } from 'express';
import { Config } from './types';
import { DB, ServiceStatus } from './database';
import { logger } from './utils/logger';

// API routes setup
export function setupApiRoutes(app: express.Application, config: Config, db: DB) {
  const apiRouter = Router();
  
  // Health check endpoint
  apiRouter.get('/health', (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
        version: process.env.npm_package_version || '1.0.0',
        name: config.name
      }
    });
  });
  
  // Get instance information
  apiRouter.get('/instance', (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        name: config.name,
        baseUrl: config.baseUrl,
        services: config.services.length,
        peers: config.peers.length,
        version: process.env.npm_package_version || '1.0.0'
      }
    });
  });
  
  // Get services list
  apiRouter.get('/services', async (req: Request, res: Response) => {
    try {
      const services = config.services.map(service => ({
        url: service.url,
        email: service.email,
        checkInterval: service.checkInterval
      }));
      
      res.json({ success: true, data: services });
    } catch (error) {
      logger.error('Error getting services:', error);
      res.status(500).json({ success: false, error: 'Failed to get services' });
    }
  });
  
  // Get all service statuses
  apiRouter.get('/services/statuses', async (req: Request, res: Response) => {
    try {
      const allStatuses = await db.getAllLatestStatuses();
      
      // Format for API response
      const formattedStatuses = allStatuses.map(status => ({
        url: status.url,
        isUp: status.isUp,
        statusCode: status.statusCode,
        responseTime: status.responseTime,
        title: status.title,
        lastChecked: status.lastChecked.toISOString(),
        error: status.error
      }));
      
      res.json({ success: true, data: formattedStatuses });
    } catch (error) {
      logger.error('Error getting service statuses:', error);
      res.status(500).json({ success: false, error: 'Failed to get service statuses' });
    }
  });
  
  // Get a single service status
  apiRouter.get('/services/:urlEncoded/status', async (req: Request, res: Response) => {
    try {
      const url = decodeURIComponent(req.params.urlEncoded);
      const status = await db.getLatestStatus(url);
      
      if (!status) {
        return res.status(404).json({
          success: false,
          error: `Service status not found for ${url}`
        });
      }
      
      res.json({
        success: true,
        data: {
          url: status.url,
          isUp: status.isUp,
          statusCode: status.statusCode,
          responseTime: status.responseTime,
          title: status.title,
          lastChecked: status.lastChecked.toISOString(),
          error: status.error
        }
      });
    } catch (error) {
      logger.error(`Error getting service status for ${req.params.urlEncoded}:`, error);
      res.status(500).json({ success: false, error: 'Failed to get service status' });
    }
  });
  
  // Get service status history
  apiRouter.get('/services/:urlEncoded/history', async (req: Request, res: Response) => {
    try {
      const url = decodeURIComponent(req.params.urlEncoded);
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
      
      const history = await db.getStatusHistory(url, limit);
      
      const formattedHistory = history.map(status => ({
        url: status.url,
        isUp: status.isUp,
        statusCode: status.statusCode,
        responseTime: status.responseTime,
        title: status.title,
        lastChecked: status.lastChecked.toISOString(),
        error: status.error
      }));
      
      res.json({ success: true, data: formattedHistory });
    } catch (error) {
      logger.error(`Error getting service history for ${req.params.urlEncoded}:`, error);
      res.status(500).json({ success: false, error: 'Failed to get service history' });
    }
  });
  
  // Get simplified service history dots for dashboard visualization
  apiRouter.get('/services/:urlEncoded/history/dots', async (req: Request, res: Response) => {
    try {
      const url = decodeURIComponent(req.params.urlEncoded);
      const count = req.query.count ? parseInt(req.query.count as string, 10) : 10;
      
      const history = await db.getStatusHistory(url, count);
      
      // Format for simple visualization - just timestamps and up/down status
      const dots = history.map(status => ({
        timestamp: status.lastChecked.toISOString(),
        isUp: status.isUp,
        responseTime: status.responseTime
      }));
      
      res.json({ success: true, data: dots });
    } catch (error) {
      logger.error(`Error getting history dots for ${req.params.urlEncoded}:`, error);
      res.status(500).json({ success: false, error: 'Failed to get history dots' });
    }
  });
  
  // Get service uptime for a time period
  apiRouter.get('/services/:urlEncoded/uptime', async (req: Request, res: Response) => {
    try {
      const url = decodeURIComponent(req.params.urlEncoded);
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;
      
      const uptimeReport = await db.getUptimeReport(url, days);
      
      res.json({
        success: true,
        data: {
          url,
          days,
          uptime: uptimeReport.uptime
        }
      });
    } catch (error) {
      logger.error(`Error getting uptime for ${req.params.urlEncoded}:`, error);
      res.status(500).json({ success: false, error: 'Failed to get uptime report' });
    }
  });
  
  // Get a list of peers
  apiRouter.get('/peers', async (req: Request, res: Response) => {
    try {
      // Get the federation service from the app
      const federationService = req.app.locals.federationService;
      
      if (federationService && typeof federationService.checkPeers === 'function') {
        // Use the federation service to check peer statuses
        const peersWithStatus = await federationService.checkPeers();
        res.json({ success: true, data: peersWithStatus });
      } else {
        // Fallback to basic peer list without status
        const peers = config.peers.map(peerUrl => ({ 
          url: peerUrl,
          isUp: false,
          lastChecked: new Date().toISOString()
        }));
        logger.warn('Federation service not available, returning basic peer list');
        res.json({ success: true, data: peers });
      }
    } catch (error) {
      logger.error('Error getting peers:', error);
      res.status(500).json({ success: false, error: 'Failed to get peers' });
    }
  });
  
  // Get services from a specific peer
  apiRouter.get('/peers/:urlEncoded/services', async (req: Request, res: Response) => {
    try {
      const peerUrl = decodeURIComponent(req.params.urlEncoded);
      const federationService = req.app.locals.federationService;
      
      if (!federationService || typeof federationService.fetchPeerStatuses !== 'function') {
        return res.status(500).json({ 
          success: false, 
          error: 'Federation service not available' 
        });
      }
      
      // Check if the peer is in our configured peers
      if (!config.peers.includes(peerUrl)) {
        return res.status(404).json({ 
          success: false, 
          error: `Peer "${peerUrl}" not found in configured peers` 
        });
      }
      
      try {
        // Use the federation service to fetch services from the peer
        const statuses = await federationService.fetchPeerStatuses(peerUrl);
        
        res.json({ 
          success: true, 
          data: statuses.map((status: ServiceStatus) => ({
            url: status.url,
            isUp: status.isUp,
            statusCode: status.statusCode,
            responseTime: status.responseTime,
            title: status.title,
            lastChecked: status.lastChecked.toISOString(),
            error: status.error
          }))
        });
      } catch (fetchError: unknown) {
        logger.error(`Error fetching statuses from peer ${peerUrl}:`, fetchError);
        res.status(502).json({ 
          success: false, 
          error: `Failed to fetch services from peer: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}` 
        });
      }
    } catch (error) {
      logger.error(`Error processing peer services request:`, error);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error processing peer services request' 
      });
    }
  });
  
  // Get UI configuration
  apiRouter.get('/ui-config', (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        refreshInterval: config.ui.refreshInterval,
        instanceName: config.name
      }
    });
  });
  
  // Define API base path
  app.use('/api', apiRouter);
  
  // API 404 handler
  app.use('/api/*', (req: Request, res: Response) => {
    res.status(404).json({ success: false, error: 'API endpoint not found' });
  });
  
  logger.info('API routes configured');
} 