// #region Imports
import { GoogleGenerativeAI } from '@google/generative-ai';
import mongoose from 'mongoose';
import SetDesign from '../models/SetDesign/setDesign.model.js';
import SetDesignOrder from '../models/SetDesignOrder/setDesignOrder.model.js';
import CustomDesignRequest from '../models/CustomDesignRequest/customDesignRequest.model.js';
import logger from '../utils/logger.js';
import cloudinary from '../config/cloudinary.js';
import axios from 'axios';
import { generateImageWithGetty } from './gettyImages.service.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { SET_DESIGN_CATEGORIES } from '../utils/constants.js';
// #endregion

// #region Helper Functions

/**
 * Validate ObjectId format and presence
 * @param {string} id - The ID to validate
 * @param {string} fieldName - Name of the field for error messages
 * @throws {ValidationError} If ID is invalid or missing
 */
const validateObjectId = (id, fieldName) => {
  if (!id) {
    throw new ValidationError(`${fieldName} là bắt buộc`);
  }
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError(`${fieldName} không hợp lệ`);
  }
};

// #endregion

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
const textModel = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
  generationConfig: {
    temperature: 0.9,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 2048,
  },
});

// Gemini Imagen 3 is already initialized through genAI above

// #region Set Design Service - Product Catalog

/**
 * Get all active set designs with pagination and filtering
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 10)
 * @param {string} options.category - Filter by category
 * @param {string} options.search - Search in name and description
 * @param {string} options.sortBy - Sort field (default: createdAt)
 * @param {string} options.sortOrder - Sort order (default: desc)
 * @returns {Object} Paginated set designs
 */
export const getSetDesigns = async (options = {}) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    // Only get regular set designs (NOT converted from custom requests)
    const query = { 
      isActive: true,
      $or: [
        // Regular designs explicitly marked as not converted
        { isConvertedFromCustomRequest: false },
        // Legacy designs where the field is not set
        { isConvertedFromCustomRequest: { $exists: false } }
      ]
    };

    // Add category filter
    if (category && category !== 'all') {
      query.category = category;
    }

    // Add search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const [designs, total] = await Promise.all([
      SetDesign.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit),
      SetDesign.countDocuments(query)
    ]);

    return {
      designs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting set designs:', error);
    throw new Error('Failed to retrieve set designs');
  }
};

/**
 * Get a single set design by ID
 * @param {string} id - Set design ID
 * @param {Object} options - Options for retrieval
 * @param {boolean} options.publicOnly - If true, only return active designs
 * @returns {Object} Set design
 */
export const getSetDesignById = async (id, options = {}) => {
  try {
    validateObjectId(id, 'ID set design');

    const design = await SetDesign.findById(id);

    if (!design) {
      throw new NotFoundError('Set design không tồn tại');
    }

    // If publicOnly is true, check if design is active
    if (options.publicOnly && !design.isActive) {
      throw new NotFoundError('Set design không tồn tại hoặc đã bị ẩn');
    }

    return design;
  } catch (error) {
    logger.error('Error getting set design by ID:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi lấy thông tin set design');
  }
};

/**
 * Get a converted custom design (SetDesign created from custom request) by ID
 * Customer: Can only view their own converted designs
 * Staff/Admin: Can view any converted design
 * @param {string} id - SetDesign ID
 * @param {Object} user - Current user
 * @returns {Object} SetDesign with original request info and payment status
 */
export const getConvertedCustomDesignById = async (id) => {
  try {
    validateObjectId(id, 'ID set design');

    const [design, request, orders] = await Promise.all([
      SetDesign.findById(id),
      CustomDesignRequest.findOne({ convertedToDesignId: id })
        .populate('processedBy', 'name email')
        .populate('customerId', 'fullName email avatar'),
      SetDesignOrder.find({ setDesignId: id })
        .populate('customerId', 'fullName email')
        .sort({ createdAt: -1 })
        .lean()
    ]);

    if (!design) {
      throw new NotFoundError('Set design không tồn tại');
    }

    if (!request) {
      throw new NotFoundError('Đây không phải là set design được chuyển đổi từ custom request');
    }

    // Build payment summary from orders
    const paymentSummary = {
      totalOrders: orders.length,
      orders: orders.map(order => ({
        orderId: order._id,
        orderCode: order.orderCode,
        customerId: order.customerId,
        quantity: order.quantity,
        totalAmount: order.totalAmount,
        paidAmount: order.paidAmount,
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt
      }))
    };

    return {
      setDesign: design,
      originalRequest: {
        requestId: request._id,
        customerName: request.customerName,
        email: request.email,
        phoneNumber: request.phoneNumber,
        customerAvatar: request.customerId?.avatar || null,
        originalDescription: request.description,
        requestedAt: request.createdAt,
        convertedAt: request.updatedAt,
        processedBy: request.processedBy,
        estimatedPrice: request.estimatedPrice
      },
      paymentInfo: paymentSummary
    };
  } catch (error) {
    logger.error('Error getting converted custom design:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi lấy thông tin set design');
  }
};

/**
 * Update a converted custom design (SetDesign created from custom request)
 * Customer: Cannot update (read-only)
 * Staff/Admin: Can update any field
 * @param {string} id - SetDesign ID
 * @param {Object} updateData - Update data
 * @param {Object} user - Current user
 * @returns {Object} Updated SetDesign
 */
export const updateConvertedCustomDesign = async (id, updateData, user) => {
  try {
    validateObjectId(id, 'ID set design');

    // Only staff can update set designs
    if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
      throw new ValidationError('Chỉ staff/admin mới có thể cập nhật set design');
    }

    const [design, request] = await Promise.all([
      SetDesign.findById(id),
      CustomDesignRequest.findOne({ convertedToDesignId: id })
    ]);

    if (!design) {
      throw new NotFoundError('Set design không tồn tại');
    }
    if (!request) {
      throw new NotFoundError('Đây không phải là set design được chuyển đổi từ custom request');
    }

    // Validate price if provided
    if (updateData.price !== undefined && (isNaN(updateData.price) || updateData.price < 0)) {
      throw new ValidationError('Giá phải là số không âm');
    }

    // Validate category if provided
    if (updateData.category && !SET_DESIGN_CATEGORIES.includes(updateData.category)) {
      throw new ValidationError(`Danh mục không hợp lệ. Chọn từ: ${SET_DESIGN_CATEGORIES.join(', ')}`);
    }

    const updatedDesign = await SetDesign.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    logger.info(`Converted custom design updated: ${id} by user: ${user._id}`);
    return updatedDesign;
  } catch (error) {
    logger.error('Error updating converted custom design:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi cập nhật set design');
  }
};

