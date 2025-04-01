import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { Config } from './types';
import { logger } from './utils/logger';

export interface ServiceStatus {
  id?: number;
  url: string;
  statusCode: number | null;
  responseTime: number | null;
  title: string | null;
  lastChecked: Date;
  isUp: boolean;
  error: string | null;
}

export interface DB {
  addStatusCheck: (status: ServiceStatus) => Promise<void>;
  getLatestStatus: (url: string) => Promise<ServiceStatus | null>;
  getStatusHistory: (url: string, limit: number) => Promise<ServiceStatus[]>;
  getAllLatestStatuses: () => Promise<ServiceStatus[]>;
  getUptimeReport: (url: string, days: number) => Promise<{ uptime: number }>;
  close: () => Promise<void>;
}

export async function setupDatabase(config: Config): Promise<DB> {
  logger.info(`Setting up database at ${config.database.path}`);
  
  // Open the database connection
  const db = await open({
    filename: config.database.path,
    driver: sqlite3.Database
  });
  
  // Create tables if they don't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS service_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      status_code INTEGER,
      response_time INTEGER,
      title TEXT,
      last_checked DATETIME NOT NULL,
      is_up BOOLEAN NOT NULL,
      error TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_service_status_url ON service_status(url);
    CREATE INDEX IF NOT EXISTS idx_service_status_last_checked ON service_status(last_checked);
  `);
  
  return {
    async addStatusCheck(status: ServiceStatus): Promise<void> {
      await db.run(
        `INSERT INTO service_status (url, status_code, response_time, title, last_checked, is_up, error)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        status.url,
        status.statusCode,
        status.responseTime,
        status.title,
        status.lastChecked.toISOString(),
        status.isUp ? 1 : 0,
        status.error
      );
    },
    
    async getLatestStatus(url: string): Promise<ServiceStatus | null> {
      const result = await db.get(
        `SELECT * FROM service_status
         WHERE url = ?
         ORDER BY last_checked DESC
         LIMIT 1`,
        url
      );
      
      if (!result) return null;
      
      return {
        id: result.id,
        url: result.url,
        statusCode: result.status_code,
        responseTime: result.response_time,
        title: result.title,
        lastChecked: new Date(result.last_checked),
        isUp: Boolean(result.is_up),
        error: result.error
      };
    },
    
    async getStatusHistory(url: string, limit: number): Promise<ServiceStatus[]> {
      const results = await db.all(
        `SELECT * FROM service_status
         WHERE url = ?
         ORDER BY last_checked DESC
         LIMIT ?`,
        url,
        limit
      );
      
      return results.map(row => ({
        id: row.id,
        url: row.url,
        statusCode: row.status_code,
        responseTime: row.response_time,
        title: row.title,
        lastChecked: new Date(row.last_checked),
        isUp: Boolean(row.is_up),
        error: row.error
      }));
    },
    
    async getAllLatestStatuses(): Promise<ServiceStatus[]> {
      const results = await db.all(
        `SELECT s.*
         FROM service_status s
         INNER JOIN (
           SELECT url, MAX(last_checked) as max_date
           FROM service_status
           GROUP BY url
         ) m ON s.url = m.url AND s.last_checked = m.max_date`
      );
      
      return results.map(row => ({
        id: row.id,
        url: row.url,
        statusCode: row.status_code,
        responseTime: row.response_time,
        title: row.title,
        lastChecked: new Date(row.last_checked),
        isUp: Boolean(row.is_up),
        error: row.error
      }));
    },
    
    async getUptimeReport(url: string, days: number): Promise<{ uptime: number }> {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const result = await db.get(
        `SELECT COUNT(*) as total,
         SUM(CASE WHEN is_up = 1 THEN 1 ELSE 0 END) as up_count
         FROM service_status
         WHERE url = ? AND last_checked >= ?`,
        url,
        cutoffDate.toISOString()
      );
      
      if (!result || result.total === 0) {
        return { uptime: 0 };
      }
      
      return { uptime: (result.up_count / result.total) * 100 };
    },
    
    async close(): Promise<void> {
      await db.close();
    }
  };
} 