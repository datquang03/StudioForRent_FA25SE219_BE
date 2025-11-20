// #region Imports
import Studio from '../models/Studio/studio.model.js';
import { createAndSendNotification } from '../services/notification.service.js';
import { STUDIO_STATUS, NOTIFICATION_TYPE, SCHEDULE_STATUS } from '../utils/constants.js';
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
  const { name, description, area, location, basePricePerHour, capacity, images, video } = studioData;
  
  const studio = await Studio.create({
    name,
    description,
    area,
    location,
    basePricePerHour,
    capacity,
    images: images || [],
    video: video || null,
    status: STUDIO_STATUS.ACTIVE,
  });
  
  return studio;
};

export const updateStudio = async (studioId, updateData) => {
  const studio = await Studio.findById(studioId);
  
  if (!studio) {
    throw new NotFoundError('Studio không tồn tại!');
  }
  
  const allowedUpdates = ['name', 'description', 'area', 'location', 'basePricePerHour', 'capacity', 'images', 'video'];
  
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

  // Notify all staff/admin about studio status change
  const { User } = await import('../models/index.js');
  const staff = await User.find({ role: { $in: ['staff', 'admin'] }, isActive: true }).select('_id');

  staff.forEach(async (user) => {
    try {
      await createAndSendNotification(
        user._id,
        NOTIFICATION_TYPE.CHANGE,
        'Studio Status Updated',
        `Studio "${studio.name}" has been changed to status: ${newStatus}.`,
        false,
        null
      );
    } catch (error) {
      console.error(`Failed to notify staff ${user._id}:`, error);
    }
  });

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

/**
 * Get studio availability for a specific date range
 * @param {string} studioId - Studio ID
 * @param {Object} options - Query options
 * @param {Date} options.startDate - Start date for availability check
 * @param {Date} options.endDate - End date for availability check
 * @param {number} options.page - Page number for pagination
 * @param {number} options.limit - Number of results per page
 * @returns {Promise<Object>} Availability information
 */
export const getStudioAvailability = async (studioId, options = {}) => {
  const { startDate, endDate, page = 1, limit = 20 } = options;

  // Validate studio exists and is active
  const studio = await Studio.findById(studioId);
  if (!studio) {
    throw new NotFoundError('Studio không tồn tại!');
  }

  if (studio.status !== STUDIO_STATUS.ACTIVE) {
    return {
      studio: {
        _id: studio._id,
        name: studio.name,
        status: studio.status,
        isAvailable: false,
        reason: `Studio is ${studio.status}`
      },
      availableSlots: [],
      totalSlots: 0,
      pagination: {
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0
      }
    };
  }

  // Build query for available schedules
  const query = {
    studioId,
    status: SCHEDULE_STATUS.AVAILABLE
  };

  // Add date range filter if provided
  if (startDate || endDate) {
    query.startTime = {};
    if (startDate) {
      query.startTime.$gte = new Date(startDate);
    }
    if (endDate) {
      query.startTime.$lte = new Date(endDate);
    }
  }

  // Pagination
  const safePage = Math.max(parseInt(page) || 1, 1);
  const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  // Get available slots with pagination
  const [availableSlots, totalSlots] = await Promise.all([
    Schedule.find(query)
      .sort({ startTime: 1 })
      .skip(skip)
      .limit(safeLimit)
      .populate('studioId', 'name location area capacity basePricePerHour')
      .lean(),
    Schedule.countDocuments(query)
  ]);

  // Format the response
  const formattedSlots = availableSlots.map(slot => ({
    _id: slot._id,
    studioId: slot.studioId._id,
    studioName: slot.studioId.name,
    startTime: slot.startTime,
    endTime: slot.endTime,
    duration: Math.round((slot.endTime - slot.startTime) / (1000 * 60 * 60) * 10) / 10, // hours with 1 decimal
    pricePerHour: slot.studioId.basePricePerHour,
    estimatedPrice: Math.round(
      (slot.endTime - slot.startTime) / (1000 * 60 * 60) * slot.studioId.basePricePerHour
    ),
    date: slot.startTime.toISOString().split('T')[0], // YYYY-MM-DD format
    timeRange: `${slot.startTime.toTimeString().slice(0, 5)} - ${slot.endTime.toTimeString().slice(0, 5)}`
  }));

  return {
    studio: {
      _id: studio._id,
      name: studio.name,
      location: studio.location,
      area: studio.area,
      capacity: studio.capacity,
      basePricePerHour: studio.basePricePerHour,
      status: studio.status,
      isAvailable: true
    },
    availableSlots: formattedSlots,
    totalSlots,
    pagination: {
      total: totalSlots,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(totalSlots / safeLimit)
    }
  };
};

/**
 * Get availability summary for multiple studios
 * @param {Object} options - Query options
 * @param {Date} options.startDate - Start date for availability check
 * @param {Date} options.endDate - End date for availability check
 * @param {number} options.page - Page number for pagination
 * @param {number} options.limit - Number of studios per page
 * @returns {Promise<Object>} Availability summary for multiple studios
 */
export const getStudiosAvailability = async (options = {}) => {
  const { startDate, endDate, page = 1, limit = 10 } = options;

  // Get active studios
  const studiosResult = await getActiveStudios({
    page,
    limit,
    sortBy: 'name',
    sortOrder: 'asc'
  });

  // For each studio, get availability count
  const studiosWithAvailability = await Promise.all(
    studiosResult.studios.map(async (studio) => {
      const query = {
        studioId: studio._id,
        status: SCHEDULE_STATUS.AVAILABLE
      };

      // Add date range filter if provided
      if (startDate || endDate) {
        query.startTime = {};
        if (startDate) {
          query.startTime.$gte = new Date(startDate);
        }
        if (endDate) {
          query.startTime.$lte = new Date(endDate);
        }
      }

      const availableCount = await Schedule.countDocuments(query);

      return {
        _id: studio._id,
        name: studio.name,
        location: studio.location,
        area: studio.area,
        capacity: studio.capacity,
        basePricePerHour: studio.basePricePerHour,
        availableSlots: availableCount,
        isAvailable: availableCount > 0
      };
    })
  );

  return {
    studios: studiosWithAvailability,
    pagination: studiosResult.pagination
  };
};

/**
 * Check if a specific time slot is available for a studio
 * @param {string} studioId - Studio ID
 * @param {Date} startTime - Start time
 * @param {Date} endTime - End time
 * @returns {Promise<Object>} Availability check result
 */
export const checkTimeSlotAvailability = async (studioId, startTime, endTime) => {
  // Validate studio exists and is active
  const studio = await Studio.findById(studioId);
  if (!studio) {
    throw new NotFoundError('Studio không tồn tại!');
  }

  if (studio.status !== STUDIO_STATUS.ACTIVE) {
    return {
      studioId,
      studioName: studio.name,
      isAvailable: false,
      reason: `Studio is ${studio.status}`,
      requestedSlot: {
        startTime,
        endTime
      }
    };
  }

  // Check for conflicting schedules (including minimum 30-minute gap)
  const MIN_GAP_MS = 30 * 60 * 1000; // 30 minutes in ms
  const conflict = await Schedule.findOne({
    studioId,
    startTime: { $lt: new Date(endTime.getTime() + MIN_GAP_MS) },
    endTime: { $gt: new Date(startTime.getTime() - MIN_GAP_MS) },
    status: { $ne: SCHEDULE_STATUS.CANCELLED } // Exclude cancelled slots
  });

  const isAvailable = !conflict;

  return {
    studioId,
    studioName: studio.name,
    isAvailable,
    reason: isAvailable ? null : 'Time slot conflicts with existing booking or is too close to another slot',
    requestedSlot: {
      startTime,
      endTime,
      duration: Math.round((endTime - startTime) / (1000 * 60 * 60) * 10) / 10 // hours
    },
    conflictingSlot: conflict ? {
      _id: conflict._id,
      startTime: conflict.startTime,
      endTime: conflict.endTime,
      status: conflict.status
    } : null
  };
};

/**
 * Get booked schedules for a specific studio
 * @param {string} studioId - Studio ID
 * @param {Object} options - Query options
 * @param {Date} options.startDate - Start date for booking check
 * @param {Date} options.endDate - End date for booking check
 * @param {number} options.page - Page number for pagination
 * @param {number} options.limit - Number of results per page
 * @returns {Promise<Object>} Booked schedules information
 */
export const getStudioBookedSchedules = async (studioId, options = {}) => {
  const { startDate, endDate, page = 1, limit = 20 } = options;

  // Validate studio exists
  const studio = await Studio.findById(studioId);
  if (!studio) {
    throw new NotFoundError('Studio không tồn tại!');
  }

  // Build query for booked schedules
  const query = {
    studioId,
    status: SCHEDULE_STATUS.BOOKED
  };

  // Add date range filter if provided
  if (startDate || endDate) {
    query.startTime = {};
    if (startDate) {
      query.startTime.$gte = new Date(startDate);
    }
    if (endDate) {
      query.startTime.$lte = new Date(endDate);
    }
  }

  // Pagination
  const safePage = Math.max(parseInt(page) || 1, 1);
  const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  // Get booked slots with pagination and populate booking info
  const [bookedSlots, totalSlots] = await Promise.all([
    Schedule.find(query)
      .sort({ startTime: 1 })
      .skip(skip)
      .limit(safeLimit)
      .populate({
        path: 'bookingId',
        select: 'userId totalBeforeDiscount finalAmount status payType',
        populate: {
          path: 'userId',
          select: 'fullName username phone'
        }
      })
      .lean(),
    Schedule.countDocuments(query)
  ]);

  // Format the response
  const formattedSlots = bookedSlots.map(slot => ({
    _id: slot._id,
    studioId: slot.studioId,
    startTime: slot.startTime,
    endTime: slot.endTime,
    duration: Math.round((slot.endTime - slot.startTime) / (1000 * 60 * 60) * 10) / 10, // hours with 1 decimal
    date: slot.startTime.toISOString().split('T')[0], // YYYY-MM-DD format
    timeRange: `${slot.startTime.toTimeString().slice(0, 5)} - ${slot.endTime.toTimeString().slice(0, 5)}`,
    booking: slot.bookingId ? {
      _id: slot.bookingId._id,
      customer: {
        _id: slot.bookingId.userId._id,
        fullName: slot.bookingId.userId.fullName,
        username: slot.bookingId.userId.username,
        phone: slot.bookingId.userId.phone
      },
      totalBeforeDiscount: slot.bookingId.totalBeforeDiscount,
      finalAmount: slot.bookingId.finalAmount,
      status: slot.bookingId.status,
      payType: slot.bookingId.payType
    } : null
  }));

  return {
    studio: {
      _id: studio._id,
      name: studio.name,
      location: studio.location,
      status: studio.status
    },
    bookedSlots: formattedSlots,
    totalSlots,
    pagination: {
      total: totalSlots,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(totalSlots / safeLimit)
    }
  };
};

/**
 * Get booked schedules summary for multiple studios
 * @param {Object} options - Query options
 * @param {Date} options.startDate - Start date for booking check
 * @param {Date} options.endDate - End date for booking check
 * @param {number} options.page - Page number for pagination
 * @param {number} options.limit - Number of studios per page
 * @returns {Promise<Object>} Booked schedules summary for multiple studios
 */
export const getStudiosBookedSchedules = async (options = {}) => {
  const { startDate, endDate, page = 1, limit = 10 } = options;

  // Get active studios
  const studiosResult = await getActiveStudios({
    page,
    limit,
    sortBy: 'name',
    sortOrder: 'asc'
  });

  // For each studio, get booked schedules count and revenue
  const studiosWithBookings = await Promise.all(
    studiosResult.studios.map(async (studio) => {
      const query = {
        studioId: studio._id,
        status: SCHEDULE_STATUS.BOOKED
      };

      // Add date range filter if provided
      if (startDate || endDate) {
        query.startTime = {};
        if (startDate) {
          query.startTime.$gte = new Date(startDate);
        }
        if (endDate) {
          query.startTime.$lte = new Date(endDate);
        }
      }

      // Get booked slots count and total revenue
      const [bookedCount, revenueResult] = await Promise.all([
        Schedule.countDocuments(query),
        Schedule.aggregate([
          { $match: query },
          {
            $lookup: {
              from: 'bookings',
              localField: 'bookingId',
              foreignField: '_id',
              as: 'booking'
            }
          },
          { $unwind: '$booking' },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$booking.finalAmount' },
              totalDuration: {
                $sum: {
                  $divide: [
                    { $subtract: ['$endTime', '$startTime'] },
                    1000 * 60 * 60 // Convert to hours
                  ]
                }
              }
            }
          }
        ])
      ]);

      const revenue = revenueResult.length > 0 ? revenueResult[0] : { totalRevenue: 0, totalDuration: 0 };

      return {
        _id: studio._id,
        name: studio.name,
        location: studio.location,
        area: studio.area,
        capacity: studio.capacity,
        basePricePerHour: studio.basePricePerHour,
        bookedSlots: bookedCount,
        totalRevenue: revenue.totalRevenue,
        totalBookedHours: Math.round(revenue.totalDuration * 10) / 10,
        utilizationRate: revenue.totalDuration > 0 ?
          Math.round((revenue.totalDuration / (24 * 30)) * 100 * 10) / 10 : 0 // Rough monthly utilization %
      };
    })
  );

  return {
    studios: studiosWithBookings,
    pagination: studiosResult.pagination
  };
};

// #endregion
