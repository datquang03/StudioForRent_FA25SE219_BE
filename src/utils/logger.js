const isDevelopment = process.env.NODE_ENV !== 'production';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

const formatMessage = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] ${level}: ${message}${metaStr}`;
};

export const logger = {
  info: (message, meta = {}) => {
    if (isDevelopment) {
      console.log(`${colors.blue}ℹ${colors.reset} ${formatMessage('INFO', message, meta)}`);
    }
  },

  success: (message, meta = {}) => {
    if (isDevelopment) {
      console.log(`${colors.green}✓${colors.reset} ${formatMessage('SUCCESS', message, meta)}`);
    }
  },

  warn: (message, meta = {}) => {
    console.warn(`${colors.yellow}⚠${colors.reset} ${formatMessage('WARN', message, meta)}`);
  },

  error: (message, error = null, meta = {}) => {
    const errorMeta = error ? { ...meta, error: error.message, stack: error.stack } : meta;
    console.error(`${colors.red}✖${colors.reset} ${formatMessage('ERROR', message, errorMeta)}`);
  },

  debug: (message, meta = {}) => {
    if (isDevelopment) {
      console.log(`${colors.gray}◆${colors.reset} ${formatMessage('DEBUG', message, meta)}`);
    }
  },
};

export default logger;
