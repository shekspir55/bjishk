import nodemailer from 'nodemailer';
import axios from 'axios';
import { Config, Service } from '../types';
import { logger } from '../utils/logger';

interface NotificationOptions {
  to: string;
  subject: string;
  message: string;
  config: Config;
}

// Send a notification email for a service status change
export async function sendNotification(options: NotificationOptions): Promise<boolean> {
  const { to, subject, message, config } = options;
  
  // If email configuration is not set up, log a warning and return
  if (!config.email.smtpHost || !config.email.smtpUser || !config.email.smtpPass) {
    logger.warn('Email configuration is incomplete, skipping notification');
    return false;
  }
  
  try {
    // Create a transporter
    const transporter = nodemailer.createTransport({
      host: config.email.smtpHost,
      port: config.email.smtpPort,
      secure: config.email.smtpTls,
      auth: {
        user: config.email.smtpUser,
        pass: config.email.smtpPass
      }
    });
    
    // Set up email data
    const mailOptions = {
      from: config.email.smtpFrom || config.adminEmail,
      to,
      subject,
      text: message,
      html: message.replace(/\n/g, '<br>')
    };
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    logger.error('Failed to send email notification:', error);
    return false;
  }
}

// Notify peer instances about a status change (federation)
export async function notifyPeers(
  serviceUrl: string,
  status: 'up' | 'down',
  config: Config,
  responseTime?: number
): Promise<void> {
  // Skip if no peers configured
  if (!config.peers || config.peers.length === 0) {
    return;
  }
  
  logger.debug(`Notifying ${config.peers.length} peers about status change for ${serviceUrl}`);
  
  const notificationData = {
    serviceUrl,
    timestamp: new Date().toISOString(),
    status,
    responseTime,
    sourcePeer: config.baseUrl,
    notificationKey: config.notificationKey
  };
  
  // Notify each peer
  for (const peerUrl of config.peers) {
    try {
      await axios.post(`${peerUrl}/peers/status-update`, notificationData, {
        headers: {
          'Content-Type': 'application/json',
          'X-Bjishk-Node': config.baseUrl,
          'X-Bjishk-Notification-Key': config.notificationKey
        },
        timeout: 5000 // 5 second timeout
      });
      
      logger.debug(`Successfully notified peer ${peerUrl} about status change`);
    } catch (err) {
      const error = err as Error;
      logger.warn(`Failed to notify peer ${peerUrl}: ${error.message}`);
    }
  }
}

// Notify peers that a notification has been sent (to avoid duplicate notifications)
export async function notifyPeersAboutNotification(
  serviceUrl: string,
  status: 'up' | 'down',
  config: Config
): Promise<void> {
  // Skip if no peers configured
  if (!config.peers || config.peers.length === 0) {
    return;
  }
  
  logger.debug(`Notifying ${config.peers.length} peers that notification was sent for ${serviceUrl}`);
  
  const notificationData = {
    serviceUrl,
    timestamp: new Date().toISOString(),
    status,
    sourcePeer: config.baseUrl,
    notificationKey: config.notificationKey
  };
  
  // Notify each peer
  for (const peerUrl of config.peers) {
    try {
      await axios.post(`${peerUrl}/peers/notification`, notificationData, {
        headers: {
          'Content-Type': 'application/json',
          'X-Bjishk-Node': config.baseUrl,
          'X-Bjishk-Notification-Key': config.notificationKey
        },
        timeout: 5000 // 5 second timeout
      });
      
      logger.debug(`Successfully notified peer ${peerUrl} about sent notification`);
    } catch (err) {
      const error = err as Error;
      logger.warn(`Failed to notify peer ${peerUrl} about sent notification: ${error.message}`);
    }
  }
} 