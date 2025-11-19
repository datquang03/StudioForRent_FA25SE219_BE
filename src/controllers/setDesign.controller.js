// #region Imports
import asyncHandler from 'express-async-handler';
import {
  generateAiDesign,
  selectFinalDesign,
  generatePropsRecommendations,
  getAiIterations,
  sendChatMessage,
  getChatHistory,
  generateDesignsFromChat
} from '../services/setDesign.service.js';
import SetDesign from '../models/SetDesign/setDesign.model.js';
import { AI_SET_DESIGN_STATUS } from '../utils/constants.js';
// #endregion

// #region Set Design Controller

/**
 * Generate AI design suggestions for a booking
 * POST /api/set-designs/generate
 */
export const generateAiDesignController = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const rawPreferences = req.body;

  if (!bookingId) {
    res.status(400);
    throw new Error('bookingId là bắt buộc');
  }

  // Validate and filter preferences to only studio-related topics
  const allowedKeys = ['theme', 'style', 'colors', 'mood', 'lighting', 'backdrop', 'props', 'camera', 'specialEffects', 'atmosphere', 'lightingType', 'background', 'composition'];
  const preferences = Object.entries(rawPreferences)
    .filter(([key, value]) => {
      const isAllowed = allowedKeys.includes(key.toLowerCase());
      const isValidValue = typeof value === 'string' && value.length > 0 && value.length < 200;
      return isAllowed && isValidValue;
    })
    .reduce((obj, [key, value]) => {
      obj[key] = value;
      return obj;
    }, {});

  // Limit to maximum 5 preferences to prevent abuse
  const limitedPreferences = Object.fromEntries(
    Object.entries(preferences).slice(0, 5)
  );

  const result = await generateAiDesign(bookingId, limitedPreferences);

  res.status(201).json({
    success: true,
    message: 'AI design suggestions generated successfully',
    data: result
  });
});

/**
 * Get all AI iterations for a setDesign
 * GET /api/set-designs/:setDesignId/iterations
 */
export const getAiIterationsController = asyncHandler(async (req, res) => {
  const { setDesignId } = req.params;

  const iterations = await getAiIterations(setDesignId);

  res.status(200).json({
    success: true,
    data: iterations
  });
});

/**
 * Select final AI design from iterations
 * POST /api/set-designs/:setDesignId/select
 */
export const selectFinalDesignController = asyncHandler(async (req, res) => {
  const { setDesignId } = req.params;
  const { iterationIndex } = req.body;

  if (iterationIndex === undefined || iterationIndex < 0) {
    res.status(400);
    throw new Error('iterationIndex là bắt buộc và phải >= 0');
  }

  const setDesign = await selectFinalDesign(setDesignId, iterationIndex);

  res.status(200).json({
    success: true,
    message: 'Final design selected successfully',
    data: setDesign
  });
});

/**
 * Generate props/equipment recommendations
 * POST /api/set-designs/:setDesignId/props
 */
export const generatePropsRecommendationsController = asyncHandler(async (req, res) => {
  const { setDesignId } = req.params;

  const recommendations = await generatePropsRecommendations(setDesignId);

  res.status(200).json({
    success: true,
    message: 'Props recommendations generated successfully',
    data: recommendations
  });
});

/**
 * Get setDesign details
 * GET /api/set-designs/:setDesignId
 */
export const getSetDesignController = asyncHandler(async (req, res) => {
  const { setDesignId } = req.params;

  const setDesign = await SetDesign.findById(setDesignId)
    .populate('bookingId', 'scheduleId userId')
    .populate('staffInChargeId', 'username fullName')
    .lean();

  if (!setDesign) {
    res.status(404);
    throw new Error('SetDesign không tồn tại');
  }

  res.status(200).json({
    success: true,
    data: setDesign
  });
});

/**
 * Update setDesign status (for staff)
 * PATCH /api/set-designs/:setDesignId/status
 */
export const updateSetDesignStatusController = asyncHandler(async (req, res) => {
  const { setDesignId } = req.params;
  const { status, staffNotes, finalPrice } = req.body;

  const updateData = {};
  if (status) updateData.status = status;
  if (staffNotes !== undefined) updateData.staffNotes = staffNotes;
  if (finalPrice !== undefined) updateData.finalPrice = finalPrice;

  // If status is PENDING_IMPLEMENTATION, assign staff
  if (status === AI_SET_DESIGN_STATUS.PENDING_IMPLEMENTATION) {
    updateData.staffInChargeId = req.user.id;
  }

  const setDesign = await SetDesign.findByIdAndUpdate(
    setDesignId,
    updateData,
    { new: true }
  ).populate('staffInChargeId', 'username fullName');

  if (!setDesign) {
    res.status(404);
    throw new Error('SetDesign không tồn tại');
  }

  res.status(200).json({
    success: true,
    message: 'SetDesign updated successfully',
    data: setDesign
  });
});

/**
 * Get setDesigns by booking ID
 * GET /api/set-designs/booking/:bookingId
 */
export const getSetDesignByBookingController = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  const setDesign = await SetDesign.findOne({ bookingId })
    .populate('bookingId', 'scheduleId userId')
    .populate('staffInChargeId', 'username fullName')
    .lean();

  if (!setDesign) {
    res.status(404);
    throw new Error('SetDesign không tồn tại cho booking này');
  }

  res.status(200).json({
    success: true,
    data: setDesign
  });
});

/**
 * Chat with AI about setDesign (conversational approach)
 * POST /api/set-designs/chat/:bookingId
 */
export const chatWithAiController = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { message } = req.body;

  if (!bookingId) {
    res.status(400);
    throw new Error('bookingId là bắt buộc');
  }

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400);
    throw new Error('message là bắt buộc và phải là chuỗi không rỗng');
  }

  // Limit message length to prevent abuse
  if (message.length > 500) {
    res.status(400);
    throw new Error('Tin nhắn quá dài (tối đa 500 ký tự)');
  }

  const result = await sendChatMessage(bookingId, message.trim());

  res.status(200).json({
    success: true,
    message: 'Chat message processed successfully',
    data: result
  });
});

/**
 * Get chat history for a booking
 * GET /api/set-designs/:bookingId/chat-history
 */
export const getChatHistoryController = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  if (!bookingId) {
    res.status(400);
    throw new Error('bookingId là bắt buộc');
  }

  const result = await getChatHistory(bookingId);

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * Generate design concepts from chat conversation
 * POST /api/set-designs/generate-from-chat/:bookingId
 */
export const generateFromChatController = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  if (!bookingId) {
    res.status(400);
    throw new Error('bookingId là bắt buộc');
  }

  const result = await generateDesignsFromChat(bookingId);

  res.status(201).json({
    success: true,
    message: 'Design concepts generated from conversation successfully',
    data: result
  });
});

// #endregion