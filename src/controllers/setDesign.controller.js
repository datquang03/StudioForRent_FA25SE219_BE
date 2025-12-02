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
  updateComment,
  deleteComment,
  updateReply,
  deleteReply,
  likeComment,
  unlikeComment,
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
    message: 'Thêm đánh giá thành công',
    data: design
  });
});

/**
 * Add a comment to a set design (Customer only)
 * POST /api/set-designs/:id/comments
 */
export const addCommentController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;
  const customerId = req.user._id;
  const customerName = req.user.fullName || req.user.username;

  if (!message) {
    res.status(400);
    throw new Error('Nội dung bình luận là bắt buộc');
  }

  const design = await addComment(id, customerId, customerName, message);

  res.status(201).json({
    success: true,
    message: 'Thêm bình luận thành công',
    data: design
  });
});

/**
 * Reply to a comment on a set design (Staff and Customer)
 * POST /api/set-designs/:id/comments/:commentIndex/reply
 */
export const replyToCommentController = asyncHandler(async (req, res) => {
  const { id, commentIndex } = req.params;
  const { message } = req.body;
  const userId = req.user._id;
  const userName = req.user.fullName || req.user.username;
  const userRole = req.user.role;

  if (!message) {
    res.status(400);
    throw new Error('Nội dung phản hồi là bắt buộc');
  }

  const parsedIndex = parseInt(commentIndex);
  if (isNaN(parsedIndex)) {
    res.status(400);
    throw new Error('Chỉ số bình luận không hợp lệ');
  }

  const design = await replyToComment(id, parsedIndex, userId, userName, userRole, message);

  res.status(201).json({
    success: true,
    message: 'Thêm phản hồi thành công',
    data: design
  });
});

/**
 * Update a comment on a set design (Customer - own comments only)
 * PATCH /api/set-designs/:id/comments/:commentIndex
 */
export const updateCommentController = asyncHandler(async (req, res) => {
  const { id, commentIndex } = req.params;
  const { message } = req.body;
  const customerId = req.user._id;

  if (!message) {
    res.status(400);
    throw new Error('Nội dung bình luận mới là bắt buộc');
  }

  const parsedIndex = parseInt(commentIndex);
  if (isNaN(parsedIndex)) {
    res.status(400);
    throw new Error('Chỉ số bình luận không hợp lệ');
  }

  const design = await updateComment(id, parsedIndex, customerId, message);

  res.status(200).json({
    success: true,
    message: 'Cập nhật bình luận thành công',
    data: design
  });
});

/**
 * Delete a comment on a set design (Customer - own comments, Staff/Admin - any comments)
 * DELETE /api/set-designs/:id/comments/:commentIndex
 */
export const deleteCommentController = asyncHandler(async (req, res) => {
  const { id, commentIndex } = req.params;
  const userId = req.user._id;
  const userRole = req.user.role;

  const parsedIndex = parseInt(commentIndex);
  if (isNaN(parsedIndex)) {
    res.status(400);
    throw new Error('Chỉ số bình luận không hợp lệ');
  }

  const design = await deleteComment(id, parsedIndex, userId, userRole);

  res.status(200).json({
    success: true,
    message: 'Xóa bình luận thành công',
    data: design
  });
});

/**
 * Update a reply on a comment (User - own replies only)
 * PATCH /api/set-designs/:id/comments/:commentIndex/replies/:replyIndex
 */
export const updateReplyController = asyncHandler(async (req, res) => {
  const { id, commentIndex, replyIndex } = req.params;
  const { message } = req.body;
  const userId = req.user._id;

  if (!message) {
    res.status(400);
    throw new Error('Nội dung phản hồi mới là bắt buộc');
  }

  const parsedCommentIndex = parseInt(commentIndex);
  const parsedReplyIndex = parseInt(replyIndex);
  
  if (isNaN(parsedCommentIndex) || isNaN(parsedReplyIndex)) {
    res.status(400);
    throw new Error('Chỉ số không hợp lệ');
  }

  const design = await updateReply(id, parsedCommentIndex, parsedReplyIndex, userId, message);

  res.status(200).json({
    success: true,
    message: 'Cập nhật phản hồi thành công',
    data: design
  });
});

/**
 * Delete a reply on a comment (User - own replies, Staff/Admin - any replies)
 * DELETE /api/set-designs/:id/comments/:commentIndex/replies/:replyIndex
 */
export const deleteReplyController = asyncHandler(async (req, res) => {
  const { id, commentIndex, replyIndex } = req.params;
  const userId = req.user._id;
  const userRole = req.user.role;

  const parsedCommentIndex = parseInt(commentIndex);
  const parsedReplyIndex = parseInt(replyIndex);
  
  if (isNaN(parsedCommentIndex) || isNaN(parsedReplyIndex)) {
    res.status(400);
    throw new Error('Chỉ số không hợp lệ');
  }

  const design = await deleteReply(id, parsedCommentIndex, parsedReplyIndex, userId, userRole);

  res.status(200).json({
    success: true,
    message: 'Xóa phản hồi thành công',
    data: design
  });
});

