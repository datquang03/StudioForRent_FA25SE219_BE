// #region Imports
import asyncHandler from 'express-async-handler';
import {
  getSetDesigns,
  getSetDesignById,
  createSetDesign,
  updateSetDesign,
  deleteSetDesign,
  addReview,
  addComment,
  replyToComment,
  uploadDesignImage,
  getSetDesignsByCategory,
  getActiveSetDesigns,
  createCustomDesignRequest,
  getCustomDesignRequests,
  getCustomDesignRequestById,
  updateCustomDesignRequestStatus,
  convertRequestToSetDesign,
  generateImageFromText,
  chatWithDesignAI,
  generateDesignSummaryFromChat,
  generateCompleteDesign
} from '../services/setDesign.service.js';
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

  const design = await createSetDesign(designData);

  res.status(201).json({
    success: true,
    message: 'Set design created successfully',
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

  const design = await updateSetDesign(id, updateData);

  res.status(200).json({
    success: true,
    message: 'Set design updated successfully',
    data: design
  });
});

/**
 * Delete a set design (Admin only)
 * DELETE /api/set-designs/:id
 */
export const deleteSetDesignController = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const design = await deleteSetDesign(id);

  res.status(200).json({
    success: true,
    message: 'Set design deleted successfully',
    data: design
  });
});

/**
 * Add a review to a set design
 * POST /api/set-designs/:id/reviews
 */
export const addReviewController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating, comment } = req.body;
  const customerId = req.user._id;
  const customerName = req.user.name;

  const design = await addReview(id, customerId, customerName, rating, comment);

  res.status(201).json({
    success: true,
    message: 'Review added successfully',
    data: design
  });
});

/**
 * Add a comment to a set design
 * POST /api/set-designs/:id/comments
 */
export const addCommentController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;
  const customerId = req.user._id;
  const customerName = req.user.name;

  const design = await addComment(id, customerId, customerName, message);

  res.status(201).json({
    success: true,
    message: 'Comment added successfully',
    data: design
  });
});

/**
 * Reply to a comment on a set design (Staff only)
 * POST /api/set-designs/:id/comments/:commentIndex/reply
 */
export const replyToCommentController = asyncHandler(async (req, res) => {
  const { id, commentIndex } = req.params;
  const { message } = req.body;
  const staffId = req.user._id;
  const staffName = req.user.name;

  const design = await replyToComment(id, parseInt(commentIndex), staffId, staffName, message);

  res.status(201).json({
    success: true,
    message: 'Reply added successfully',
    data: design
  });
});

/**
 * Upload an image for a set design
 * POST /api/set-designs/upload-image
 */
export const uploadDesignImageController = asyncHandler(async (req, res) => {
  const { base64Image, fileName } = req.body;

  if (!base64Image) {
    res.status(400);
    throw new Error('Base64 image is required');
  }

  const imageUrl = await uploadDesignImage(base64Image, fileName);

  res.status(200).json({
    success: true,
    message: 'Image uploaded successfully',
    data: { imageUrl }
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
 * Public route (no authentication required)
 */
export const createCustomDesignRequestController = asyncHandler(async (req, res) => {
  const {
    customerName,
    email,
    phoneNumber,
    description,
    referenceImages,
    preferredCategory,
    budgetRange
  } = req.body;

  // Validation
  if (!customerName || !email || !phoneNumber || !description) {
    res.status(400);
    throw new Error('Customer name, email, phone number, and description are required');
  }

  // Validate email format
  const emailRegex = /^\S+@\S+\.\S+$/;
  if (!emailRegex.test(email)) {
    res.status(400);
    throw new Error('Please provide a valid email address');
  }

  // Validate phone number format
  const phoneRegex = /^[0-9]{10,11}$/;
  if (!phoneRegex.test(phoneNumber)) {
    res.status(400);
    throw new Error('Please provide a valid phone number (10-11 digits)');
  }

  // Validate description length
  if (description.length < 20) {
    res.status(400);
    throw new Error('Description must be at least 20 characters');
  }

  const requestData = {
    customerName,
    email,
    phoneNumber,
    description,
    referenceImages: referenceImages || [],
    preferredCategory,
    budgetRange
  };

  const request = await createCustomDesignRequest(requestData);

  res.status(201).json({
    success: true,
    message: 'Custom design request submitted successfully. We will contact you soon!',
    data: request
  });
});

/**
 * Get all custom design requests (Staff/Admin only)
 * GET /api/set-designs/custom-requests
 */
export const getCustomDesignRequestsController = asyncHandler(async (req, res) => {
  const options = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 10,
    status: req.query.status,
    search: req.query.search
  };

  const result = await getCustomDesignRequests(options);

  res.status(200).json({
    success: true,
    data: result.requests,
    pagination: result.pagination
  });
});

/**
 * Get a single custom design request by ID (Staff/Admin only)
 * GET /api/set-designs/custom-requests/:id
 */
export const getCustomDesignRequestByIdController = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const request = await getCustomDesignRequestById(id);

  res.status(200).json({
    success: true,
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
    throw new Error('Status is required');
  }

  const validStatuses = ['pending', 'processing', 'completed', 'rejected'];
  if (!validStatuses.includes(status)) {
    res.status(400);
    throw new Error('Invalid status. Must be one of: pending, processing, completed, rejected');
  }

  const updateData = { staffNotes, estimatedPrice };
  const request = await updateCustomDesignRequestStatus(id, status, staffId, updateData);

  res.status(200).json({
    success: true,
    message: 'Request status updated successfully',
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

  const setDesign = await convertRequestToSetDesign(id, designData);

  res.status(201).json({
    success: true,
    message: 'Custom request converted to set design successfully',
    data: setDesign
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
    throw new Error('Description is required');
  }

  if (description.length < 10) {
    res.status(400);
    throw new Error('Description must be at least 10 characters');
  }

  if (description.length > 500) {
    res.status(400);
    throw new Error('Description cannot exceed 500 characters');
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
      throw new Error('Number of images must be between 1 and 4 for Getty Images');
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
    throw new Error('Message is required');
  }

  if (message.length < 5) {
    res.status(400);
    throw new Error('Message must be at least 5 characters');
  }

  if (message.length > 500) {
    res.status(400);
    throw new Error('Message cannot exceed 500 characters');
  }

  const history = Array.isArray(conversationHistory) ? conversationHistory : [];

  const result = await chatWithDesignAI(message, history);

  res.status(200).json({
    success: true,
    message: 'AI response generated successfully',
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
    throw new Error('Conversation history is required and must be an array');
  }

  if (conversationHistory.length < 2) {
    res.status(400);
    throw new Error('At least 2 messages in conversation history are required');
  }

  const options = imageOptions || {};

  // Validate image options if provided
  if (options.size && !['1024x1024', '1024x1792', '1792x1024'].includes(options.size)) {
    res.status(400);
    throw new Error('Invalid size. Must be one of: 1024x1024, 1024x1792, 1792x1024');
  }

  if (options.quality && !['standard', 'hd'].includes(options.quality)) {
    res.status(400);
    throw new Error('Invalid quality. Must be either standard or hd');
  }

  if (options.style && !['vivid', 'natural'].includes(options.style)) {
    res.status(400);
    throw new Error('Invalid style. Must be either vivid or natural');
  }

  const result = await generateCompleteDesign(conversationHistory, options);

  res.status(200).json({
    success: true,
    message: 'Complete design generated successfully',
    data: result
  });
});

// #endregion