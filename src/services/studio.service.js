// #region Imports
import Studio from '../models/Studio/studio.model.js';
import { Schedule } from '../models/index.js';
import { createAndSendNotification } from '../services/notification.service.js';
import { STUDIO_STATUS, NOTIFICATION_TYPE, SCHEDULE_STATUS } from '../utils/constants.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { escapeRegex } from '../utils/helpers.js';
import { cacheGet, cacheSet } from '../utils/cache.js';
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
  const cacheKey = `studio:${studioId}`;
  
  // Try to get from cache first
  const cachedStudio = await cacheGet(cacheKey);
  if (cachedStudio) {
    return cachedStudio;
  }
  
  // If not in cache, query database
  const studio = await Studio.findById(studioId).lean();
  
  if (!studio) {
    throw new NotFoundError('Studio không tồn tại!');
  }
  
  // Cache the result for 5 minutes (300 seconds)
  await cacheSet(cacheKey, studio, 300);
  
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
  
  // Invalidate cache after update
  const cacheKey = `studio:${studioId}`;
  await cacheSet(cacheKey, null); // Delete cache
  
  return studio;
};

export const addStudioImages = async (studioId, newImages) => {
  const studio = await Studio.findById(studioId);
  
  if (!studio) {
    throw new NotFoundError('Studio không tồn tại!');
  }
  
  if (newImages && newImages.length > 0) {
    // Append new images to existing array
    studio.images = [...studio.images, ...newImages];
    await studio.save();
    
    // Invalidate cache
    const cacheKey = `studio:${studioId}`;
    await cacheSet(cacheKey, null);
  }
  
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

  // Invalidate cache after status change
  const cacheKey = `studio:${studioId}`;
  await cacheSet(cacheKey, null); // Delete cache

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

  // Check for future bookings
  const futureBookings = await Schedule.exists({
    studioId,
    status: { $in: [SCHEDULE_STATUS.BOOKED, SCHEDULE_STATUS.ONGOING] },
    startTime: { $gt: new Date() }
  });

  if (futureBookings) {
    throw new ValidationError('Không thể xóa studio đang có lịch đặt trong tương lai! Hãy hủy lịch hoặc chuyển trạng thái sang bảo trì.');
  }

  await Studio.findByIdAndDelete(studioId);
  
  // Invalidate cache after delete
  const cacheKey = `studio:${studioId}`;
  await cacheSet(cacheKey, null); // Delete cache
  
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
 * Get studio schedule (booked/ongoing) for a specific date range
 * @param {string} studioId - Studio ID
 * @param {Object} options - Query options
 * @param {Date} options.startDate - Start date for schedule check
 * @param {Date} options.endDate - End date for schedule check
 * @returns {Promise<Object>} Schedule information grouped by date
 */
export const getStudioSchedule = async (studioId, options = {}) => {
  const { startDate, endDate } = options;

  // Validate studio exists
  const studio = await Studio.findById(studioId);
  if (!studio) {
    throw new NotFoundError('Studio không tồn tại!');
  }

  // Build query for booked/ongoing schedules
  const query = {
    studioId,
    status: { $in: [SCHEDULE_STATUS.BOOKED, SCHEDULE_STATUS.ONGOING] }
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

  // Get all booked/ongoing schedules
  const schedules = await Schedule.find(query)
    .sort({ startTime: 1 })
    .populate({
      path: 'bookingId',
      select: 'userId totalBeforeDiscount finalAmount status payType',
      populate: {
        path: 'userId',
        select: 'fullName username phone email'
      }
    })
    .lean();

  // Group schedules by date
  const scheduleByDate = {};
  
  schedules.forEach(slot => {
    const date = slot.startTime.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    if (!scheduleByDate[date]) {
      scheduleByDate[date] = [];
    }
    
    scheduleByDate[date].push({
      _id: slot._id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      duration: Math.round((slot.endTime - slot.startTime) / (1000 * 60 * 60) * 10) / 10,
      timeRange: `${slot.startTime.toTimeString().slice(0, 5)} - ${slot.endTime.toTimeString().slice(0, 5)}`,
      status: slot.status,
      booking: slot.bookingId ? {
        _id: slot.bookingId._id,
        customer: {
          _id: slot.bookingId.userId._id,
          fullName: slot.bookingId.userId.fullName,
          username: slot.bookingId.userId.username,
          phone: slot.bookingId.userId.phone,
          email: slot.bookingId.userId.email
        },
        totalBeforeDiscount: slot.bookingId.totalBeforeDiscount,
        finalAmount: slot.bookingId.finalAmount,
        status: slot.bookingId.status,
        payType: slot.bookingId.payType
      } : null
    });
  });

  return {
    studio: {
      _id: studio._id,
      name: studio.name,
      location: studio.location,
      area: studio.area,
      capacity: studio.capacity,
      basePricePerHour: studio.basePricePerHour,
      status: studio.status
    },
    scheduleByDate,
    totalSchedules: schedules.length,
    dateRange: {
      startDate: startDate || null,
      endDate: endDate || null
    }
  };
};

/**
 * Get schedules for all studios on a single specific date
 * @param {Date} date - Specific date to check
 * @param {number} page - Page number for pagination
 * @param {number} limit - Number of studios per page
 * @returns {Promise<Object>} Schedule information for all studios on the specific date
 */
/**
 * Get studio schedule (booked/ongoing) for a specific studio on a specific date
 * @param {string} studioId - Studio ID
 * @param {Date} date - Target date
 * @returns {Promise<Object>} Schedule information for the studio on that date
 */
export const getStudioScheduleByDate = async (studioId, date) => {
  // Validate studio exists
  const studio = await Studio.findById(studioId);
  if (!studio) {
    throw new NotFoundError('Studio không tồn tại!');
  }

  // Parse the date and set to start/end of day
  const targetDate = new Date(date);
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Build query for booked/ongoing schedules for this studio on this date
  const query = {
    studioId,
    status: { $in: [SCHEDULE_STATUS.BOOKED, SCHEDULE_STATUS.ONGOING] },
    startTime: { $gte: startOfDay, $lte: endOfDay }
  };

  // Get all booked/ongoing schedules for this studio on this date
  const schedules = await Schedule.find(query)
    .sort({ startTime: 1 })
    .populate({
      path: 'bookingId',
      select: 'userId totalBeforeDiscount finalAmount status payType',
      populate: {
        path: 'userId',
        select: 'fullName username phone email'
      }
    })
    .lean();

  // Format schedules
  const formattedSchedules = schedules.map(slot => ({
    _id: slot._id,
    startTime: slot.startTime,
    endTime: slot.endTime,
    duration: Math.round((slot.endTime - slot.startTime) / (1000 * 60 * 60) * 10) / 10,
    timeRange: `${slot.startTime.toTimeString().slice(0, 5)} - ${slot.endTime.toTimeString().slice(0, 5)}`,
    status: slot.status,
    booking: slot.bookingId ? {
      _id: slot.bookingId._id,
      customer: {
        _id: slot.bookingId.userId._id,
        fullName: slot.bookingId.userId.fullName,
        username: slot.bookingId.userId.username,
        phone: slot.bookingId.userId.phone,
        email: slot.bookingId.userId.email
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
      area: studio.area,
      capacity: studio.capacity,
      basePricePerHour: studio.basePricePerHour
    },
    date: targetDate.toISOString().split('T')[0],
    schedules: formattedSchedules,
    totalSchedules: formattedSchedules.length
  };
};

/**
 * Get schedules for all studios by date range
 * @param {Object} options - Query options
 * @param {Date} options.startDate - Start date for schedule check
 * @param {Date} options.endDate - End date for schedule check
 * @param {number} options.page - Page number for pagination
 * @param {number} options.limit - Number of studios per page
 * @returns {Promise<Object>} Schedule summary for multiple studios grouped by date
 */
export const getStudiosSchedule = async (options = {}) => {
  const { startDate, endDate, page = 1, limit = 10 } = options;

  // Get active studios
  const studiosResult = await getActiveStudios({
    page,
    limit,
    sortBy: 'name',
    sortOrder: 'asc'
  });

  // For each studio, get booked/ongoing schedules grouped by date
  const studiosWithSchedules = await Promise.all(
    studiosResult.studios.map(async (studio) => {
      const query = {
        studioId: studio._id,
        status: { $in: [SCHEDULE_STATUS.BOOKED, SCHEDULE_STATUS.ONGOING] }
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

      // Get all booked/ongoing schedules for this studio
      const schedules = await Schedule.find(query)
        .sort({ startTime: 1 })
        .populate({
          path: 'bookingId',
          select: 'userId totalBeforeDiscount finalAmount status payType',
          populate: {
            path: 'userId',
            select: 'fullName username phone email'
          }
        })
        .lean();

      // Group schedules by date
      const scheduleByDate = {};
      
      schedules.forEach(slot => {
        const date = slot.startTime.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        if (!scheduleByDate[date]) {
          scheduleByDate[date] = [];
        }
        
        scheduleByDate[date].push({
          _id: slot._id,
          startTime: slot.startTime,
          endTime: slot.endTime,
          duration: Math.round((slot.endTime - slot.startTime) / (1000 * 60 * 60) * 10) / 10,
          timeRange: `${slot.startTime.toTimeString().slice(0, 5)} - ${slot.endTime.toTimeString().slice(0, 5)}`,
          status: slot.status,
          booking: slot.bookingId ? {
            _id: slot.bookingId._id,
            customer: {
              _id: slot.bookingId.userId._id,
              fullName: slot.bookingId.userId.fullName,
              username: slot.bookingId.userId.username,
              phone: slot.bookingId.userId.phone,
              email: slot.bookingId.userId.email
            },
            totalBeforeDiscount: slot.bookingId.totalBeforeDiscount,
            finalAmount: slot.bookingId.finalAmount,
            status: slot.bookingId.status,
            payType: slot.bookingId.payType
          } : null
        });
      });

      return {
        _id: studio._id,
        name: studio.name,
        location: studio.location,
        area: studio.area,
        capacity: studio.capacity,
        basePricePerHour: studio.basePricePerHour,
        scheduleByDate,
        totalSchedules: schedules.length
      };
    })
  );

  return {
    studios: studiosWithSchedules,
    pagination: studiosResult.pagination,
    dateRange: {
      startDate: startDate || null,
      endDate: endDate || null
    }
  };
};

/**
 * Get schedules for all studios by a single specific date
 * @param {Date} date - Specific date to check
 * @param {number} page - Page number for pagination
 * @param {number} limit - Number of studios per page
 * @returns {Promise<Object>} Schedule information for all studios on the specific date
 */
export const getStudiosScheduleByDate = async (date, page = 1, limit = 10) => {
  // Parse the date and set to start/end of day
  const targetDate = new Date(date);
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Get active studios
  const studiosResult = await getActiveStudios({
    page,
    limit,
    sortBy: 'name',
    sortOrder: 'asc'
  });

  // For each studio, get booked/ongoing schedules for this date
  const studiosWithSchedules = await Promise.all(
    studiosResult.studios.map(async (studio) => {
      const query = {
        studioId: studio._id,
        status: { $in: [SCHEDULE_STATUS.BOOKED, SCHEDULE_STATUS.ONGOING] },
        startTime: { $gte: startOfDay, $lte: endOfDay }
      };

      // Get all booked/ongoing schedules for this studio on this date
      const schedules = await Schedule.find(query)
        .sort({ startTime: 1 })
        .populate({
          path: 'bookingId',
          select: 'userId totalBeforeDiscount finalAmount status payType',
          populate: {
            path: 'userId',
            select: 'fullName username phone email'
          }
        })
        .lean();

      // Format schedules
      const formattedSchedules = schedules.map(slot => ({
        _id: slot._id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        duration: Math.round((slot.endTime - slot.startTime) / (1000 * 60 * 60) * 10) / 10,
        timeRange: `${slot.startTime.toTimeString().slice(0, 5)} - ${slot.endTime.toTimeString().slice(0, 5)}`,
        status: slot.status,
        booking: slot.bookingId ? {
          _id: slot.bookingId._id,
          customer: {
            _id: slot.bookingId.userId._id,
            fullName: slot.bookingId.userId.fullName,
            username: slot.bookingId.userId.username,
            phone: slot.bookingId.userId.phone,
            email: slot.bookingId.userId.email
          },
          totalBeforeDiscount: slot.bookingId.totalBeforeDiscount,
          finalAmount: slot.bookingId.finalAmount,
          status: slot.bookingId.status,
          payType: slot.bookingId.payType
        } : null
      }));

      return {
        _id: studio._id,
        name: studio.name,
        location: studio.location,
        area: studio.area,
        capacity: studio.capacity,
        basePricePerHour: studio.basePricePerHour,
        schedules: formattedSchedules,
        totalSchedules: formattedSchedules.length
      };
    })
  );

  return {
    date: targetDate.toISOString().split('T')[0],
    studios: studiosWithSchedules,
    pagination: studiosResult.pagination
  };
};

/**
 * Get availability summary for multiple studios
 * @param {Object} options - Query options
 * @param {Date} options.startDate - Start date for availability check
 * @param {Date} options.endDate - End date for availability check
 * @param {number} options.page - Page number for pagination
 * @param {number} options.limit - Number of studios per page
 * @returns {Promise<Object>} Availability summary with time slots grouped by date for each studio
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

  // For each studio, get available slots grouped by date
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

      // Get all available slots for this studio
      const availableSlots = await Schedule.find(query)
        .sort({ startTime: 1 })
        .lean();

      // Group slots by date
      const availabilityByDate = {};
      
      availableSlots.forEach(slot => {
        const date = slot.startTime.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        if (!availabilityByDate[date]) {
          availabilityByDate[date] = [];
        }
        
        availabilityByDate[date].push({
          _id: slot._id,
          startTime: slot.startTime,
          endTime: slot.endTime,
          duration: Math.round((slot.endTime - slot.startTime) / (1000 * 60 * 60) * 10) / 10, // hours with 1 decimal
          timeRange: `${slot.startTime.toTimeString().slice(0, 5)} - ${slot.endTime.toTimeString().slice(0, 5)}`,
          pricePerHour: studio.basePricePerHour,
          estimatedPrice: Math.round(
            (slot.endTime - slot.startTime) / (1000 * 60 * 60) * studio.basePricePerHour
          )
        });
      });

      return {
        _id: studio._id,
        name: studio.name,
        location: studio.location,
        area: studio.area,
        capacity: studio.capacity,
        basePricePerHour: studio.basePricePerHour,
        availabilityByDate,
        totalSlots: availableSlots.length,
        isAvailable: availableSlots.length > 0
      };
    })
  );

  return {
    studios: studiosWithAvailability,
    pagination: studiosResult.pagination,
    dateRange: {
      startDate: startDate || null,
      endDate: endDate || null
    }
  };
};

/**
 * Get booked history for a specific studio
 * @param {string} studioId - Studio ID
 * @param {Object} options - Query options
 * @param {Date} options.startDate - Start date for booking check
 * @param {Date} options.endDate - End date for booking check
 * @returns {Promise<Object>} Booked history information
 */
export const getStudioBookedHistory = async (studioId, options = {}) => {
  const { startDate, endDate } = options;

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

  // Get all booked slots and populate booking info with details
  const bookedSlots = await Schedule.find(query)
    .sort({ startTime: 1 })
    .populate({
      path: 'bookingId',
      select: 'userId totalBeforeDiscount discountAmount finalAmount status payType promoId createdAt',
      populate: [
        {
          path: 'userId',
          select: 'fullName username phone email'
        },
        {
          path: 'promoId',
          select: 'name code discountPercentage discountAmount'
        }
      ]
    })
    .lean();

  // Get booking details for each booking
  const { default: BookingDetail } = await import('../models/Booking/bookingDetail.model.js');
  
  const bookingDetailsMap = {};
  const bookingIds = bookedSlots
    .filter(slot => slot.bookingId)
    .map(slot => slot.bookingId._id);

  if (bookingIds.length > 0) {
    const allBookingDetails = await BookingDetail.find({
      bookingId: { $in: bookingIds }
    })
    .populate('equipmentId', 'name description pricePerHour pricePerDay')
    .populate('extraServiceId', 'name description pricePerHour pricePerDay')
    .lean();

    // Group details by bookingId
    allBookingDetails.forEach(detail => {
      const bookingId = detail.bookingId.toString();
      if (!bookingDetailsMap[bookingId]) {
        bookingDetailsMap[bookingId] = [];
      }
      bookingDetailsMap[bookingId].push(detail);
    });
  }

  // Format the response
  const formattedSlots = bookedSlots.map(slot => {
    const bookingDetails = slot.bookingId 
      ? bookingDetailsMap[slot.bookingId._id.toString()] || []
      : [];

    return {
      _id: slot._id,
      studioId: slot.studioId,
      startTime: slot.startTime,
      endTime: slot.endTime,
      duration: Math.round((slot.endTime - slot.startTime) / (1000 * 60 * 60) * 10) / 10,
      date: slot.startTime.toISOString().split('T')[0],
      timeRange: `${slot.startTime.toTimeString().slice(0, 5)} - ${slot.endTime.toTimeString().slice(0, 5)}`,
      booking: slot.bookingId ? {
        _id: slot.bookingId._id,
        customer: {
          _id: slot.bookingId.userId._id,
          fullName: slot.bookingId.userId.fullName,
          username: slot.bookingId.userId.username,
          phone: slot.bookingId.userId.phone,
          email: slot.bookingId.userId.email
        },
        totalBeforeDiscount: slot.bookingId.totalBeforeDiscount,
        discountAmount: slot.bookingId.discountAmount,
        finalAmount: slot.bookingId.finalAmount,
        status: slot.bookingId.status,
        payType: slot.bookingId.payType,
        promotion: slot.bookingId.promoId ? {
          _id: slot.bookingId.promoId._id,
          name: slot.bookingId.promoId.name,
          code: slot.bookingId.promoId.code,
          discountPercentage: slot.bookingId.promoId.discountPercentage,
          discountAmount: slot.bookingId.promoId.discountAmount
        } : null,
        details: bookingDetails.map(detail => ({
          _id: detail._id,
          detailType: detail.detailType,
          description: detail.description,
          quantity: detail.quantity,
          pricePerUnit: detail.pricePerUnit,
          subtotal: detail.subtotal,
          equipment: detail.equipmentId ? {
            _id: detail.equipmentId._id,
            name: detail.equipmentId.name,
            description: detail.equipmentId.description,
            pricePerHour: detail.equipmentId.pricePerHour,
            pricePerDay: detail.equipmentId.pricePerDay
          } : null,
          service: detail.extraServiceId ? {
            _id: detail.extraServiceId._id,
            name: detail.extraServiceId.name,
            description: detail.extraServiceId.description,
            pricePerHour: detail.extraServiceId.pricePerHour,
            pricePerDay: detail.extraServiceId.pricePerDay
          } : null
        })),
        createdAt: slot.bookingId.createdAt
      } : null
    };
  });

  return {
    studio: {
      _id: studio._id,
      name: studio.name,
      location: studio.location,
      area: studio.area,
      capacity: studio.capacity,
      basePricePerHour: studio.basePricePerHour,
      status: studio.status
    },
    bookedHistory: formattedSlots,
    totalBookings: formattedSlots.length,
    dateRange: {
      startDate: startDate || null,
      endDate: endDate || null
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
      const [bookedCount, schedulesWithBookings] = await Promise.all([
        Schedule.countDocuments(query),
        Schedule.find(query)
          .populate('bookingId', 'finalAmount')
          .select('startTime endTime bookingId')
          .lean()
      ]);

      // Calculate revenue and duration
      let totalRevenue = 0;
      let totalDuration = 0;

      for (const schedule of schedulesWithBookings) {
        if (schedule.bookingId?.finalAmount) {
          totalRevenue += schedule.bookingId.finalAmount;
        }

        const durationMs = schedule.endTime - schedule.startTime;
        const durationHours = durationMs / (1000 * 60 * 60);
        totalDuration += durationHours;
      }

      const revenue = { totalRevenue, totalDuration };

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