/**
 * Delete a converted custom design (SetDesign created from custom request)
 * Customer: Cannot delete
 * Staff/Admin: Can delete (soft delete by setting isActive to false)
 * @param {string} id - SetDesign ID
 * @param {Object} user - Current user
 * @returns {Object} Deleted SetDesign
 */
export const deleteConvertedCustomDesign = async (id, user) => {
  try {
    validateObjectId(id, 'ID set design');

    // Only staff can delete set designs
    if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
      throw new ValidationError('Chỉ staff/admin mới có thể xóa set design');
    }

    const [design, request] = await Promise.all([
      SetDesign.findById(id),
      CustomDesignRequest.findOne({ convertedToDesignId: id })
    ]);

    if (!design) {
      throw new NotFoundError('Set design không tồn tại');
    }
    if (!request) {
      throw new NotFoundError('Đây không phải là set design được chuyển đổi từ custom request');
    }

    // Soft delete
    design.isActive = false;
    design.updatedAt = new Date();
    await design.save();

    // Optionally update the request status
    // request.status = 'rejected'; // Removed: Deleting the product doesn't mean the request was rejected
    request.staffNotes = (request.staffNotes || '') + '\n[Set design đã bị xóa]';
    await request.save();

    logger.info(`Converted custom design deleted: ${id} by user: ${user._id}`);
    return design;
  } catch (error) {
    logger.error('Error deleting converted custom design:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi xóa set design');
  }
};

/**
 * Create a new set design (Admin only)
 * @param {Object} designData - Set design data
 * @returns {Object} Created set design
 */
export const createSetDesign = async (designData, user) => {
  try {
    // Only staff can create set designs
    if (!user || user.role !== 'staff') {
      throw new ValidationError('Chỉ staff mới có thể tạo set design');
    }

    // Validate required fields
    if (!designData.name || !designData.description) {
      throw new ValidationError('Tên và mô tả là bắt buộc');
    }

    // Validate price
    if (designData.price !== undefined && (isNaN(designData.price) || designData.price < 0)) {
      throw new ValidationError('Giá phải là số không âm');
    }

    // Validate category
    if (designData.category && !SET_DESIGN_CATEGORIES.includes(designData.category)) {
      throw new ValidationError(`Danh mục không hợp lệ. Chọn từ: ${SET_DESIGN_CATEGORIES.join(', ')}`);
    }

    // Create set design with all model fields
    const design = new SetDesign({
      name: designData.name,
      description: designData.description,
      price: designData.price || 0,
      images: designData.images || [],
      isActive: designData.isActive !== undefined ? designData.isActive : true,
      category: designData.category || 'other',
      tags: designData.tags || [],
      isConvertedFromCustomRequest: false,
      sourceRequestId: null,
      createdBy: user._id,
    });
    await design.save();
    logger.info(`New set design created: ${design.name} by user: ${user._id}`);
    return design;
  } catch (error) {
    logger.error('Error creating set design:', error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new Error('Lỗi khi tạo set design');
  }
};

/**
 * Update a set design (Admin only)
 * @param {string} id - Set design ID
 * @param {Object} updateData - Update data
 * @returns {Object} Updated set design
 */
export const updateSetDesign = async (id, updateData, user) => {
  try {
    // Only staff can update set designs
    if (!user || user.role !== 'staff') {
      throw new ValidationError('Chỉ staff mới có thể cập nhật set design');
    }

    validateObjectId(id, 'ID set design');

    // Validate price if provided
    if (updateData.price !== undefined && (isNaN(updateData.price) || updateData.price < 0)) {
      throw new ValidationError('Giá phải là số không âm');
    }

    // Validate category if provided
    if (updateData.category && !SET_DESIGN_CATEGORIES.includes(updateData.category)) {
      throw new ValidationError(`Danh mục không hợp lệ. Chọn từ: ${SET_DESIGN_CATEGORIES.join(', ')}`);
    }

    const design = await SetDesign.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!design) {
      throw new NotFoundError('Set design không tồn tại');
    }
    
    logger.info(`Set design updated: ${design.name} by user: ${user._id}`);
    return design;
  } catch (error) {
    logger.error('Error updating set design:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi cập nhật set design');
  }
};

/**
 * Delete a set design (Admin only) - Soft delete by setting isActive to false
 * @param {string} id - Set design ID
 * @returns {Object} Deleted set design
 */
export const deleteSetDesign = async (id, user) => {
  try {
    // Only staff can delete set designs
    if (!user || user.role !== 'staff') {
      throw new ValidationError('Chỉ staff mới có thể xóa set design');
    }

    validateObjectId(id, 'ID set design');

    const design = await SetDesign.findByIdAndUpdate(
      id,
      { isActive: false, updatedAt: new Date() },
      { new: true }
    );
    
    if (!design) {
      throw new NotFoundError('Set design không tồn tại');
    }
    
    logger.info(`Set design deactivated: ${design.name} by user: ${user._id}`);
    return design;
  } catch (error) {
    logger.error('Error deleting set design:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi xóa set design');
  }
};

/**
 * Add a review to a set design
 * @param {string} designId - Set design ID
 * @param {string} customerId - Customer ID
 * @param {string} customerName - Customer name
 * @param {number} rating - Rating (1-5)
 * @param {string} comment - Review comment
 * @returns {Object} Updated set design
 */
/**
 * Upload an image to Cloudinary for a set design
 * @param {string} base64Image - Base64 encoded image
 * @param {string} fileName - File name for the image
 * @returns {string} Cloudinary URL of the uploaded image
 */
