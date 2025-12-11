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

  // Verify PayOS client has expected API methods at startup
  // Expected: PayOS SDK v1.x with createPaymentLink method
  // If SDK changes, update getPayOSCreatePaymentFn() in services
  if (typeof payos.createPaymentLink !== 'function' && 
      typeof payos.paymentRequests?.create !== 'function') {
    const errorMsg = 'PayOS client missing expected API methods (createPaymentLink or paymentRequests.create)';
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  logger.info('PayOS client initialized successfully', {
    clientId: `${process.env.PAYOS_CLIENT_ID?.substring(0, 8) || ''}...`,
    environment: process.env.NODE_ENV || 'development',
    apiMethod: typeof payos.createPaymentLink === 'function' ? 'createPaymentLink' : 'paymentRequests.create'
  });
}

/**
 * Get the appropriate PayOS payment creation function
 * Handles different PayOS SDK versions
 * @returns {Function} Payment link creation function
 */
export const getPayOSCreatePaymentFn = () => {
  if (!payos || typeof payos !== 'object') {
    throw new Error('PayOS client not initialized');
  }
  
  // Prefer createPaymentLink (newer SDK)
  if (typeof payos.createPaymentLink === 'function') {
    return (data) => payos.createPaymentLink(data);
  }
  
  // Fallback to paymentRequests.create (older SDK)
  if (typeof payos.paymentRequests?.create === 'function') {
    return (data) => payos.paymentRequests.create(data);
  }
  
  throw new Error('PayOS client does not support payment link creation');
};

export default payos;