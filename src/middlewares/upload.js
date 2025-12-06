import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ValidationError } from '../utils/errors.js';

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  AVATAR: 5 * 1024 * 1024,      // 5MB
  STUDIO_IMAGE: 5 * 1024 * 1024, // 5MB
  EQUIPMENT_IMAGE: 3 * 1024 * 1024, // 3MB
  REVIEW_IMAGE: 3 * 1024 * 1024,   // 3MB
  STUDIO_VIDEO: 50 * 1024 * 1024,  // 50MB
  SET_DESIGN_IMAGE: 5 * 1024 * 1024 // 5MB
};

// Allowed file types
export const ALLOWED_FILE_TYPES = {
  IMAGES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  VIDEOS: ['video/mp4', 'video/avi', 'video/mov', 'video/quicktime']
};

// Configure multer storage (disk storage to avoid large memory usage)
const uploadTempDir = path.join(process.cwd(), 'uploads', 'temp');
// Ensure directory exists
if (!fs.existsSync(uploadTempDir)) {
  fs.mkdirSync(uploadTempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadTempDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext).replace(/\s+/g, '_');
    cb(null, `${baseName}_${Date.now()}${ext}`);
  }
});

// File filter function
const createFileFilter = (allowedTypes, maxSize) => {
  return (req, file, cb) => {
    // Check file type
    if (!allowedTypes.includes(file.mimetype)) {
      const error = new ValidationError(
        `File type ${file.mimetype} not allowed. Allowed types: ${allowedTypes.join(', ')}`
      );
      return cb(error, false);
    }

    // Check file size
    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
      const error = new ValidationError(
        `File size exceeds ${maxSizeMB}MB limit`
      );
      return cb(error, false);
    }

    cb(null, true);
  };
};

// Video duration validation (for videos under 30 seconds)
export const validateVideoDuration = (buffer) => {
  // This is a simplified check - in production you'd use ffprobe or similar
  // For now, we'll rely on client-side validation and Cloudinary's processing
  return true;
};

// Create multer instances for different upload types
export const upload = {
  // Single file uploads
  single: (fieldName, allowedTypes, maxSize) => {
    const fileFilter = createFileFilter(allowedTypes, maxSize);
    return multer({
      storage,
      fileFilter,
      limits: { fileSize: maxSize }
    }).single(fieldName);
  },

  // Multiple file uploads
  array: (fieldName, maxCount, allowedTypes, maxSize) => {
    const fileFilter = createFileFilter(allowedTypes, maxSize);
    return multer({
      storage,
      fileFilter,
      limits: { fileSize: maxSize, files: maxCount }
    }).array(fieldName, maxCount);
  },

  // Mixed file uploads (for studio: images + video)
  fields: (fields) => {
    return multer({
      storage,
      fileFilter: (req, file, cb) => {
        // Custom file filter for mixed uploads
        const fieldConfig = fields.find(field => field.name === file.fieldname);
        if (!fieldConfig) {
          return cb(new ValidationError(`Unexpected field: ${file.fieldname}`), false);
        }

        const allowedTypes = fieldConfig.allowedTypes;
        const maxSize = fieldConfig.maxSize;

        if (!allowedTypes.includes(file.mimetype)) {
          const error = new ValidationError(
            `File type ${file.mimetype} not allowed for ${file.fieldname}. Allowed types: ${allowedTypes.join(', ')}`
          );
          return cb(error, false);
        }

        if (file.size > maxSize) {
          const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
          const error = new ValidationError(
            `File size exceeds ${maxSizeMB}MB limit for ${file.fieldname}`
          );
          return cb(error, false);
        }

        cb(null, true);
      },
      limits: {
        fileSize: Math.max(...fields.map(f => f.maxSize)),
        files: fields.reduce((sum, f) => sum + (f.maxCount || 1), 0)
      }
    }).fields(fields.map(f => ({ name: f.name, maxCount: f.maxCount || 1 })));
  }
};

// Validation middleware for file size (additional check)
export const validateFileSize = (req, res, next) => {
  if (!req.file && !req.files) {
    return next();
  }

  // Additional validation can be added here if needed
  next();
};

// Error handler for multer errors
export const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files uploaded'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field'
      });
    }
  }

  next(error);
};