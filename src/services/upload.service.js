import cloudinary from '../config/cloudinary.js';
import { ValidationError } from '../utils/errors.js';
import logger from '../utils/logger.js';

// Upload single image to Cloudinary
export const uploadImage = async (fileBuffer, options = {}) => {
  try {
    const {
      folder = 'studio-rental',
      public_id,
      transformation = []
    } = options;

    const uploadOptions = {
      folder,
      resource_type: 'image',
      transformation: [
        { width: 1200, height: 1200, crop: 'limit' }, // Max dimensions
        { quality: 'auto' }, // Auto quality optimization
        ...transformation
      ]
    };

    if (public_id) {
      uploadOptions.public_id = public_id;
    }

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(fileBuffer);
    });

    logger.info(`Image uploaded successfully: ${result.public_id}`);
    return {
      public_id: result.public_id,
      url: result.secure_url,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes
    };
  } catch (error) {
    logger.error('Image upload failed:', error);
    throw new ValidationError('Failed to upload image');
  }
};

// Upload video to Cloudinary
export const uploadVideo = async (fileBuffer, options = {}) => {
  try {
    const {
      folder = 'studio-rental/videos',
      public_id,
      transformation = []
    } = options;

    const uploadOptions = {
      folder,
      resource_type: 'video',
      transformation: [
        { width: 1280, height: 720, crop: 'limit' }, // Max dimensions for videos
        { quality: 'auto' }, // Auto quality optimization
        ...transformation
      ]
    };

    if (public_id) {
      uploadOptions.public_id = public_id;
    }

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(fileBuffer);
    });

    // Check video duration (should be under 30 seconds)
    if (result.duration && result.duration > 30) {
      // Delete the uploaded video if it exceeds duration limit
      await deleteFile(result.public_id, 'video');
      throw new ValidationError('Video duration must be under 30 seconds');
    }

    logger.info(`Video uploaded successfully: ${result.public_id}`);
    return {
      public_id: result.public_id,
      url: result.secure_url,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      duration: result.duration
    };
  } catch (error) {
    logger.error('Video upload failed:', error);
    throw new ValidationError('Failed to upload video');
  }
};

// Upload multiple images
export const uploadMultipleImages = async (files, options = {}) => {
  try {
    const uploadPromises = files.map(file =>
      uploadImage(file.buffer, options)
    );

    const results = await Promise.all(uploadPromises);
    logger.info(`Uploaded ${results.length} images successfully`);
    return results;
  } catch (error) {
    logger.error('Multiple images upload failed:', error);
    throw new ValidationError('Failed to upload one or more images');
  }
};

// Delete file from Cloudinary
export const deleteFile = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });

    if (result.result === 'ok') {
      logger.info(`File deleted successfully: ${publicId}`);
      return true;
    } else {
      logger.warn(`File deletion failed: ${publicId}, result: ${result.result}`);
      return false;
    }
  } catch (error) {
    logger.error('File deletion failed:', error);
    throw new ValidationError('Failed to delete file');
  }
};

// Delete multiple files
export const deleteMultipleFiles = async (publicIds, resourceType = 'image') => {
  try {
    const deletePromises = publicIds.map(publicId =>
      deleteFile(publicId, resourceType)
    );

    const results = await Promise.all(deletePromises);
    const successCount = results.filter(result => result).length;

    logger.info(`Deleted ${successCount}/${publicIds.length} files successfully`);
    return results;
  } catch (error) {
    logger.error('Multiple files deletion failed:', error);
    throw new ValidationError('Failed to delete one or more files');
  }
};

// Generate optimized image URL with transformations
export const getOptimizedImageUrl = (publicId, options = {}) => {
  const {
    width,
    height,
    crop = 'fill',
    quality = 'auto',
    format = 'auto'
  } = options;

  return cloudinary.url(publicId, {
    width,
    height,
    crop,
    quality,
    format,
    secure: true
  });
};

// Generate video thumbnail URL
export const getVideoThumbnailUrl = (publicId, options = {}) => {
  const {
    width = 320,
    height = 180,
    time = 0 // Time in seconds for thumbnail
  } = options;

  return cloudinary.url(publicId, {
    width,
    height,
    crop: 'fill',
    quality: 'auto',
    format: 'jpg',
    resource_type: 'video',
    start_offset: time,
    secure: true
  });
};