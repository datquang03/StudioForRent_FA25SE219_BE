import express from 'express';

/**
 * Middleware to capture raw body for webhook signature verification
 * This must be applied BEFORE bodyParser.json() middleware
 */
export const webhookRawBody = express.raw({ 
  type: 'application/json',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf-8');
  }
});

export default webhookRawBody;