export const uploadDesignImage = async (base64Image, fileName = 'design') => {
  try {
    if (!base64Image || base64Image.trim().length === 0) {
      throw new ValidationError('Ảnh base64 là bắt buộc');
    }

    // Validate base64 format
    if (!base64Image.includes('base64')) {
      throw new ValidationError('Định dạng ảnh base64 không hợp lệ');
    }

    // Remove data URL prefix if present
    const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(`data:image/png;base64,${base64Data}`, {
      folder: 'set-designs',
      public_id: `${fileName}-${Date.now()}`,
      resource_type: 'image',
      transformation: [
        { width: 1200, height: 800, crop: 'limit' },
        { quality: 'auto' }
      ]
    });

    logger.info(`Image uploaded to Cloudinary: ${result.secure_url}`);
    return result.secure_url;
  } catch (error) {
    logger.error('Error uploading image to Cloudinary:', error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new Error('Lỗi khi tải lên ảnh');
  }
};

/**
 * Get set designs by category
 * @param {string} category - Category to filter by
 * @returns {Array} Array of set designs in the category
 */
export const getSetDesignsByCategory = async (category) => {
  try {
    return await SetDesign.getByCategory(category);
  } catch (error) {
    logger.error('Error getting set designs by category:', error);
    throw new Error('Failed to retrieve set designs by category');
  }
};

/**
 * Get active set designs (for homepage/catalog)
 * @returns {Array} Array of active set designs
 */
export const getActiveSetDesigns = async () => {
  try {
    return await SetDesign.getActiveDesigns();
  } catch (error) {
    logger.error('Error getting active set designs:', error);
    throw new Error('Failed to retrieve active set designs');
  }
};

// #endregion

// #region AI Design Consultation & Image Generation

/**
 * Chat with AI about design ideas and get suggestions
 * @param {string} userMessage - User's question or request about design
 * @param {Array} conversationHistory - Previous conversation messages
 * @returns {Object} AI response with design suggestions
 */
export const chatWithDesignAI = async (userMessage, conversationHistory = []) => {
  try {
    logger.info('Processing design consultation chat');

    const systemPrompt = `You are an expert studio photography set designer and creative consultant. Your role is to:

1. Help customers brainstorm creative ideas for their photoshoot set designs
2. Suggest specific props, backdrops, lighting setups, and color schemes
3. Provide professional advice on composition and atmosphere
4. Ask clarifying questions to understand their vision better
5. Recommend styles that match their needs (wedding, portrait, corporate, etc.)

Always be:
- Creative and inspiring
- Practical and feasible
- Professional and helpful
- Detailed with specific suggestions

Focus on studio photography set designs WITHOUT people in the frame.`;

    // Build conversation context
    let conversationText = `${systemPrompt}\n\n`;
    
    if (conversationHistory.length > 0) {
      conversationText += 'Previous conversation:\n';
      conversationHistory.forEach((msg) => {
        conversationText += `${msg.role === 'user' ? 'Customer' : 'Designer'}: ${msg.content}\n`;
      });
      conversationText += '\n';
    }

    conversationText += `Customer: ${userMessage}\n\nPlease provide helpful design suggestions:`;

    const result = await textModel.generateContent([conversationText]);
    const response = await result.response;
    const aiMessage = response.text();

    logger.info('Design consultation response generated');

    return {
      success: true,
      userMessage,
      aiResponse: aiMessage,
      timestamp: new Date().toISOString(),
      conversationLength: conversationHistory.length + 1
    };
  } catch (error) {
    logger.error('Error in design consultation chat:', error);
    throw new Error('Failed to process design consultation');
  }
};

/**
 * Generate design summary and image prompt from conversation
 * @param {Array} conversationHistory - Full conversation history
 * @returns {Object} Design summary and optimized prompt
 */
export const generateDesignSummaryFromChat = async (conversationHistory) => {
  try {
    logger.info('Generating design summary from conversation');

    const conversationText = conversationHistory
      .map(msg => `${msg.role === 'user' ? 'Customer' : 'Designer'}: ${msg.content}`)
      .join('\n');

    const summaryPrompt = `Based on the following conversation about a studio photography set design, create a comprehensive summary and an optimized prompt for AI image generation.

Conversation:
${conversationText}

Provide your response in this exact JSON format:
{
  "designSummary": "A brief summary of the agreed design concept",
  "keyElements": ["element1", "element2", "element3"],
  "style": "overall style (e.g., vintage, modern, minimalist)",
  "colorScheme": "main colors",
  "mood": "desired atmosphere",
  "imagePrompt": "A detailed, optimized prompt for DALL-E 3 image generation focusing on the studio set design"
}`;

    const result = await textModel.generateContent([summaryPrompt]);
    const response = await result.response;
    let summaryText = response.text();

    // Extract JSON from response
    const jsonMatch = summaryText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      summaryText = jsonMatch[0];
    }

    const designSummary = JSON.parse(summaryText);

    logger.info('Design summary generated successfully');

    return {
      success: true,
      ...designSummary,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error generating design summary:', error);
    throw new Error('Failed to generate design summary');
  }
};

/**
 * Generate actual image using DALL-E 3 from OpenAI
 * @deprecated DALL-E integration has been removed. Use generateImageWithGetty or Gemini instead.
 * @param {string} prompt - Image generation prompt
 * @param {Object} options - Generation options
 * @returns {Object} Generated image data
 */
export const generateImageWithDALLE = async (prompt, options = {}) => {
  // DALL-E/OpenAI integration has been removed
  // Use generateImageWithGetty or Gemini Imagen instead
  throw new Error('DALL-E integration has been deprecated. Please use generateImageWithGetty or Gemini Imagen instead.');
};

/**
 * Download image from URL and upload to Cloudinary
 * @param {string} imageUrl - Source image URL
 * @param {string} fileName - File name prefix
 * @returns {string} Cloudinary URL
 */
const downloadAndUploadToCloudinary = async (imageUrl, fileName) => {
  try {
    // Download image as buffer
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer'
    });

    const imageBuffer = Buffer.from(response.data, 'binary');
    const base64Image = imageBuffer.toString('base64');

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(
      `data:image/png;base64,${base64Image}`,
      {
        folder: 'ai-generated-designs',
        public_id: `${fileName}-${Date.now()}`,
        resource_type: 'image',
        transformation: [
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ]
      }
    );

    logger.info(`Image uploaded to Cloudinary: ${result.secure_url}`);
    return result.secure_url;
  } catch (error) {
    logger.error('Error uploading to Cloudinary:', error);
    throw new Error('Failed to upload image to Cloudinary');
  }
};

/**
 * Complete workflow: Chat → Design Summary → Generate Image
 * @param {Array} conversationHistory - Full conversation
 * @param {Object} imageOptions - Image generation options
 * @returns {Object} Complete result with summary and image
 */
