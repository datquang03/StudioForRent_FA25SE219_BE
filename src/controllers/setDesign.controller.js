//#region Imports
import asyncHandler from 'express-async-handler';
import fs from 'fs/promises';
import { uploadImage } from '../services/upload.service.js';
import {
  getSetDesigns,
  getSetDesignById,
  createSetDesign,
  updateSetDesign,
  deleteSetDesign,
  uploadDesignImage,
  getSetDesignsByCategory,
  getActiveSetDesigns,
  createCustomDesignRequest,
  getCustomDesignRequests,
  getCustomDesignRequestById,
  updateCustomDesignRequest,
  updateCustomDesignRequestStatus,
  deleteCustomDesignRequest,
  convertRequestToSetDesign,
  generateImageFromText,
  chatWithDesignAI,
  generateCompleteDesign,
  getCustomSetDesign,
  getConvertedCustomDesigns,
  getConvertedCustomDesignById,
  updateConvertedCustomDesign,
  deleteConvertedCustomDesign,
  getAllConvertedSetDesigns,
} from '../services/setDesign.service.js';
import { uploadMultipleImages } from '../services/upload.service.js';
// #endregion

// #region Set Design Controller - Product Catalog

/**
 * Get all set designs with pagination and filtering
 * GET /api/set-designs
 */
export const getSetDesignsController = asyncHandler(async (req, res) => {
  const options = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 10,
    category: req.query.category,
    search: req.query.search,
    sortBy: req.query.sortBy || 'createdAt',
    sortOrder: req.query.sortOrder || 'desc'
  };

  const result = await getSetDesigns(options);

  res.status(200).json({
    success: true,
    data: result.designs,
    pagination: result.pagination
  });
});

/**
 * Get all converted set designs (from custom requests)
 * GET /api/set-designs/converted
 */
export const getAllConvertedSetDesignsController = asyncHandler(async (req, res) => {
  const options = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 10,
    category: req.query.category,
    search: req.query.search,
    sortBy: req.query.sortBy || 'createdAt',
    sortOrder: req.query.sortOrder || 'desc'
  };

  const result = await getAllConvertedSetDesigns(options);

  res.status(200).json({
    success: true,
    data: result.designs,
    pagination: result.pagination
  });
});

/**
 * Get a single set design by ID
 * GET /api/set-designs/:id
 */
export const getSetDesignByIdController = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const design = await getSetDesignById(id);

  res.status(200).json({
    success: true,
    data: design
  });
});

/**
 * Create a new set design (Admin only)
 * POST /api/set-designs
 */
export const createSetDesignController = asyncHandler(async (req, res) => {
  const designData = req.body;
  const design = await createSetDesign(designData, req.user);
  res.status(201).json({
    success: true,
    message: 'Tạo thiết kế set thành công',
    data: design
  });
});

/**
 * Update a set design (Admin only)
 * PUT /api/set-designs/:id
 */
export const updateSetDesignController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const design = await updateSetDesign(id, updateData, req.user);
  res.status(200).json({
    success: true,
    message: 'Cập nhật thiết kế set thành công',
    data: design
  });
});

/**
 * Delete a set design (Admin only)
 * DELETE /api/set-designs/:id
 */
export const deleteSetDesignController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const design = await deleteSetDesign(id, req.user);
  res.status(200).json({
    success: true,
    message: 'Xóa thiết kế set thành công',
    data: design
  });
});

/**
 * Upload multiple images for a set design
 * POST /api/set-designs/upload-images
 */
export const uploadDesignImagesController = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    res.status(400);
    throw new Error('No images provided');
  }

  if (req.files.length > 10) {
    res.status(400);
    throw new Error('Cannot upload more than 10 images at once');
  }

  // Upload images using the same service as other uploads
  const folder = 'studio-rental/custom-designs';
  const results = await uploadMultipleImages(req.files, { folder });

  const imageUrls = results.map(img => img.url);

  res.status(200).json({
    success: true,
    message: `${results.length} image(s) uploaded successfully`,
    data: {
      imageUrls,
      count: imageUrls.length
    }
  });
});

/**
 * Get set designs by category
 * GET /api/set-designs/category/:category
 */
