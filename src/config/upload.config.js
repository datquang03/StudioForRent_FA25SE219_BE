export const FILE_SIZE_LIMITS = {
  AVATAR: 5 * 1024 * 1024,      // 5MB
  STUDIO_IMAGE: 5 * 1024 * 1024, // 5MB
  EQUIPMENT_IMAGE: 3 * 1024 * 1024, // 3MB
  REVIEW_IMAGE: 3 * 1024 * 1024,   // 3MB
  STUDIO_VIDEO: 50 * 1024 * 1024,  // 50MB
  SET_DESIGN_IMAGE: 5 * 1024 * 1024, // 5MB
  MESSAGE_IMAGE: 5 * 1024 * 1024   // 5MB
};

export const ALLOWED_FILE_TYPES = {
  IMAGES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  VIDEOS: ['video/mp4', 'video/avi', 'video/mov', 'video/quicktime']
};