export const generateCompleteDesign = async (conversationHistory, imageOptions = {}) => {
  try {
    logger.info('Starting complete design generation workflow');

    // Step 1: Generate design summary from conversation
    const summary = await generateDesignSummaryFromChat(conversationHistory);

    // Step 2: Generate image using the optimized prompt
    const imageResult = await generateImageWithDALLE(summary.imagePrompt, imageOptions);

    // Combine results
    return {
      success: true,
      designSummary: {
        description: summary.designSummary,
        keyElements: summary.keyElements,
        style: summary.style,
        colorScheme: summary.colorScheme,
        mood: summary.mood
      },
      image: {
        url: imageResult.imageUrl,
        revisedPrompt: imageResult.revisedPrompt,
        metadata: imageResult.metadata
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error in complete design generation:', error);
    throw new Error('Failed to generate complete design');
  }
};

// #endregion

// #region Custom Design Requests - AI Image Generation

/**
 * Generate enhanced prompt for image generation from text description
 * RESTRICTED: Only for studio photography set design
 * @param {string} description - Text description of the desired set design
 * @returns {string} Enhanced prompt for image generation
 */
export const generateEnhancedPrompt = async (description) => {
  try {
    logger.info('Generating enhanced image prompt for studio set design using Gemini AI');

    const promptEnhancementRequest = `You are an expert in creating detailed prompts for AI image generation tools specialized in STUDIO PHOTOGRAPHY SET DESIGN.

User's description: "${description}"

Create a highly detailed, professional prompt SPECIFICALLY for generating a PHOTOGRAPHY STUDIO SET DESIGN image. The prompt MUST:

IMPORTANT REQUIREMENTS:
- This is for a PHOTOGRAPHY STUDIO SET DESIGN only (not portraits, products, or other subjects)
- Focus on the PHYSICAL SPACE and SETUP of a photography studio
- Include studio equipment, lighting setups, backdrops, and props

The prompt should:
1. Specify the type of photography studio (portrait, product, fashion, newborn, wedding, etc.)
2. Detail the backdrop/background (color, material, texture)
3. Describe lighting equipment and setup (softboxes, reflectors, natural light, etc.)
4. List props and decorative elements relevant to the studio type
5. Mention studio layout and spatial arrangement
6. Include technical photography terms
7. Specify colors, materials, and textures
8. Describe the overall mood and aesthetic
9. Be optimized for photorealistic results
10. NO PEOPLE in the image - empty studio set only

STUDIO CONTEXT: This is for a studio rental service, so the image should show an attractive, professional photography set that customers would want to rent.

Return ONLY the enhanced prompt text, nothing else. Make it detailed but concise (max 250 words).`;

    const result = await textModel.generateContent([promptEnhancementRequest]);
    const response = await result.response;
    const enhancedPrompt = response.text();

    logger.info('Enhanced studio set design prompt generated successfully');
    return enhancedPrompt.trim();
  } catch (error) {
    logger.error('Error generating enhanced prompt, using fallback:', error.message);
    
    // FALLBACK: Rule-based prompt enhancement (no API needed)
    const enhancedPrompt = generateFallbackPrompt(description);
    logger.info('Using fallback prompt enhancement (no AI)');
    return enhancedPrompt;
  }
};

/**
 * Generate enhanced prompt without AI (fallback for quota issues)
 * @param {string} description - Original description
 * @returns {string} Enhanced prompt
 */
const generateFallbackPrompt = (description) => {
  const desc = description.toLowerCase();
  
  // Detect studio type
  let studioType = 'photography';
  if (desc.includes('portrait') || desc.includes('chân dung')) studioType = 'portrait photography';
  else if (desc.includes('product') || desc.includes('sản phẩm')) studioType = 'product photography';
  else if (desc.includes('wedding') || desc.includes('cưới')) studioType = 'wedding photography';
  else if (desc.includes('newborn') || desc.includes('em bé')) studioType = 'newborn photography';
  else if (desc.includes('fashion')) studioType = 'fashion photography';
  
  // Detect style
  let style = 'modern';
  if (desc.includes('vintage') || desc.includes('cổ điển')) style = 'vintage';
  else if (desc.includes('minimalist') || desc.includes('tối giản')) style = 'minimalist';
  else if (desc.includes('luxury') || desc.includes('sang trọng')) style = 'luxury';
  
  // Detect colors
  let colors = 'neutral tones';
  if (desc.includes('white') || desc.includes('trắng')) colors = 'white';
  if (desc.includes('pastel')) colors = 'pastel colors';
  if (desc.includes('dark') || desc.includes('tối')) colors = 'dark tones';
  
  // Build enhanced prompt
  return `Professional ${studioType} studio set design: ${description}. 
  
Empty studio space featuring:
- ${style} aesthetic with ${colors}
- Professional lighting equipment (softboxes, reflectors, key lights)
- High-quality backdrop or seamless paper background
- Carefully arranged props and decorative elements
- Clean, well-organized studio layout
- Modern professional photography equipment visible
- Photorealistic quality, 8K resolution
- Architectural photography perspective
- No people in the scene - empty studio ready for photoshoot
- Inviting atmosphere perfect for a studio rental service`.trim();
};

/**
 * Generate AI image from text description using Gemini Imagen 3
 * NOTE: Gemini Imagen has strict free tier limits. This function will:
 * 1. Try to generate with Gemini Imagen (if quota available)
 * 2. Fallback to enhanced prompt only (if quota exceeded)
 * 
 * @param {string} description - Text description of the desired set design
 * @param {Object} options - Generation options
 * @returns {Object} Image generation result with URL or enhanced prompt
 */
export const generateImageFromText = async (description, options = {}) => {
  try {
    logger.info('Processing text-to-image request');

    const {
      provider = 'getty', // Changed default to Getty Images
      model = 'gemini-2.5-flash-image',
      aspectRatio = '16:9',
      imageSize = '1K',
      numberOfImages = 1,
      negativePrompt = '',
      responseModalities = ['IMAGE'],
      useGoogleSearch = false,
      enableActualGeneration = true,
    } = options;

    // Getty Images Generation (Primary Provider)
    if (provider === 'getty') {
      logger.info('Using Getty Images AI Generation');

      try {
        const gettyOptions = {
          aspectRatio,
          numberOfImages,
          negativePrompt: negativePrompt || 'blurry, low quality, distorted, unprofessional'
        };

        const result = await generateImageWithGetty(description, gettyOptions);

        if (!result.success) {
          throw new Error(result.error || 'Getty Images generation failed');
        }

        logger.info('Getty Images generation successful');

        return {
          success: true,
          mode: 'full-generation',
          provider: 'getty',
          url: result.url,
          originalDescription: description,
          enhancedPrompt: description,
          metadata: {
            ...result.metadata,
            aspectRatio,
            numberOfImages,
            timestamp: new Date().toISOString()
          }
        };

      } catch (gettyError) {
        logger.error('Getty Images generation failed:', gettyError);

        // Fallback to Gemini if Getty fails
        if (options.allowFallback !== false) {
          logger.info('Falling back to Gemini Imagen');
          return generateImageFromText(description, { 
            ...options, 
            provider: 'gemini',
            allowFallback: false // Prevent infinite fallback loop
          });
        }

        throw gettyError;
      }
    }

    // Gemini Imagen Generation (Fallback Provider)
    if (provider === 'gemini') {
      logger.info('Using Gemini Imagen');

      // Generate enhanced prompt using Gemini text model
      const enhancedPrompt = await generateEnhancedPrompt(description);

      // If actual image generation is disabled or not available, return enhanced prompt only
      if (!enableActualGeneration) {
        logger.info('Returning enhanced prompt only (actual generation disabled)');
        
        return {
          success: true,
          mode: 'prompt-only',
          provider: 'gemini',
          originalDescription: description,
          enhancedPrompt: enhancedPrompt,
          metadata: {
            aspectRatio: aspectRatio,
            imageSize: imageSize,
            timestamp: new Date().toISOString()
          },
          instructions: {
            message: 'Enhanced prompt generated successfully. Use with external image generation service.',
            recommendedServices: [
              'Getty Images AI (Primary - Commercial License)',
              'Gemini Imagen (requires paid API key)',
              'DALL-E 3 (OpenAI)',
              'Midjourney',
              'Stable Diffusion XL'
            ],
            prompt: enhancedPrompt,
            note: 'To enable automatic image generation, upgrade to paid Gemini API or use Getty Images.'
          }
        };
      }

      // Try to generate with Gemini Imagen
      try {
        logger.info('Attempting to generate image with Gemini Imagen');

        const imageModel = genAI.getGenerativeModel({
          model: model,
        });

        const generationConfig = {
          responseModalities: responseModalities,
        };

        if (aspectRatio || imageSize) {
          generationConfig.imageConfig = {};
          if (aspectRatio) generationConfig.imageConfig.aspectRatio = aspectRatio;
          if (imageSize && model === 'gemini-3-pro-image-preview') {
            generationConfig.imageConfig.imageSize = imageSize;
          }
        }

        if (useGoogleSearch && model === 'gemini-3-pro-image-preview') {
          generationConfig.tools = [{ google_search: {} }];
        }

        const result = await imageModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: enhancedPrompt }] }],
          generationConfig: generationConfig,
        });

        const response = result.response;

        // Extract image data
        let imageData = null;
        let imageText = null;

        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
            imageData = part.inlineData;
          }
          if (part.text) {
            imageText = part.text;
          }
        }

        if (!imageData) {
          throw new Error('No image generated in response');
        }

        // Upload to Cloudinary
        const base64Image = `data:${imageData.mimeType};base64,${imageData.data}`;
        const cloudinaryResult = await cloudinary.uploader.upload(base64Image, {
          folder: 'ai-generated-designs',
          resource_type: 'image',
        });

        logger.info('Image generated and uploaded successfully');

        return {
          success: true,
          mode: 'full-generation',
          provider: 'gemini',
          url: cloudinaryResult.secure_url,
          publicId: cloudinaryResult.public_id,
          description: imageText || enhancedPrompt,
          originalDescription: description,
          enhancedPrompt: enhancedPrompt,
          metadata: {
            model: model,
            aspectRatio: aspectRatio,
            imageSize: imageSize,
            mimeType: imageData.mimeType,
            width: cloudinaryResult.width,
            height: cloudinaryResult.height,
            format: cloudinaryResult.format,
            bytes: cloudinaryResult.bytes,
            timestamp: new Date().toISOString()
          }
        };

      } catch (imageGenError) {
        // Check if it's a quota error
        if (imageGenError.message && imageGenError.message.includes('quota')) {
          logger.warn('Gemini Imagen quota exceeded, falling back to prompt-only mode');
          
          return {
            success: true,
            mode: 'prompt-only',
            provider: 'gemini',
            originalDescription: description,
            enhancedPrompt: enhancedPrompt,
            metadata: {
              aspectRatio: aspectRatio,
              imageSize: imageSize,
              timestamp: new Date().toISOString()
            },
            quotaInfo: {
              exceeded: true,
              message: 'Gemini Imagen free tier quota exceeded',
              recommendation: 'Use Getty Images or upgrade to paid API key'
            },
            instructions: {
              message: 'Enhanced prompt generated. Actual image generation unavailable due to quota limits.',
              recommendedServices: [
                'Getty Images AI (Recommended - Commercial License)',
                'DALL-E 3 (OpenAI) - Best quality',
                'Midjourney - Artistic styles',
                'Stable Diffusion XL - Open source'
              ],
              prompt: enhancedPrompt
            }
          };
        }
        
        // Other errors, throw
        throw imageGenError;
      }
    }

    // Invalid provider
    throw new Error(`Invalid provider: ${provider}. Supported providers: getty, gemini`);

  } catch (error) {
    logger.error('Error in text-to-image processing:', error);
    throw new Error(`Failed to process text-to-image request: ${error.message}`);
  }
};