export const getSetDesignsByCategoryController = asyncHandler(async (req, res) => {
  const { category } = req.params;

  const designs = await getSetDesignsByCategory(category);

  res.status(200).json({
    success: true,
    data: designs
  });
});

/**
 * Get active set designs for homepage/catalog
 * GET /api/set-designs/active
 */
export const getActiveSetDesignsController = asyncHandler(async (req, res) => {
  const designs = await getActiveSetDesigns();

  res.status(200).json({
    success: true,
    data: designs
  });
});

// #endregion

// #region Custom Design Requests - AI Image Generation

/**
 * Create a custom design request with customer info and description
 * POST /api/set-designs/custom-request
 * Protected route (authentication required - Customer only)
 */
export const createCustomDesignRequestController = asyncHandler(async (req, res) => {

  const {
    description,
    preferredCategory,
    budget
  } = req.body;

  // Get customer info from authenticated user
  const customerId = req.user._id;
  const customerName = req.user.fullName || req.user.username;
  const email = req.user.email;
  const phoneNumber = req.user.phone;

  // Validate that user has required profile information
  if (!phoneNumber) {
    res.status(400);
    throw new Error('Vui lòng cập nhật số điện thoại trong hồ sơ trước khi gửi yêu cầu thiết kế');
  }

  // Validation
  if (!description) {
    res.status(400);
    throw new Error('Mô tả là bắt buộc');
  }

  // Validate description length
  if (description.length < 20) {
    res.status(400);
    throw new Error('Mô tả phải có ít nhất 20 ký tự');
  }

  // Validate budget if provided
  if (budget !== undefined && budget !== null && budget !== '') {
    const budgetNum = parseFloat(budget);
    if (isNaN(budgetNum) || budgetNum < 0) {
      res.status(400);
      throw new Error('Budget phải là số dương');
    }
  }

  // Handle uploaded reference images (multiple files)
  let referenceImages = [];
  if (req.files && req.files.length > 0) {
    // Validate number of files (max 5)
    if (req.files.length > 5) {
      res.status(400);
      throw new Error('Tối đa 5 ảnh tham khảo');
    }

    // Upload images to Cloudinary
    const uploadedImages = await Promise.all(
      req.files.map(async (file) => {
        try {
          const result = await uploadImage(file, {
            folder: 'set-design-references'
          });
          
          return {
            url: result.url,
            publicId: result.public_id,
            filename: file.originalname,
            format: result.format,
            width: result.width,
            height: result.height,
            uploadedAt: new Date()
          };
        } catch (uploadError) {
          throw new Error(`Lỗi khi tải ảnh ${file.originalname}: ${uploadError.message}`);
        }
      })
    );
    
    referenceImages = uploadedImages;
  }

  const requestData = {
    customerName,
    email,
    phoneNumber,
    description,
    referenceImages,
    preferredCategory,
    budget: budget ? parseFloat(budget) : undefined,
    customerId
  };

  const request = await createCustomDesignRequest(requestData);

  res.status(201).json({
    success: true,
    message: 'Gửi yêu cầu thiết kế tùy chỉnh thành công. Chúng tôi sẽ liên hệ với bạn sớm!',
    data: request
  });
});

/**
 * Get custom design requests
 * GET /api/set-designs/custom-request
 * Staff/Admin: Get all requests with optional filters
 * Customer: Get only their own requests
 */
export const getCustomSetDesignController = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const status = req.query.status;
  const search = req.query.search;

  const isStaffOrAdmin = req.user?.role === 'staff' || req.user?.role === 'admin';
  const emailFromUser = req.user?.email;

  const filters = {
    page,
    limit,
    status,
    search
  };

  // If customer, filter by their email only
  if (!isStaffOrAdmin) {
    if (!emailFromUser) {
      res.status(400);
      throw new Error('Email người dùng không tồn tại');
    }
    filters.email = emailFromUser;
  } else {
    // Staff/Admin can optionally filter by email
    if (req.query.email) {
      filters.email = req.query.email.trim();
    }
  }

  const result = await getCustomSetDesign(filters);

  res.status(200).json({
    success: true,
    data: result.requests,
    pagination: result.pagination
  });
});