/**
 * Like a comment
 * POST /api/comments/:commentId/like
 */
export const likeCommentController = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user._id;

  if (!commentId || commentId.trim() === '') {
    res.status(400);
    throw new Error('ID bình luận là bắt buộc');
  }

  const result = await likeComment(commentId, userId);

  res.status(200).json({
    success: true,
    message: 'Đã thích bình luận thành công',
    data: result
  });
});

/**
 * Unlike a comment
 * DELETE /api/comments/:commentId/like
 */
export const unlikeCommentController = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user._id;

  if (!commentId || commentId.trim() === '') {
    res.status(400);
    throw new Error('ID bình luận là bắt buộc');
  }

  const result = await unlikeComment(commentId, userId);

  res.status(200).json({
    success: true,
    message: 'Đã bỏ thích bình luận thành công',
    data: result
  });
});

/**
 * Upload multiple images for a set design
 * POST /api/set-designs/upload-images
 */
export const uploadDesignImagesController = asyncHandler(async (req, res) => {
  const { images } = req.body; // Array of { base64Image, fileName }

  if (!images || !Array.isArray(images) || images.length === 0) {
    res.status(400);
    throw new Error('Mảng hình ảnh là bắt buộc và không được để trống');
  }

  if (images.length > 10) {
    res.status(400);
    throw new Error('Không thể tải lên nhiều hơn 10 hình ảnh cùng một lúc');
  }

  // Validate each image
  const validatedImages = [];
  let totalSize = 0;

  for (let i = 0; i < images.length; i++) {
    const { base64Image, fileName } = images[i];

    if (!base64Image) {
      res.status(400);
      throw new Error(`Image ${i + 1}: Base64 image is required`);
    }

    // Validate base64 format
    if (!base64Image.startsWith('data:image/')) {
      res.status(400);
      throw new Error(`Image ${i + 1}: Invalid image format. Must be a valid base64 image`);
    }

    // Extract mime type and data
    const [mimePart, dataPart] = base64Image.split(',');
    const mimeType = mimePart.split(':')[1].split(';')[0];

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(mimeType)) {
      res.status(400);
      throw new Error(`Image ${i + 1}: File type ${mimeType} not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }

    // Calculate file size
    const fileSizeBytes = (dataPart.length * 3) / 4;
    const maxSizeBytes = 5 * 1024 * 1024; // 5MB per image

    if (fileSizeBytes > maxSizeBytes) {
      const maxSizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(1);
      const actualSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(1);
      res.status(400);
      throw new Error(`Image ${i + 1}: File size ${actualSizeMB}MB exceeds ${maxSizeMB}MB limit`);
    }

    totalSize += fileSizeBytes;
    validatedImages.push({ base64Image, fileName: fileName || `design-${i + 1}` });
  }

  // Check total size (max 25MB for batch upload)
  const maxTotalSize = 25 * 1024 * 1024; // 25MB
  if (totalSize > maxTotalSize) {
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(1);
    res.status(400);
    throw new Error(`Total upload size ${totalSizeMB}MB exceeds 25MB limit`);
  }

  // Upload all images in parallel
  const uploadPromises = validatedImages.map(({ base64Image, fileName }) =>
    uploadDesignImage(base64Image, fileName)
  );

  const imageUrls = await Promise.all(uploadPromises);

  res.status(200).json({
    success: true,
    message: `${images.length} image(s) uploaded successfully`,
    data: {
      imageUrls,
      count: imageUrls.length,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(1)
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
    throw new Error('Tên khách hàng, email, số điện thoại và mô tả là bắt buộc');
  }

  // Validate email format
  const emailRegex = /^\S+@\S+\.\S+$/;
  if (!emailRegex.test(email)) {
    res.status(400);
    throw new Error('Vui lòng cung cấp địa chỉ email hợp lệ');
  }

  // Validate phone number format
  const phoneRegex = /^[0-9]{10,11}$/;
  if (!phoneRegex.test(phoneNumber)) {
    res.status(400);
    throw new Error('Vui lòng cung cấp số điện thoại hợp lệ (10-11 chữ số)');
  }

  // Validate description length
  if (description.length < 20) {
    res.status(400);
    throw new Error('Mô tả phải có ít nhất 20 ký tự');
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
    message: 'Gửi yêu cầu thiết kế tùy chỉnh thành công. Chúng tôi sẽ liên hệ với bạn sớm!',
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