/**
 * Get custom design requests with filters
 * @param {Object} filters - Filter options
 * @param {string} [filters.email] - Customer email (required for customers, optional for staff)
 * @param {string} [filters.status] - Request status
 * @param {string} [filters.search] - Search by name, email, or description
 * @param {number} [filters.page] - Page number
 * @param {number} [filters.limit] - Page size
 */
export const getCustomSetDesign = async (filters = {}) => {
  try {
    const {
      email,
      status,
      search,
      page = 1,
      limit = 10
    } = filters;

    const safePage = Math.max(1, parseInt(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, parseInt(limit) || 10));
    const skip = (safePage - 1) * safeLimit;

    const query = {};

    // Filter by email if provided (for customers or staff filtering specific email)
    if (email) {
      const normalizedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        throw new ValidationError('Email không hợp lệ');
      }
      query.email = normalizedEmail;
    }

    // Filter by status
    if (status) {
      const validStatuses = ['pending', 'processing', 'completed', 'rejected'];
      if (!validStatuses.includes(status)) {
        throw new ValidationError(`Trạng thái không hợp lệ. Chọn từ: ${validStatuses.join(', ')}`);
      }
      query.status = status;
    }

    // Search filter - search in customerName, email (if not filtered), description
    if (search && search.trim().length > 0) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      const searchConditions = [
        { customerName: searchRegex },
        { description: searchRegex }
      ];
      
      // Only search in email field if not already filtering by specific email
      if (!email) {
        searchConditions.push({ email: searchRegex });
      }

      query.$or = searchConditions;
    }

    const [requests, total] = await Promise.all([
      CustomDesignRequest.find(query)
        .populate('processedBy', 'name email')
        .populate('convertedToDesignId', 'name price')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      CustomDesignRequest.countDocuments(query)
    ]);

    return {
      requests,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit)
      }
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    logger.error('Error getting custom design requests:', error);
    throw new Error('Lỗi khi lấy yêu cầu thiết kế tùy chỉnh');
  }
};

/**
 * Create a custom design request with AI-generated image
 * @param {Object} requestData - Customer request data (extracted from authenticated user)
 * @returns {Object} Created custom design request
 */
