// #region Imports
import asyncHandler from 'express-async-handler';
import {
  getAllServices,
  getAvailableServices,
  getAvailableServiceDetail,
  getServiceById,
  createService,
  updateService,
  deleteService,
} from '../services/service.service.js';
// #endregion

// #region Get Services

/**
 * @desc    Get all services (staff/admin)
 * @route   GET /api/services
 * @access  Private (Staff, Admin)
 */
export const getServiceList = asyncHandler(async (req, res) => {
  const { page, limit, search, status } = req.query;

  const result = await getAllServices({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
    search: search || '',
    status: status || '',
  });

  res.status(200).json({
    success: true,
    data: result.services,
    pagination: result.pagination,
  });
});

/**
 * @desc    Get available services (public)
 * @route   GET /api/services/available
 * @access  Public
 */
export const getAvailableServiceList = asyncHandler(async (req, res) => {
  const services = await getAvailableServices();

  res.status(200).json({
    success: true,
    data: services,
  });
});

/**
 * @desc    Get service by ID
 * @route   GET /api/services/:id
 * @access  Private (Staff, Admin)
 */
export const getServiceDetail = asyncHandler(async (req, res) => {
  const service = await getServiceById(req.params.id);

  res.status(200).json({
    success: true,
    data: service,
  });
});

// #endregion

// #region Available Service Details (Public)
/**
 * @desc    Get available service detail
 * @route   GET /api/services/available/:id
 * @access  Public
 */
export const getAvailableServiceDetailController = asyncHandler(async (req, res) => {
  const service = await getAvailableServiceDetail(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Lấy thông tin dịch vụ thành công!',
    data: service,
  });
});

// #endregion

// #region Create Service

/**
 * @desc    Create new service
 * @route   POST /api/services
 * @access  Private (Staff, Admin)
 */
export const createServiceController = asyncHandler(async (req, res) => {
  const { name, description, pricePerUse } = req.body;

  // Validation already handled by validateServiceCreation middleware
  const service = await createService({
    name,
    description,
    pricePerUse,
  });

  res.status(201).json({
    success: true,
    message: 'Tạo dịch vụ thành công!',
    data: service,
  });
});

// #endregion

// #region Update Service

/**
 * @desc    Update service
 * @route   PATCH /api/services/:id
 * @access  Private (Staff, Admin)
 */
export const updateServiceController = asyncHandler(async (req, res) => {
  const { name, description, pricePerUse, status } = req.body;

  const service = await updateService(req.params.id, {
    name,
    description,
    pricePerUse,
    status,
  });

  res.status(200).json({
    success: true,
    message: 'Cập nhật dịch vụ thành công!',
    data: service,
  });
});

// #endregion

// #region Delete Service

/**
 * @desc    Delete service
 * @route   DELETE /api/services/:id
 * @access  Private (Staff, Admin)
 */
export const deleteServiceController = asyncHandler(async (req, res) => {
  const result = await deleteService(req.params.id);

  res.status(200).json({
    success: true,
    message: result.message,
  });
});

// #endregion
