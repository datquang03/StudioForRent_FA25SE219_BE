import RoomPolicyService from "../services/roomPolicy.service.js";
import { ApiError } from "../utils/errors.js";
import asyncHandler from 'express-async-handler';

/**
 * ROOM POLICY CONTROLLER
 * API endpoints for policy management
 */
class RoomPolicyController {

  /**
   * Create a new policy
   */
  createPolicy = asyncHandler(async (req, res) => {
    const policy = await RoomPolicyService.createPolicy(req.body);

    res.status(201).json({
      success: true,
      message: "Policy created successfully",
      data: policy
    });
  });

  /**
   * Get policy by ID
   */
  getPolicyById = asyncHandler(async (req, res) => {
    const { policyId } = req.params;
    const policy = await RoomPolicyService.getPolicyById(policyId);

    res.json({
      success: true,
      data: policy
    });
  });

  /**
   * Get policies by type
   */
  getPoliciesByType = asyncHandler(async (req, res) => {
    const { type } = req.params;
    const { isActive = true } = req.query;

    if (!['CANCELLATION', 'NO_SHOW'].includes(type)) {
      throw new ApiError(400, "Invalid policy type");
    }

    const policies = await RoomPolicyService.getPoliciesByType(type, isActive);

    res.json({
      success: true,
      data: policies
    });
  });

  /**
   * Get all active policies grouped by type
   */
  getAllActivePolicies = asyncHandler(async (req, res) => {
    const grouped = await RoomPolicyService.getAllActivePolicies();

    res.json({
      success: true,
      data: grouped,
    });
  });

  /**
   * Get all policies with pagination and search
   */
  getAllPolicies = asyncHandler(async (req, res) => {
    const { page, limit, type, category, isActive, search } = req.query;

    const result = await RoomPolicyService.getAllPolicies({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      type,
      category,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      search,
    });

    res.json({
      success: true,
      data: result.policies,
      pagination: {
        total: result.total,
        page: result.page,
        pages: result.pages,
        limit: parseInt(limit) || 10,
      },
    });
  });

  /**
   * Update policy
   */
  updatePolicy = asyncHandler(async (req, res) => {
    const { policyId } = req.params;
    const policy = await RoomPolicyService.updatePolicy(policyId, req.body);

    res.json({
      success: true,
      message: "Policy updated successfully",
      data: policy
    });
  });

  /**
   * Delete policy (soft delete)
   */
  deletePolicy = asyncHandler(async (req, res) => {
    const { policyId } = req.params;
    const policy = await RoomPolicyService.deletePolicy(policyId);

    res.json({
      success: true,
      message: "Policy deleted successfully",
      data: policy
    });
  });

  /**
   * Calculate refund for a booking cancellation
   */
  calculateRefund = asyncHandler(async (req, res) => {
    const { policyId } = req.params;
    const { bookingStartTime, cancellationTime, bookingAmount } = req.body;

    if (!bookingStartTime || !cancellationTime || !bookingAmount) {
      throw new ApiError(400, "Missing required fields: bookingStartTime, cancellationTime, bookingAmount");
    }

    const policy = await RoomPolicyService.getPolicyById(policyId);
    const result = RoomPolicyService.calculateRefund(
      policy,
      new Date(bookingStartTime),
      new Date(cancellationTime),
      bookingAmount
    );

    res.json({
      success: true,
      data: result
    });
  });

  /**
   * Calculate no-show charge for a booking
   */
  calculateNoShowCharge = asyncHandler(async (req, res) => {
    const { policyId } = req.params;
    const { bookingStartTime, checkInTime, bookingAmount, previousNoShowCount = 0 } = req.body;

    if (!bookingStartTime || !bookingAmount) {
      throw new ApiError(400, "Missing required fields: bookingStartTime, bookingAmount");
    }

    const policy = await RoomPolicyService.getPolicyById(policyId);
    const result = RoomPolicyService.calculateNoShowCharge(
      policy,
      new Date(bookingStartTime),
      checkInTime ? new Date(checkInTime) : null,
      bookingAmount,
      previousNoShowCount
    );

    res.json({
      success: true,
      data: result
    });
  });
}

export default new RoomPolicyController();