/**
 * Get all custom design requests (Staff/Admin only)
 * GET /api/set-designs/custom-requests
 */
export const getCustomDesignRequestsController = asyncHandler(async (req, res) => {
  const query = req.query;
  const options = {
    page: parseInt(query.page) || 1,
    limit: parseInt(query.limit) || 10,
    status: query.status,
    search: query.search
  };

  const result = await getCustomDesignRequests(options);

  res.status(200).json({
    success: true,
    data: result.requests,
    pagination: result.pagination
  });
});

/**
 * Get a single custom design request by ID
 * Customer: Can only view their own requests
 * Staff/Admin: Can view any request
 * GET /api/set-designs/custom-requests/:id
 */
export const getCustomDesignRequestByIdController = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const request = await getCustomDesignRequestById(id, req.user);

  res.status(200).json({
    success: true,
    data: request
  });
});

/**
 * Update a custom design request
 * Customer: Can only update their own pending requests (limited fields)
 * Staff/Admin: Can update any request (all fields)
 * PUT /api/set-designs/custom-requests/:id
 */
export const updateCustomDesignRequestController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  // Handle uploaded reference images if staff is replacing them
  if (req.files && req.files.length > 0) {
    // Validate number of files (max 5)
    if (req.files.length > 5) {
      res.status(400);
      throw new Error('Tối đa 5 ảnh tham khảo');
    }

    // Upload new images to Cloudinary
    const uploadedImages = await Promise.all(
      req.files.map(async (file) => {
        try {
          const result = await uploadImage(file, {
            folder: 'set-design-references'
          });
          
          return {
            url: result.url,
            publicId: result.public_id,
            filename: file.originalname,
            format: result.format,
            width: result.width,
            height: result.height,
            uploadedAt: new Date()
          };
        } catch (uploadError) {
          throw new Error(`Lỗi khi tải ảnh ${file.originalname}: ${uploadError.message}`);
        }
      })
    );
    
    // Add new images to updateData
    updateData.newReferenceImages = uploadedImages;
  }

  const request = await updateCustomDesignRequest(id, updateData, req.user);

  res.status(200).json({
    success: true,
    message: 'Cập nhật yêu cầu thiết kế thành công',
    data: request
  });
});

/**
 * Update custom design request status (Staff/Admin only)
 * PATCH /api/set-designs/custom-requests/:id/status
 */
export const updateCustomDesignRequestStatusController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, staffNotes, estimatedPrice } = req.body;
  const staffId = req.user._id;

  if (!status) {
    res.status(400);
    throw new Error('Trạng thái là bắt buộc');
  }

  const validStatuses = ['pending', 'processing', 'completed', 'rejected'];
  if (!validStatuses.includes(status)) {
    res.status(400);
    throw new Error('Trạng thái không hợp lệ. Phải là một trong: pending, processing, completed, rejected');
  }

  const updateData = { staffNotes, estimatedPrice };
  const request = await updateCustomDesignRequestStatus(id, status, staffId, updateData);

  res.status(200).json({
    success: true,
    message: 'Cập nhật trạng thái yêu cầu thành công',
    data: request
  });
});

/**
 * Delete a custom design request
 * DELETE /api/set-designs/custom-requests/:id
 * Customer: Can only delete their own requests
 * Staff/Admin: Can delete any request
 */
export const deleteCustomDesignRequestController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const userRole = req.user.role;

  const request = await deleteCustomDesignRequest(id, userId, userRole);

  res.status(200).json({
    success: true,
    message: 'Xóa yêu cầu thiết kế thành công',
    data: request
  });
});

/**
 * Convert approved custom request to SetDesign product (Admin only)
 * POST /api/set-designs/custom-requests/:id/convert
 */
export const convertRequestToSetDesignController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const designData = req.body;
  const setDesign = await convertRequestToSetDesign(id, designData, req.user);
  res.status(201).json({
    success: true,
    message: 'Chuyển đổi yêu cầu thành thiết kế set thành công',
    data: setDesign
  });
});

/**
 * Get converted custom designs (SetDesigns created from custom requests)
 * GET /api/set-designs/converted-custom-designs
 * Customer: Get only their own converted designs
 * Staff/Admin: Get all converted designs or filter by email
 */
