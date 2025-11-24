// #region Imports
import axios from 'axios';
import logger from '../utils/logger.js';
import cloudinary from '../config/cloudinary.js';
// #endregion

// Getty Images API Configuration
const GETTY_API_BASE_URL = 'https://api.gettyimages.com/v3';
const GETTY_API_KEY = process.env.GETTY_API_KEY;
const GETTY_CLIENT_ID = process.env.GETTY_CLIENT_ID;
const GETTY_CLIENT_SECRET = process.env.GETTY_CLIENT_SECRET;

// Polling configuration
const POLLING_INTERVAL = 2000; // 2 seconds
const MAX_POLLING_ATTEMPTS = 30; // 60 seconds max (30 * 2s)

/**
 * Get Getty Images OAuth access token
 * @returns {Promise<string>} Access token
 */
const getGettyAccessToken = async () => {
  try {
    const response = await axios.post(
      'https://authentication.gettyimages.com/oauth2/token',
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: GETTY_CLIENT_ID,
        client_secret: GETTY_CLIENT_SECRET,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data.access_token;
  } catch (error) {
    logger.error('Error getting Getty Images access token:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with Getty Images API');
  }
};

/**
 * Generate image with Getty Images AI
 * @param {string} prompt - Image generation prompt
 * @param {object} options - Generation options
 * @returns {Promise<object>} Generated image data
 */
export const generateImageWithGetty = async (prompt, options = {}) => {
  try {
    if (!GETTY_API_KEY || !GETTY_CLIENT_ID || !GETTY_CLIENT_SECRET) {
      throw new Error('Getty Images API credentials not configured');
    }

    const {
      aspectRatio = '16:9',
      numberOfImages = 1,
      negativePrompt = '',
    } = options;

    logger.info('Generating image with Getty Images AI');

    // Get access token
    const accessToken = await getGettyAccessToken();

    // Step 1: Submit generation request
    const generationResponse = await axios.post(
      `${GETTY_API_BASE_URL}/ai/image-generations`,
      {
        prompt: prompt,
        aspect_ratio: aspectRatio,
        number_of_images: numberOfImages,
        ...(negativePrompt && { negative_prompt: negativePrompt }),
      },
      {
        headers: {
          'Api-Key': GETTY_API_KEY,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const generationRequestId = generationResponse.data.generation_request_id;
    logger.info(`Getty generation request submitted: ${generationRequestId}`);

    // Step 2: Poll for results
    const result = await pollGenerationStatus(generationRequestId, accessToken);

    // Step 3: Download and upload to Cloudinary
    const imageUrl = result.results[0].url;
    const cloudinaryUrl = await downloadAndUploadToCloudinary(imageUrl, accessToken);

    logger.info('Getty image generated and uploaded successfully');

    return {
      success: true,
      url: cloudinaryUrl,
      metadata: {
        provider: 'getty-images',
        generationRequestId: generationRequestId,
        aspectRatio: aspectRatio,
        seed: result.seed,
        index: result.results[0].index,
        isBlocked: result.results[0].is_blocked,
        previewUrls: result.results[0].preview_urls,
        originalAsset: result.original_asset,
      },
    };
  } catch (error) {
    logger.error('Error generating image with Getty:', error.response?.data || error.message);
    throw new Error(`Failed to generate image with Getty Images: ${error.message}`);
  }
};

/**
 * Poll Getty Images generation status
 * @param {string} generationRequestId - Request ID
 * @param {string} accessToken - Access token
 * @returns {Promise<object>} Generation result
 */
const pollGenerationStatus = async (generationRequestId, accessToken) => {
  let attempts = 0;

  while (attempts < MAX_POLLING_ATTEMPTS) {
    try {
      const response = await axios.get(
        `${GETTY_API_BASE_URL}/ai/image-generations/${generationRequestId}`,
        {
          headers: {
            'Api-Key': GETTY_API_KEY,
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      // HTTP 200 - Generation complete
      if (response.status === 200) {
        logger.info('Getty image generation completed');
        return response.data;
      }

      // HTTP 202 - Still processing, continue polling
      if (response.status === 202) {
        logger.info(`Getty generation pending, attempt ${attempts + 1}/${MAX_POLLING_ATTEMPTS}`);
        attempts++;
        await sleep(POLLING_INTERVAL);
        continue;
      }

    } catch (error) {
      if (error.response?.status === 202) {
        // Still processing
        logger.info(`Getty generation pending, attempt ${attempts + 1}/${MAX_POLLING_ATTEMPTS}`);
        attempts++;
        await sleep(POLLING_INTERVAL);
        continue;
      }

      // Handle 429 - Too Many Requests
      if (error.response?.status === 429) {
        logger.warn('Getty API rate limit hit, waiting before retry');
        await sleep(1000);
        attempts++;
        continue;
      }

      throw error;
    }
  }

  throw new Error('Getty image generation timeout - max polling attempts reached');
};

/**
 * Download Getty image and upload to Cloudinary
 * @param {string} imageUrl - Getty image URL
 * @param {string} accessToken - Access token
 * @returns {Promise<string>} Cloudinary URL
 */
const downloadAndUploadToCloudinary = async (imageUrl, accessToken) => {
  try {
    // Download image from Getty
    const response = await axios.get(imageUrl, {
      headers: {
        'Api-Key': GETTY_API_KEY,
        'Authorization': `Bearer ${accessToken}`,
      },
      responseType: 'arraybuffer',
    });

    // Convert to base64
    const base64Image = Buffer.from(response.data, 'binary').toString('base64');
    const contentType = response.headers['content-type'];
    const dataURI = `data:${contentType};base64,${base64Image}`;

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'getty-ai-generated',
      resource_type: 'image',
    });

    return result.secure_url;
  } catch (error) {
    logger.error('Error uploading Getty image to Cloudinary:', error);
    throw new Error('Failed to upload image to Cloudinary');
  }
};

/**
 * Sleep helper
 * @param {number} ms - Milliseconds to sleep
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// #endregion

export default {
  generateImageWithGetty,
};
