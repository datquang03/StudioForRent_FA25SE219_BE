import { v2 as cloudinary } from 'cloudinary';
import logger from '../utils/logger.js';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Validate Cloudinary configuration
const validateCloudinaryConfig = () => {
  const requiredVars = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    logger.error(`Missing Cloudinary environment variables: ${missingVars.join(', ')}`);
    logger.error('Please add these variables to your .env file');
    throw new Error('Cloudinary configuration incomplete');
  }

  logger.info('Cloudinary configuration validated successfully');
};

// Initialize and validate config
validateCloudinaryConfig();

export default cloudinary;