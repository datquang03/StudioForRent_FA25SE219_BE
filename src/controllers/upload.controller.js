import {
  uploadImage,
  uploadVideo,
  uploadMultipleImages,
  deleteFile,
  getOptimizedImageUrl,
  getVideoThumbnailUrl
} from '../services/upload.service.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import logger from '../utils/logger.js';

// Upload user avatar
export const uploadAvatarController = async (req, res) => {
  try {
    if (!req.file) {
      throw new ValidationError('No avatar file provided');
    }

    const userId = req.user.id;
    const folder = `studio-rental/users/${userId}/avatar`;

    const result = await uploadImage(req.file, {
      folder,
      public_id: `avatar_${Date.now()}`
    });

    res.status(200).json({
      success: true,
      message: 'Tải lên avatar thành công',
      data: {
        avatar: result
      }
    });
  } catch (error) {
    logger.error('Avatar upload error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to upload avatar'
    });
  }
};

// Upload single image (generic)
export const uploadImageController = async (req, res) => {
  try {
    if (!req.file) {
      throw new ValidationError('No image file provided');
    }

    const { folder = 'studio-rental/general' } = req.body;

    const result = await uploadImage(req.file, { folder });

    res.status(200).json({
      success: true,
      message: 'Tải lên hình ảnh thành công',
      data: {
        image: result
      }
    });
  } catch (error) {
    logger.error('Image upload error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to upload image'
    });
  }
};

// Upload video
export const uploadVideoController = async (req, res) => {
  try {
    if (!req.file) {
      throw new ValidationError('No video file provided');
    }

    const { folder = 'studio-rental/videos' } = req.body;

    const result = await uploadVideo(req.file, { folder });

    res.status(200).json({
      success: true,
      message: 'Tải lên video thành công',
      data: {
        video: result,
        thumbnail: getVideoThumbnailUrl(result.public_id)
      }
    });
  } catch (error) {
    logger.error('Video upload error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to upload video'
    });
  }
};

// Upload multiple images
export const uploadMultipleImagesController = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      throw new ValidationError('No image files provided');
    }

    const { folder = 'studio-rental/gallery' } = req.body;

    const results = await uploadMultipleImages(req.files, { folder });

    res.status(200).json({
      success: true,
      message: `${results.length} images uploaded successfully`,
      data: {
        images: results
      }
    });
  } catch (error) {
    logger.error('Multiple images upload error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to upload images'
    });
  }
};

// Upload studio images and video
export const uploadStudioMediaController = async (req, res) => {
  try {
    const uploadedMedia = {
      images: [],
      video: null
    };

    // Handle images
    if (req.files.images && req.files.images.length > 0) {
      const imageResults = await uploadMultipleImages(req.files.images, {
        folder: 'studio-rental/studios'
      });
      uploadedMedia.images = imageResults;
    }

    // Handle video
    if (req.files.video && req.files.video.length > 0) {
      const videoResult = await uploadVideo(req.files.video[0], {
        folder: 'studio-rental/studios/videos'
      });
      uploadedMedia.video = videoResult;
    }

    if (uploadedMedia.images.length === 0 && !uploadedMedia.video) {
      throw new ValidationError('No media files provided');
    }

    res.status(200).json({
      success: true,
      message: 'Tải lên media studio thành công',
      data: uploadedMedia
    });
  } catch (error) {
    logger.error('Studio media upload error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to upload studio media'
    });
  }
};

// Upload equipment image
export const uploadEquipmentImageController = async (req, res) => {
  try {
    if (!req.file) {
      throw new ValidationError('No equipment image provided');
    }

    const { equipmentId } = req.params;
    const folder = `studio-rental/equipment/${equipmentId}`;

    const result = await uploadImage(req.file, {
      folder,
      public_id: `equipment_${equipmentId}_${Date.now()}`
    });

    res.status(200).json({
      success: true,
      message: 'Tải lên hình ảnh thiết bị thành công',
      data: {
        image: result
      }
    });
  } catch (error) {
    logger.error('Equipment image upload error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to upload equipment image'
    });
  }
};

// Upload review images
export const uploadReviewImagesController = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      throw new ValidationError('No review images provided');
    }

    const { reviewId } = req.params;
    const folder = `studio-rental/reviews/${reviewId}`;

    const results = await uploadMultipleImages(req.files, { folder });

    res.status(200).json({
      success: true,
      message: `${results.length} review images uploaded successfully`,
      data: {
        images: results
      }
    });
  } catch (error) {
    logger.error('Review images upload error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to upload review images'
    });
  }
};

// Upload set design images
export const uploadSetDesignImagesController = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      throw new ValidationError('No set design images provided');
    }

    const { setDesignId } = req.params;
    const folder = `studio-rental/set-designs/${setDesignId}`;

    const results = await uploadMultipleImages(req.files, { folder });

    res.status(200).json({
      success: true,
      message: `${results.length} set design images uploaded successfully`,
      data: {
        images: results
      }
    });
  } catch (error) {
    logger.error('Set design images upload error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to upload set design images'
    });
  }
};

// Delete image
export const deleteImageController = async (req, res) => {
  try {
    const { publicId } = req.params;
    const { resourceType = 'image' } = req.query;

    if (!publicId) {
      throw new ValidationError('Public ID is required');
    }

    const success = await deleteFile(publicId, resourceType);

    if (success) {
      res.status(200).json({
        success: true,
        message: 'Xóa file thành công'
      });
    } else {
      throw new NotFoundError('File not found or already deleted');
    }
  } catch (error) {
    logger.error('File deletion error:', error);
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || 'Failed to delete file'
    });
  }
};

// Get optimized image URL
export const getOptimizedImageController = async (req, res) => {
  try {
    const { publicId } = req.params;
    const { width, height, quality = 'auto' } = req.query;

    if (!publicId) {
      throw new ValidationError('Public ID is required');
    }

    const optimizedUrl = getOptimizedImageUrl(publicId, {
      width: width ? parseInt(width) : undefined,
      height: height ? parseInt(height) : undefined,
      quality
    });

    res.status(200).json({
      success: true,
      data: {
        url: optimizedUrl
      }
    });
  } catch (error) {
    logger.error('Get optimized image error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to get optimized image'
    });
  }
};