export const getConvertedCustomDesignsController = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search;

  const filters = {
    page,
    limit,
    search
  };

  const result = await getConvertedCustomDesigns(filters);

  res.status(200).json({
    success: true,
    data: result.designs,
    pagination: result.pagination
  });
});

/**
 * Get a converted custom design by ID
 * Customer: Can only view their own converted designs
 * Staff/Admin: Can view any converted design
 * GET /api/set-designs/converted-custom-designs/:id
 */
export const getConvertedCustomDesignByIdController = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await getConvertedCustomDesignById(id);

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * Update a converted custom design
 * Staff/Admin only
 * PUT /api/set-designs/converted-custom-designs/:id
 */
export const updateConvertedCustomDesignController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const design = await updateConvertedCustomDesign(id, updateData, req.user);

  res.status(200).json({
    success: true,
    message: 'Cập nhật set design thành công',
    data: design
  });
});

/**
 * Delete a converted custom design (soft delete)
 * Staff/Admin only
 * DELETE /api/set-designs/converted-custom-designs/:id
 */
export const deleteConvertedCustomDesignController = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const design = await deleteConvertedCustomDesign(id, req.user);

  res.status(200).json({
    success: true,
    message: 'Xóa set design thành công',
    data: design
  });
});

/**
 * Generate AI image from text description using Gemini Imagen 3
 * POST /api/set-designs/generate-from-text
 * Public route with rate limiting
 * RESTRICTED: Only for studio set design images
 */
export const generateImageFromTextController = asyncHandler(async (req, res) => {
  const { 
    description, 
    provider,
    model, 
    aspectRatio, 
    imageSize,
    numberOfImages,
    negativePrompt,
    useGoogleSearch 
  } = req.body;

  if (!description) {
    res.status(400);
    throw new Error('Mô tả là bắt buộc');
  }

  if (description.length < 10) {
    res.status(400);
    throw new Error('Mô tả phải có ít nhất 10 ký tự');
  }

  if (description.length > 500) {
    res.status(400);
    throw new Error('Mô tả không được vượt quá 500 ký tự');
  }

  // Validate that description is related to studio/photography set design
  const studioKeywords = [
    'studio', 'set design', 'photography', 'backdrop', 'lighting', 'phòng chụp',
    'chụp ảnh', 'phông nền', 'ánh sáng', 'trang trí', 'props', 'đạo cụ',
    'shooting', 'photoshoot', 'set chụp', 'không gian chụp', 'background'
  ];

  const descriptionLower = description.toLowerCase();
  const hasStudioKeyword = studioKeywords.some(keyword => 
    descriptionLower.includes(keyword.toLowerCase())
  );

  if (!hasStudioKeyword) {
    res.status(400);
    throw new Error(
      'Description must be related to studio or photography set design. ' +
      'Please include keywords like: studio, photography, set design, backdrop, lighting, etc. ' +
      'Vietnamese: phòng chụp, chụp ảnh, set design, phông nền, ánh sáng, trang trí, đạo cụ'
    );
  }

  // Validate provider
  const selectedProvider = provider || 'getty';
  const validProviders = ['getty', 'gemini'];
  if (!validProviders.includes(selectedProvider)) {
    res.status(400);
    throw new Error(`Invalid provider. Must be one of: ${validProviders.join(', ')}`);
  }

  const options = {
    provider: selectedProvider,
    model: model || 'gemini-2.5-flash-image',
    aspectRatio: aspectRatio || '16:9',
    imageSize: imageSize || '1K',
    numberOfImages: numberOfImages || 1,
    negativePrompt: negativePrompt || '',
    useGoogleSearch: useGoogleSearch || false,
  };

  // Validate Getty-specific parameters
  if (selectedProvider === 'getty') {
    // Validate numberOfImages
    if (options.numberOfImages < 1 || options.numberOfImages > 4) {
      res.status(400);
      throw new Error('Số lượng hình ảnh phải từ 1 đến 4 cho Getty Images');
    }

    // Validate aspect ratio for Getty
    const gettyAspectRatios = ['1:1', '3:2', '4:3', '16:9', '9:16'];
    if (!gettyAspectRatios.includes(options.aspectRatio)) {
      res.status(400);
      throw new Error(`Invalid aspect ratio for Getty Images. Must be one of: ${gettyAspectRatios.join(', ')}`);
    }
  }

  // Validate Gemini-specific parameters
  if (selectedProvider === 'gemini') {
    // Validate model
    const validModels = ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'];
    if (options.model && !validModels.includes(options.model)) {
      res.status(400);
      throw new Error(`Invalid model. Must be one of: ${validModels.join(', ')}`);
    }

    // Validate aspect ratio for Gemini
    const geminiAspectRatios = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
    if (options.aspectRatio && !geminiAspectRatios.includes(options.aspectRatio)) {
      res.status(400);
      throw new Error(`Invalid aspect ratio for Gemini. Must be one of: ${geminiAspectRatios.join(', ')}`);
    }

    // Validate image size
    const validSizes = ['1K', '2K', '4K'];
    if (options.imageSize && !validSizes.includes(options.imageSize)) {
      res.status(400);
      throw new Error(`Invalid image size. Must be one of: ${validSizes.join(', ')}`);
    }
  }

  const result = await generateImageFromText(description, options);

  // Determine message based on mode and provider
  let message = 'Processing completed successfully';
  if (result.mode === 'full-generation') {
    if (result.provider === 'getty') {
      message = 'Image generated successfully with Getty Images AI (Commercial License)';
    } else if (result.provider === 'gemini') {
      message = 'Image generated successfully with Gemini Imagen 3';
    }
  } else if (result.mode === 'prompt-only') {
    message = result.quotaInfo ? 
      'Enhanced prompt generated (quota limit reached - use prompt with external service)' :
      'Enhanced prompt generated successfully';
  }

  res.status(200).json({
    success: true,
    message: message,
    data: result
  });
});

