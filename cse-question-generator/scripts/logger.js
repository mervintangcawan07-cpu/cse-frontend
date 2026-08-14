const fs = require('fs');
const path = require('path');

const LOG_DIR = path.resolve(__dirname, '../logs');
const LOG_FILE = path.join(LOG_DIR, 'generator.log');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const SENSITIVE_PATTERNS = [
  /bearer\s+[A-Za-z0-9_\-\.]+/gi,
  /password\s*[:=]\s*["']?[^"'\s]+["']?/gi,
  /api[-_]?key\s*[:=]\s*["']?[^"'\s]+["']?/gi,
  /token\s*[:=]\s*(?:bearer\s+)?["']?[^"'\s]+["']?/gi,
  /secret\s*[:=]\s*["']?[^"'\s]+["']?/gi,
];

function sanitizeMessage(msg) {
  if (typeof msg !== 'string') {
    try {
      msg = JSON.stringify(msg);
    } catch {
      msg = String(msg);
    }
  }
  let sanitized = msg;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED_SECRET]');
  }
  return sanitized;
}

function logEvent(level, eventType, message, metadata = null) {
  const timestamp = new Date().toISOString();
  const safeMessage = sanitizeMessage(message);
  const safeMeta = metadata ? sanitizeMessage(JSON.stringify(metadata)) : null;

  const logEntry = `[${timestamp}] [${level.toUpperCase()}] [${eventType}] ${safeMessage}${safeMeta ? ' | ' + safeMeta : ''}\n`;

  try {
    fs.appendFileSync(LOG_FILE, logEntry, 'utf8');
  } catch (err) {
    console.error(`Failed to write to log file: ${err.message}`);
  }

  // Also output to console with appropriate level
  if (level === 'error') {
    console.error(`🔴 [${eventType}] ${safeMessage}`);
  } else if (level === 'warn') {
    console.warn(`⚠️ [${eventType}] ${safeMessage}`);
  } else {
    console.log(`ℹ️ [${eventType}] ${safeMessage}`);
  }
}

module.exports = {
  info: (eventType, message, meta) => logEvent('INFO', eventType, message, meta),
  warn: (eventType, message, meta) => logEvent('WARN', eventType, message, meta),
  error: (eventType, message, meta) => logEvent('ERROR', eventType, message, meta),
  logEvent,
  LOG_FILE,
};
