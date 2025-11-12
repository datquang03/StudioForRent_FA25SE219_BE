// #region Imports
import Studio from '../models/Studio/studio.model.js';
import { STUDIO_STATUS } from '../utils/constants.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { escapeRegex } from '../utils/helpers.js';
// #endregion

// #region Get Studios
export const getAllStudios = async ({ page = 1, limit = 10, status, search, sortBy = 'createdAt', sortOrder = 'desc' }) => {
  // Validate and sanitize pagination
  const safePage = Math.max(parseInt(page) || 1, 1);
  const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
  
  // Validate and sanitize search (prevent ReDoS)
  const safeSearch = search && search.length > 100 ? search.substring(0, 100) : search;
  
  const query = {};
  
  if (status && Object.values(STUDIO_STATUS).includes(status)) {
    query.status = status;
  }
  
  if (safeSearch) {
    const escapedSearch = escapeRegex(safeSearch);
    query.$or = [
      { name: { $regex: escapedSearch, $options: 'i' } },
      { description: { $regex: escapedSearch, $options: 'i' } },
    ];
  }
  
  const skip = (safePage - 1) * safeLimit;
  const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
  
  const [studios, total] = await Promise.all([
    Studio.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    Studio.countDocuments(query),
  ]);
  
  return {
    studios,
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
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
  const { name, description, area, location, basePricePerHour, capacity, images } = studioData;
  
  const studio = await Studio.create({
    name,
    description,
    area,
    location,
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
