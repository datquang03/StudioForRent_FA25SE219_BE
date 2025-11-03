// #region Imports
import Studio from '../models/Studio/studio.model.js';
import { STUDIO_STATUS } from '../utils/constants.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
// #endregion

// #region Get Studios
export const getAllStudios = async ({ page = 1, limit = 10, status, search, sortBy = 'createdAt', sortOrder = 'desc' }) => {
  const query = {};
  
  if (status && Object.values(STUDIO_STATUS).includes(status)) {
    query.status = status;
  }
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }
  
  const skip = (page - 1) * limit;
  const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
  
  const [studios, total] = await Promise.all([
    Studio.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean(),
    Studio.countDocuments(query),
  ]);
  
  return {
    studios,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getStudioById = async (studioId) => {
  const studio = await Studio.findById(studioId).lean();
  
  if (!studio) {
    throw new NotFoundError('Studio không tồn tại!');
  }
  
  return studio;
};
// #endregion

// #region Create & Update Studios
export const createStudio = async (studioData) => {
  const { name, description, basePricePerHour, capacity, images } = studioData;
  
  const studio = await Studio.create({
    name,
    description,
    basePricePerHour,
    capacity,
    images: images || [],
    status: STUDIO_STATUS.ACTIVE,
  });
  
  return studio;
};

export const updateStudio = async (studioId, updateData) => {
  const studio = await Studio.findById(studioId);
  
  if (!studio) {
    throw new NotFoundError('Studio không tồn tại!');
  }
  
  const allowedUpdates = ['name', 'description', 'area', 'location', 'basePricePerHour', 'capacity', 'images'];
  
  allowedUpdates.forEach((field) => {
    if (updateData[field] !== undefined) {
      studio[field] = updateData[field];
    }
  });
  
  await studio.save();
  
  return studio;
};
// #endregion

// #region Change Status & Delete
export const changeStudioStatus = async (studioId, newStatus) => {
  if (!Object.values(STUDIO_STATUS).includes(newStatus)) {
    throw new ValidationError('Status không hợp lệ!');
  }
  
  const studio = await Studio.findById(studioId);
  
  if (!studio) {
    throw new NotFoundError('Studio không tồn tại!');
  }
  
  studio.status = newStatus;
  await studio.save();
  
  return studio;
};

export const deleteStudio = async (studioId) => {
  const studio = await Studio.findById(studioId);
  
  if (!studio) {
    throw new NotFoundError('Studio không tồn tại!');
  }
  
  await Studio.findByIdAndDelete(studioId);
  
  return { message: 'Xóa studio thành công!' };
};
// #endregion

// #region Helper Functions
export const getActiveStudios = async ({ page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' }) => {
  return getAllStudios({
    page,
    limit,
    status: STUDIO_STATUS.ACTIVE,
    search,
    sortBy,
    sortOrder,
  });
};
// #endregion
