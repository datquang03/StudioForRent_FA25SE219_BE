import { PayOS } from '@payos/node';
import logger from '../utils/logger.js';

// Validate environment variables
const requiredEnvVars = ['PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY'];
const missingVars = requiredEnvVars.filter((k) => !process.env[k]);

let payos;
if (missingVars.length > 0) {
  const msg = `Missing PayOS environment variables: ${missingVars.join(', ')}`;
  if ((process.env.NODE_ENV || 'development') === 'production') {
    logger.error(msg);
    throw new Error(`PayOS configuration incomplete. Missing: ${missingVars.join(', ')}`);
  } else {
    logger.warn(`${msg} — PayOS client will not be initialized in this environment.`);
    // Export a harmless stub so callers that check for methods won't crash
    payos = {};
  }
} else {
  // Initialize PayOS with options object (current SDK in repo uses named export + options object)
  payos = new PayOS({
    clientId: process.env.PAYOS_CLIENT_ID,
    apiKey: process.env.PAYOS_API_KEY,
    checksumKey: process.env.PAYOS_CHECKSUM_KEY
  });

  logger.info('PayOS client initialized successfully', {
    clientId: `${process.env.PAYOS_CLIENT_ID?.substring(0, 8) || ''}...`,
    environment: process.env.NODE_ENV || 'development'
  });
}

export default payos;