/**
 * Chat with AI about design ideas
 * POST /api/set-designs/ai-chat
 * Public route with rate limiting
 */
export const chatWithDesignAIController = asyncHandler(async (req, res) => {
  const { message, conversationHistory } = req.body;

  if (!message) {
    res.status(400);
    throw new Error('Tin nhắn là bắt buộc');
  }

  if (message.length < 5) {
    res.status(400);
    throw new Error('Tin nhắn phải có ít nhất 5 ký tự');
  }

  if (message.length > 500) {
    res.status(400);
    throw new Error('Tin nhắn không được vượt quá 500 ký tự');
  }

  const history = Array.isArray(conversationHistory) ? conversationHistory : [];

  const result = await chatWithDesignAI(message, history);

  res.status(200).json({
    success: true,
    message: 'Tạo phản hồi AI thành công',
    data: result
  });
});

/**
 * Generate complete design from conversation (Summary + Image)
 * POST /api/set-designs/ai-generate-design
 * Public route with rate limiting
 */
export const generateCompleteDesignController = asyncHandler(async (req, res) => {
  const { conversationHistory, imageOptions } = req.body;

  if (!conversationHistory || !Array.isArray(conversationHistory)) {
    res.status(400);
    throw new Error('Lịch sử hội thoại là bắt buộc và phải là mảng');
  }

  if (conversationHistory.length < 2) {
    res.status(400);
    throw new Error('Ít nhất 2 tin nhắn trong lịch sử hội thoại là bắt buộc');
  }

  const options = imageOptions || {};

  // Validate image options if provided
  if (options.size && !['1024x1024', '1024x1792', '1792x1024'].includes(options.size)) {
    res.status(400);
    throw new Error('Kích thước không hợp lệ. Phải là một trong: 1024x1024, 1024x1792, 1792x1024');
  }

  if (options.quality && !['standard', 'hd'].includes(options.quality)) {
    res.status(400);
    throw new Error('Chất lượng không hợp lệ. Phải là standard hoặc hd');
  }

  if (options.style && !['vivid', 'natural'].includes(options.style)) {
    res.status(400);
    throw new Error('Kiểu dáng không hợp lệ. Phải là vivid hoặc natural');
  }

  const result = await generateCompleteDesign(conversationHistory, options);

  res.status(200).json({
    success: true,
    message: 'Tạo thiết kế hoàn chỉnh thành công',
    data: result
  });
});

// #endregion