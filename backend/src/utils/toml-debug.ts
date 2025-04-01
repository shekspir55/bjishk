import * as fs from 'fs';
import * as path from 'path';
import * as TOML from '@iarna/toml';
import { logger } from './logger';

/**
 * Debug utility to examine the structure of a TOML file
 */
export function debugTomlFile(filePath: string): void {
  try {
    logger.info(`Debugging TOML file: ${filePath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      logger.error(`File not found: ${filePath}`);
      return;
    }
    
    // Read file content
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    logger.info(`File content length: ${fileContent.length} bytes`);
    
    // Try to parse with TOML library
    try {
      const parsed = TOML.parse(fileContent);
      logger.info(`Successfully parsed TOML file`);
      
      // Examine structure
      logger.info(`Top-level keys: ${Object.keys(parsed).join(', ')}`);
      
      // Check peers section specifically
      if ('peers' in parsed) {
        const peers = parsed.peers;
        logger.info(`Peers type: ${typeof peers}`);
        
        if (Array.isArray(peers)) {
          logger.info(`Peers is an array with ${peers.length} items`);
          peers.forEach((peer, index) => {
            logger.info(`  Peer ${index}: ${peer} (${typeof peer})`);
          });
        } else {
          logger.info(`Peers is not an array: ${JSON.stringify(peers)}`);
        }
      } else {
        logger.info(`No 'peers' key found in TOML file`);
      }
      
      // Return full structure for inspection
      logger.info(`Complete parsed structure: ${JSON.stringify(parsed, null, 2)}`);
    } catch (parseError) {
      logger.error(`Failed to parse TOML: ${parseError}`);
      
      // Try to provide more context about the error
      if (parseError instanceof Error) {
        logger.error(`Error details: ${parseError.message}`);
        if ('line' in (parseError as any)) {
          const line = (parseError as any).line;
          const lineContent = fileContent.split('\n')[line - 1];
          logger.error(`Error at line ${line}: "${lineContent}"`);
        }
      }
    }
  } catch (error) {
    logger.error(`Error in debugTomlFile: ${error}`);
  }
} 