export const createCustomDesignRequest = async (requestData) => {
  try {
    const {
      customerName,
      email,
      phoneNumber,
      description,
      budget,
      referenceImages = [],
      preferredCategory,
      customerId // Extract customerId
    } = requestData;

    // Validate required fields (these are now provided from authenticated user session)
    if (!customerName || !email || !phoneNumber || !description) {
      throw new ValidationError('Thông tin yêu cầu không đầy đủ. Vui lòng cung cấp đầy đủ tên, email, số điện thoại và mô tả yêu cầu.');
    }

    // Note: Email and phone validation are handled at controller level and user profile level

    // Validate budget if provided
    if (budget !== undefined && budget !== null) {
      if (budget < 0) {
        throw new ValidationError('Ngân sách không thể âm');
      }
    }

    // Validate category if provided
    if (preferredCategory && !SET_DESIGN_CATEGORIES.includes(preferredCategory)) {
      throw new ValidationError(`Danh mục không hợp lệ. Chọn từ: ${SET_DESIGN_CATEGORIES.join(', ')}`);
    }

    // Validate reference images array
    if (referenceImages && !Array.isArray(referenceImages)) {
      throw new ValidationError('Hình ảnh tham khảo phải là một mảng');
    }

    // Validate max 5 reference images
    if (referenceImages && referenceImages.length > 5) {
      throw new ValidationError('Tối đa 5 ảnh tham khảo');
    }

    // Validate each reference image object structure
    if (referenceImages && referenceImages.length > 0) {
      for (const img of referenceImages) {
        if (!img.url) {
          throw new ValidationError('Mỗi ảnh tham khảo phải có URL');
        }
      }
    }

    logger.info(`Creating custom design request for ${email}`);

    // Create the request with pending status
    const customRequest = new CustomDesignRequest({
      customerName,
      email,
      phoneNumber,
      description,
      budget,
      referenceImages, // Array of file objects
      preferredCategory,
      customerId, // Save customerId
      status: 'pending',
      aiGenerationAttempts: 0
    });

    await customRequest.save();

    logger.info(`Custom design request created: ${customRequest._id}`);

    return customRequest;
  } catch (error) {
    logger.error('Error creating custom design request:', error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new Error('Lỗi khi tạo yêu cầu thiết kế tùy chỉnh');
  }
};

/**
 * Generate AI image and attach to existing request (async background task)
 * @param {string} requestId - Custom design request ID
 * @param {string} description - Design description
 */
const generateAndAttachAIImage = async (requestId, description) => {
  try {
    const request = await CustomDesignRequest.findById(requestId);
    if (!request) return;

    // Update status to processing
    request.status = 'processing';
    request.aiGenerationAttempts += 1;
    await request.save();

    // Generate image using Gemini Imagen
    const imageResult = await generateImageFromText(description, {
      model: 'gemini-2.5-flash-image',
      aspectRatio: '16:9',
    });
    
    // Update request with generated image as file object
    const generatedImageObj = {
      url: imageResult.url,
      publicId: imageResult.publicId || null,
      filename: imageResult.filename || `ai-generated-${Date.now()}.png`,
      format: imageResult.format || 'png',
      width: imageResult.width || null,
      height: imageResult.height || null,
      uploadedAt: new Date()
    };

    request.generatedImages = [generatedImageObj];
    request.status = 'pending'; // Back to pending for staff review
    request.aiMetadata = {
      prompt: imageResult.enhancedPrompt,
      model: imageResult.metadata?.model || 'gemini-2.5-flash-image',
      generatedAt: imageResult.metadata?.timestamp || new Date(),
    };
    await request.save();

    logger.info(`AI image generated successfully for request ${requestId}`);

  } catch (error) {
    logger.error(`Error in generateAndAttachAIImage for ${requestId}:`, error);
    // Update request to show generation failed
    const request = await CustomDesignRequest.findById(requestId);
    if (request) {
      request.status = 'pending'; // Keep as pending for manual processing
      await request.save();
    }
  }
};

/**
 * Get all custom design requests with pagination
 * @param {Object} options - Query options
 * @returns {Object} Paginated custom design requests
 */
export const getCustomDesignRequests = async (options = {}) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search
    } = options;

    const query = {};

    // Add status filter
    if (status) {
      query.status = status;
    }

    // Add search filter
    if (search) {
      query.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      CustomDesignRequest.find(query)
        .populate('processedBy', 'name email')
        .populate('convertedToDesignId', 'name price')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CustomDesignRequest.countDocuments(query)
    ]);

    return {
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting custom design requests:', error);
    throw new Error('Failed to retrieve custom design requests');
  }
};

/**
 * Delete a custom design request
 * @param {string} id - Request ID
 * @param {string} userId - User ID (for ownership verification)
 * @param {string} userRole - User role (customer, staff, admin)
 * @returns {Object} Deleted request
 */
export const deleteCustomDesignRequest = async (id, userId, userRole) => {
  try {
    validateObjectId(id, 'ID yêu cầu');

    const request = await CustomDesignRequest.findById(id);
    if (!request) {
      throw new NotFoundError('Yêu cầu thiết kế không tồn tại');
    }

    // Check ownership: customers can only delete their own requests
    const isStaffOrAdmin = userRole === 'staff' || userRole === 'admin';
    if (!isStaffOrAdmin) {
      // For customers, verify email matches
      const User = mongoose.model('User');
      const user = await User.findById(userId).select('email');
      if (!user || user.email.toLowerCase() !== request.email.toLowerCase()) {
        throw new ValidationError('Bạn chỉ có thể xóa yêu cầu của chính mình');
      }
    }

    // Don't allow deletion if already converted to SetDesign
    if (request.convertedToDesignId) {
      throw new ValidationError('Không thể xóa yêu cầu đã được chuyển đổi thành Set Design');
    }

    await CustomDesignRequest.findByIdAndDelete(id);

    logger.info(`Custom design request deleted: ${id} by user: ${userId}`);
    return request;
  } catch (error) {
    logger.error('Error deleting custom design request:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi xóa yêu cầu thiết kế');
  }
};

/**
 * Get a single custom design request by ID
 * Customer: Can only view their own requests
 * Staff/Admin: Can view any request
 * @param {string} id - Request ID
 * @param {Object} user - Current user
 * @returns {Object} Custom design request
 */
export const getCustomDesignRequestById = async (id, user) => {
  try {
    validateObjectId(id, 'ID yêu cầu');

    const request = await CustomDesignRequest.findById(id)
      .populate('processedBy', 'name email')
      .populate('convertedToDesignId', 'name price images')
      .populate('customerId', 'fullName email avatar'); // Populate customer info

    if (!request) {
      throw new NotFoundError('Yêu cầu thiết kế không tồn tại');
    }

    // Check ownership: customers can only view their own requests
    const isStaffOrAdmin = user?.role === 'staff' || user?.role === 'admin';
    if (!isStaffOrAdmin) {
      const emailFromUser = user?.email?.toLowerCase();
      if (!emailFromUser || emailFromUser !== request.email.toLowerCase()) {
        throw new ValidationError('Bạn chỉ có thể xem yêu cầu của chính mình');
      }
    }

    return request;
  } catch (error) {
    logger.error('Error getting custom design request:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi lấy thông tin yêu cầu thiết kế');
  }
};

