/**
 * Logger Service
 * Handles logging to both console and files
 * Logs rotate daily and are stored in logs/ directory
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

// Current log level from environment
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

// Log directory
const LOG_DIR = path.join(process.cwd(), 'logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Get current timestamp for logging
 */
function getTimestamp() {
  const now = new Date();
  return now.toISOString();
}

/**
 * Get log file name based on date
 */
function getLogFileName() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(LOG_DIR, `app-${dateStr}.log`);
}

/**
 * Get AI flow log file name
 */
function getAIFlowLogFileName() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  return path.join(LOG_DIR, `ai-flow-${dateStr}.log`);
}

/**
 * Write log to file
 */
function writeToFile(filePath, message) {
  try {
    const timestamp = getTimestamp();
    const logLine = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(filePath, logLine, { encoding: 'utf8' });
  } catch (_error) {
    // Silently fail - don't let logging break the app
  }
}

/**
 * Format log message with optional metadata
 */
function formatMessage(level, message, meta = null) {
  let formatted = `[${level}] ${message}`;
  if (meta) {
    try {
      formatted += ` ${JSON.stringify(meta)}`;
    } catch {
      formatted += ` [Object]`;
    }
  }
  return formatted;
}

class Logger {
  constructor() {
    this.aiFlowBuffer = [];
  }

  /**
   * Log error message
   */
  error(message, meta = null) {
    if (CURRENT_LEVEL < LOG_LEVELS.ERROR) return;
    
    const formatted = formatMessage('ERROR', message, meta);
    console.error(`[ERROR] ${formatted}`);
    writeToFile(getLogFileName(), formatted);
  }

  /**
   * Log warning message
   */
  warn(message, meta = null) {
    if (CURRENT_LEVEL < LOG_LEVELS.WARN) return;
    
    const formatted = formatMessage('WARN', message, meta);
    console.warn(`[WARN] ${formatted}`);
    writeToFile(getLogFileName(), formatted);
  }

  /**
   * Log info message
   */
  info(message, meta = null) {
    if (CURRENT_LEVEL < LOG_LEVELS.INFO) return;
    
    const formatted = formatMessage('INFO', message, meta);
    console.log(formatted);
    writeToFile(getLogFileName(), formatted);
  }

  /**
   * Log debug message
   */
  debug(message, meta = null) {
    if (CURRENT_LEVEL < LOG_LEVELS.DEBUG) return;
    
    const formatted = formatMessage('DEBUG', message, meta);
    console.log(`[DEBUG] ${formatted}`);
    writeToFile(getLogFileName(), formatted);
  }

  /**
   * Log AI Flow step
   * Special logging for AI Trip Planning flow
   */
  aiFlow(step, message, meta = null) {
    const timestamp = new Date().toLocaleTimeString('vi-VN');
    const formatted = `[${timestamp}] [${step}] ${message}`;
    
    // Console output with visual markers
    console.log(formatted);
    
    // Write to AI flow specific log file
    writeToFile(getAIFlowLogFileName(), formatted);
    
    // Also buffer for real-time viewing
    this.aiFlowBuffer.push({
      timestamp: Date.now(),
      step,
      message,
      meta,
    });
    
    // Keep only last 1000 entries
    if (this.aiFlowBuffer.length > 1000) {
      this.aiFlowBuffer.shift();
    }
  }

  /**
   * Log AI Flow start
   */
  aiFlowStart(message, meta = null) {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║           AI TRIP PLANNING FLOW - STARTED                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    
    const startMsg = `FLOW START: ${message}`;
    writeToFile(getAIFlowLogFileName(), `\n${'='.repeat(60)}`);
    writeToFile(getAIFlowLogFileName(), startMsg);
    writeToFile(getAIFlowLogFileName(), `${'='.repeat(60)}`);
    
    if (meta) {
      writeToFile(getAIFlowLogFileName(), `META: ${JSON.stringify(meta)}`);
    }
  }

  /**
   * Log AI Flow step header
   */
  aiFlowStep(stepNumber, stepName) {
    const line = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    console.log(`\n${line}`);
    console.log(`STEP ${stepNumber}: ${stepName}`);
    console.log(line);
    
    writeToFile(getAIFlowLogFileName(), '');
    writeToFile(getAIFlowLogFileName(), line);
    writeToFile(getAIFlowLogFileName(), `STEP ${stepNumber}: ${stepName}`);
    writeToFile(getAIFlowLogFileName(), line);
  }

  /**
   * Log AI Flow end
   */
  aiFlowEnd(message = 'COMPLETED') {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log(`║     AI TRIP PLANNING FLOW - ${message}          ║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    writeToFile(getAIFlowLogFileName(), `${'='.repeat(60)}`);
    writeToFile(getAIFlowLogFileName(), `FLOW END: ${message}`);
    writeToFile(getAIFlowLogFileName(), `${'='.repeat(60)}\n`);
  }

  /**
   * Get recent AI flow logs
   */
  getRecentAIFlowLogs(count = 100) {
    return this.aiFlowBuffer.slice(-count);
  }

  /**
   * Log algorithm execution
   */
  algorithm(algorithmName, action, meta = null) {
    const msg = `[Algorithm: ${algorithmName}] ${action}`;
    console.log(`  [TOOL] ${msg}`);
    writeToFile(getAIFlowLogFileName(), `  [ALGO] ${msg}`);
    if (meta) {
      writeToFile(getAIFlowLogFileName(), `  [META] ${JSON.stringify(meta)}`);
    }
  }

  /**
   * Log tool execution
   */
  tool(toolName, action, duration = null, meta = null) {
    let msg = `[Tool: ${toolName}] ${action}`;
    if (duration) {
      msg += ` (${duration}ms)`;
    }
    console.log(`  [TOOL] ${msg}`);
    writeToFile(getAIFlowLogFileName(), `  [TOOL] ${msg}`);
    if (meta) {
      writeToFile(getAIFlowLogFileName(), `  [META] ${JSON.stringify(meta)}`);
    }
  }

  /**
   * Get log files list
   */
  getLogFiles() {
    try {
      return fs.readdirSync(LOG_DIR)
        .filter(f => f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(LOG_DIR, f),
          date: f.match(/\d{4}-\d{2}-\d{2}/)?.[0] || 'unknown',
        }))
        .sort((a, b) => b.date.localeCompare(a.date));
    } catch {
      return [];
    }
  }

  /**
   * Read log file content
   */
  readLogFile(fileName, lines = 100) {
    try {
      const filePath = path.join(LOG_DIR, fileName);
      const content = fs.readFileSync(filePath, 'utf8');
      const allLines = content.split('\n');
      return allLines.slice(-lines).join('\n');
    } catch (error) {
      return `Error reading log file: ${error.message}`;
    }
  }
}

// Export singleton instance
export const logger = new Logger();
export default logger;
