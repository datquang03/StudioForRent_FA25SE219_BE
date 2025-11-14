import Service from '../models/Service/service.model.js';
import BookingDetail from '../models/Booking/bookingDetail.model.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { SERVICE_STATUS } from '../utils/constants.js';
import { escapeRegex } from '../utils/helpers.js';

/**
 * Get all services (for staff/admin)
 */
export const getAllServices = async ({ page = 1, limit = 10, search = '', status = '' }) => {
  // Validate and sanitize pagination
  const safePage = Math.max(parseInt(page) || 1, 1);
  const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
  
  // Validate and sanitize search (prevent ReDoS)
  const safeSearch = search && search.length > 100 ? search.substring(0, 100) : search;
  
  const skip = (safePage - 1) * safeLimit;
  const query = {};

  // Filter by search (name or description)
  if (safeSearch) {
    const escapedSearch = escapeRegex(safeSearch);
    query.$or = [
      { name: { $regex: escapedSearch, $options: 'i' } },
      { description: { $regex: escapedSearch, $options: 'i' } },
    ];
  }

  // Filter by status
  if (status && Object.values(SERVICE_STATUS).includes(status)) {
    query.status = status;
  }

  const [services, total] = await Promise.all([
    Service.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    Service.countDocuments(query),
  ]);

  return {
    services,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
};

/**
 * Get available services (public - for customers)
 */
export const getAvailableServices = async () => {
  const services = await Service.find({
    status: SERVICE_STATUS.ACTIVE,
    isAvailable: true,
  })
    .sort({ name: 1 })
    .select('name description pricePerUse')
    .lean();

  return services;
};

/**
 * Get available service detail (public - for customers)
 */
export const getAvailableServiceDetail = async (serviceId) => {
  const service = await Service.findOne({
    _id: serviceId,
    status: SERVICE_STATUS.ACTIVE,
    isAvailable: true,
  })
    .select('name description pricePerUse')
    .lean();

  if (!service) {
    throw new NotFoundError('Dịch vụ không khả dụng hoặc không tồn tại!');
  }

  return service;
};

/**
 * Get service by ID
 */
export const getServiceById = async (serviceId) => {
  const service = await Service.findById(serviceId);
  
  if (!service) {
    throw new NotFoundError('Dịch vụ không tồn tại!');
  }

  return service;
};

/**
 * Create new service
 */
export const createService = async ({ name, description, pricePerUse }) => {
  // Validation already handled by validateServiceCreation middleware
  
  try {
    // Create service - MongoDB unique index will prevent duplicates
    const service = await Service.create({
      name: name.trim(),
      description: description?.trim() || '',
      pricePerUse,
      status: SERVICE_STATUS.ACTIVE,
      isAvailable: true,
    });

    return service;
  } catch (error) {
    // Handle MongoDB duplicate key error (E11000)
    if (error.code === 11000) {
      throw new ValidationError('Tên dịch vụ đã tồn tại!');
    }
    throw error;
  }
};

/**
 * Update service
 */
export const updateService = async (serviceId, { name, description, pricePerUse, status }) => {
  const service = await Service.findById(serviceId);
  
  if (!service) {
    throw new NotFoundError('Dịch vụ không tồn tại!');
  }

  // Validation already handled by validateServiceUpdate middleware

  try {
    // Update fields
    if (name) service.name = name.trim();
    if (description !== undefined) service.description = description?.trim() || '';
    if (pricePerUse !== undefined) service.pricePerUse = pricePerUse;
    if (status) service.status = status;

    // Pre-save hook will sync isAvailable with status
    await service.save();

    return service;
  } catch (error) {
    // Handle MongoDB duplicate key error (E11000)
    if (error.code === 11000) {
      throw new ValidationError('Tên dịch vụ đã tồn tại!');
    }
    throw error;
  }
};

/**
 * Delete service
 */
export const deleteService = async (serviceId) => {
  const service = await Service.findById(serviceId);
  
  if (!service) {
    throw new NotFoundError('Dịch vụ không tồn tại!');
  }

  // Check if service is being used in any bookings
  const bookingCount = await BookingDetail.countDocuments({
    service: serviceId,
  });

  if (bookingCount > 0) {
    throw new ValidationError(
      `Không thể xóa dịch vụ đang được sử dụng trong ${bookingCount} booking!`
    );
  }

  await Service.findByIdAndDelete(serviceId);

  return { message: 'Xóa dịch vụ thành công!' };
};