/**
 * Update a custom design request
 * Customer: Can only update their own pending requests (limited fields)
 * Staff/Admin: Can update any request (all fields)
 * @param {string} id - Request ID
 * @param {Object} updateData - Update data
 * @param {Object} user - Current user
 * @returns {Object} Updated request
 */
export const updateCustomDesignRequest = async (id, updateData, user) => {
  try {
    validateObjectId(id, 'ID yêu cầu');

    const request = await CustomDesignRequest.findById(id);
    if (!request) {
      throw new NotFoundError('Yêu cầu thiết kế không tồn tại');
    }

    const isStaffOrAdmin = user?.role === 'staff' || user?.role === 'admin';

    // Check ownership for customers
    if (!isStaffOrAdmin) {
      const emailFromUser = user?.email?.toLowerCase();
      if (!emailFromUser || emailFromUser !== request.email.toLowerCase()) {
        throw new ValidationError('Bạn chỉ có thể cập nhật yêu cầu của chính mình');
      }

      // Customers can only update pending requests
      if (request.status !== 'pending') {
        throw new ValidationError('Chỉ có thể cập nhật yêu cầu đang chờ xử lý');
      }

      // Customers can only update limited fields
      const allowedFields = ['description', 'referenceImages', 'preferredCategory', 'budget'];
      const updateFields = Object.keys(updateData);
      const invalidFields = updateFields.filter(field => !allowedFields.includes(field));
      
      if (invalidFields.length > 0) {
        throw new ValidationError(`Không thể cập nhật các trường: ${invalidFields.join(', ')}`);
      }

      // Apply customer updates
      if (updateData.description !== undefined) {
        if (updateData.description.length < 20 || updateData.description.length > 1000) {
          throw new ValidationError('Mô tả phải từ 20-1000 ký tự');
        }
        request.description = updateData.description;
      }
      if (updateData.referenceImages !== undefined) {
        if (!Array.isArray(updateData.referenceImages) || updateData.referenceImages.length > 5) {
          throw new ValidationError('Hình ảnh tham khảo phải là mảng và không quá 5 ảnh');
        }
        // Validate each reference image object structure
        for (const img of updateData.referenceImages) {
          if (!img.url) {
            throw new ValidationError('Mỗi ảnh tham khảo phải có URL');
          }
        }
        request.referenceImages = updateData.referenceImages;
      }
      if (updateData.preferredCategory !== undefined) {
        if (updateData.preferredCategory && !SET_DESIGN_CATEGORIES.includes(updateData.preferredCategory)) {
          throw new ValidationError(`Danh mục không hợp lệ. Chọn từ: ${SET_DESIGN_CATEGORIES.join(', ')}`);
        }
        request.preferredCategory = updateData.preferredCategory;
      }
      if (updateData.budget !== undefined) {
        if (typeof updateData.budget !== 'number' || updateData.budget < 0) {
          throw new ValidationError('Ngân sách phải là số dương');
        }
        request.budget = updateData.budget;
      }
    } else {
      // Staff/Admin can update any field
      if (updateData.status !== undefined) {
        const validStatuses = ['pending', 'processing', 'completed', 'rejected'];
        if (!validStatuses.includes(updateData.status)) {
          throw new ValidationError(`Trạng thái không hợp lệ. Chọn từ: ${validStatuses.join(', ')}`);
        }
        request.status = updateData.status;
        request.processedBy = user._id;
      }
      if (updateData.staffNotes !== undefined) {
        request.staffNotes = updateData.staffNotes;
      }
      if (updateData.estimatedPrice !== undefined) {
        if (isNaN(updateData.estimatedPrice) || updateData.estimatedPrice < 0) {
          throw new ValidationError('Giá ước tính phải là số không âm');
        }
        request.estimatedPrice = updateData.estimatedPrice;
      }
      if (updateData.description !== undefined) {
        if (updateData.description.length < 20 || updateData.description.length > 1000) {
          throw new ValidationError('Mô tả phải từ 20-1000 ký tự');
        }
        request.description = updateData.description;
      }
      if (updateData.referenceImages !== undefined) {
        if (!Array.isArray(updateData.referenceImages) || updateData.referenceImages.length > 5) {
          throw new ValidationError('Hình ảnh tham khảo phải là mảng và không quá 5 ảnh');
        }
        // Validate each reference image object structure
        for (const img of updateData.referenceImages) {
          if (!img.url) {
            throw new ValidationError('Mỗi ảnh tham khảo phải có URL');
          }
        }
        request.referenceImages = updateData.referenceImages;
      }
      // Handle new reference images from file uploads (for staff)
      // Default behavior: Replace all existing images with new ones
      if (updateData.newReferenceImages !== undefined) {
        // Validate max 5 new images
        if (updateData.newReferenceImages.length > 5) {
          throw new ValidationError('Tối đa 5 ảnh tham khảo');
        }
        // Validate each reference image object structure
        for (const img of updateData.newReferenceImages) {
          if (!img.url) {
            throw new ValidationError('Mỗi ảnh tham khảo phải có URL');
          }
        }
        
        // Replace all existing images with new ones
        request.referenceImages = updateData.newReferenceImages;
      }
      if (updateData.preferredCategory !== undefined) {
        if (updateData.preferredCategory && !SET_DESIGN_CATEGORIES.includes(updateData.preferredCategory)) {
          throw new ValidationError(`Danh mục không hợp lệ. Chọn từ: ${SET_DESIGN_CATEGORIES.join(', ')}`);
        }
        request.preferredCategory = updateData.preferredCategory;
      }
      if (updateData.budget !== undefined) {
        if (typeof updateData.budget === 'number' && updateData.budget >= 0) {
          request.budget = updateData.budget;
        }
      }
    }

    await request.save();
    logger.info(`Custom design request ${id} updated by user: ${user._id}`);
    
    return request;
  } catch (error) {
    logger.error('Error updating custom design request:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi cập nhật yêu cầu thiết kế');
  }
};

/**
 * Update custom design request status (Staff only)
 * @param {string} id - Request ID
 * @param {string} status - New status
 * @param {string} staffId - Staff member ID
 * @param {Object} updateData - Additional update data
 * @returns {Object} Updated request
 */
