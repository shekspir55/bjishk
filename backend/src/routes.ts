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
  apiRouter.get('/peers', (req: Request, res: Response) => {
    const peers = config.peers.map(peerUrl => ({ url: peerUrl }));
    res.json({ success: true, data: peers });
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