export const updateCustomDesignRequestStatus = async (id, status, staffId, updateData = {}) => {
  try {
    const request = await CustomDesignRequest.findById(id);
    if (!request) {
      throw new Error('Custom design request not found');
    }

    request.status = status;
    request.processedBy = staffId;

    if (updateData.staffNotes) request.staffNotes = updateData.staffNotes;
    if (updateData.estimatedPrice) request.estimatedPrice = updateData.estimatedPrice;

    await request.save();

    logger.info(`Custom design request ${id} updated to status: ${status}`);
    return request;
  } catch (error) {
    logger.error('Error updating custom design request:', error);
    throw new Error('Failed to update custom design request');
  }
};

/**
 * Convert approved custom request to actual SetDesign product
 * @param {string} requestId - Custom design request ID
 * @param {Object} designData - Additional design data
 * @returns {Object} Created SetDesign
 */
export const convertRequestToSetDesign = async (requestId, designData = {}, user) => {
  try {
    // Only staff can convert requests
    if (!user || user.role !== 'staff') {
      throw new ValidationError('Chỉ staff mới có thể chuyển đổi yêu cầu thành set design');
    }

    if (!requestId) {
      throw new ValidationError('ID yêu cầu là bắt buộc');
    }

    const request = await CustomDesignRequest.findById(requestId);
    if (!request) {
      throw new NotFoundError('Yêu cầu thiết kế tùy chỉnh không tồn tại');
    }
    if (request.status !== 'processing' && request.status !== 'completed') {
      throw new ValidationError('Chỉ có thể chuyển đổi yêu cầu đang xử lý hoặc đã hoàn thành');
    }
    if (request.convertedToDesignId) {
      throw new ValidationError('Yêu cầu này đã được chuyển đổi thành set design rồi');
    }

    // Validate price if provided
    if (designData.price !== undefined && (isNaN(designData.price) || designData.price < 0)) {
      throw new ValidationError('Giá phải là số không âm');
    }

    // Collect all images from the request using Set to prevent duplicates
    const imageSet = new Set();
    
    // Helper function to extract URL and add to set
    const addImageToSet = (img) => {
      if (typeof img === 'string' && img.trim()) {
        imageSet.add(img.trim());
      } else if (img && typeof img.url === 'string' && img.url.trim()) {
        imageSet.add(img.url.trim());
      }
    };
    
    // Add generated images (array)
    if (request.generatedImages && request.generatedImages.length > 0) {
      request.generatedImages.forEach(addImageToSet);
    }
    
    // Add reference images (array)
    if (request.referenceImages && request.referenceImages.length > 0) {
      request.referenceImages.forEach(addImageToSet);
    }
    
    // Add any additional images from designData
    if (designData.additionalImages && designData.additionalImages.length > 0) {
      designData.additionalImages.forEach(addImageToSet);
    }
    
    // Convert Set to Array
    const allImages = Array.from(imageSet);

    // Create SetDesign from request
    const setDesign = new SetDesign({
      name: designData.name || `Custom Design - ${request.customerName}`,
      description: request.description,
      price: request.estimatedPrice || designData.price || 0,
      images: allImages,
      category: request.preferredCategory || 'other',
      tags: ['custom', ...(designData.tags || [])],
      isActive: designData.isActive !== undefined ? designData.isActive : true,
      createdBy: user._id,
      isConvertedFromCustomRequest: true,
      sourceRequestId: requestId
    });
    await setDesign.save();
    
    // Update request with conversion info
    request.convertedToDesignId = setDesign._id;
    await request.save();
    
    logger.info(`Custom design request ${requestId} converted to SetDesign ${setDesign._id} by user: ${user._id}`);
    return setDesign;
  } catch (error) {
    logger.error('Error converting request to set design:', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new Error('Lỗi khi chuyển đổi yêu cầu thành set design');
  }
};

/**
 * Get converted set designs from custom requests
 * @param {Object} filters - Filter options
 * @param {string} [filters.email] - Customer email (for customers)
 * @param {Object} user - Current user
 * @returns {Object} Converted set designs with pagination
 */
export const getConvertedCustomDesigns = async (filters = {}) => {
  try {
    const {
      page = 1,
      limit = 10,
      search
    } = filters;

    const safePage = Math.max(1, parseInt(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, parseInt(limit) || 10));
    const skip = (safePage - 1) * safeLimit;

    // Build query for CustomDesignRequests that have been converted (Public - show all)
    const requestQuery = {
      convertedToDesignId: { $ne: null }
    };

    // Search filter
    if (search && search.trim().length > 0) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      requestQuery.$or = [
        { customerName: searchRegex },
        { description: searchRegex },
        { email: searchRegex }
      ];
    }

    // Get converted requests with their SetDesign data
    const [requests, total] = await Promise.all([
      CustomDesignRequest.find(requestQuery)
        .populate('convertedToDesignId')
        .populate('processedBy', 'name email')
        .populate('customerId', 'fullName email avatar')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      CustomDesignRequest.countDocuments(requestQuery)
    ]);

    // Transform data to include both request and design info
    const convertedDesigns = requests.map(request => ({
      requestId: request._id,
      customerName: request.customerName,
      email: request.email,
      phoneNumber: request.phoneNumber,
      customerAvatar: request.customerId?.avatar || null,
      originalDescription: request.description,
      requestedAt: request.createdAt,
      convertedAt: request.updatedAt,
      processedBy: request.processedBy,
      estimatedPrice: request.estimatedPrice,
      setDesign: request.convertedToDesignId
    }));

    return {
      designs: convertedDesigns,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit)
      }
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    logger.error('Error getting converted custom designs:', error);
    throw new Error('Lỗi khi lấy danh sách set design đã chuyển đổi');
  }
};

/**
 * Get all converted SetDesigns (SetDesigns created from custom requests)
 * This queries the SetDesign model directly using the isConvertedFromCustomRequest flag
 * @param {Object} options - Query options
 * @returns {{designs: Array, pagination: {page: number, limit: number, total: number, pages: number}}}
 *          Paginated result of converted set designs
 */
export const getAllConvertedSetDesigns = async (options = {}) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    // Only get converted set designs
    const query = { 
      isActive: true,
      isConvertedFromCustomRequest: true
    };

    // Add category filter
    if (category && category !== 'all') {
      query.category = category;
    }

    // Add search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const [designs, total] = await Promise.all([
      SetDesign.find(query)
        .populate('sourceRequestId', 'customerName')
        .populate('createdBy', 'name')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit),
      SetDesign.countDocuments(query)
    ]);

    return {
      designs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting all converted set designs:', error);
    throw new Error('Lỗi khi lấy danh sách set design đã chuyển đổi');
  }
};

// #endregion