import RoomPolicy from "../models/Policy/roomPolicy.model.js";
import { ApiError } from "../utils/errors.js";
import { escapeRegex } from "../utils/helpers.js";

/**
 * ROOM POLICY SERVICE
 * Business logic for policy management, refund calculations, and no-show charges
 */
class RoomPolicyService {

  /**
   * Get all policies with pagination and search
   */
  async getAllPolicies({ page = 1, limit = 10, type, category, isActive, search }) {
    // Validate and sanitize pagination
    const safePage = Math.max(parseInt(page) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

    // Validate and sanitize search (prevent ReDoS)
    const safeSearch = search && search.length > 100 ? search.substring(0, 100) : search;

    const query = {};

    if (type) {
      query.type = type;
    }

    if (category) {
      query.category = category;
    }

    if (isActive !== undefined) {
      query.isActive = isActive;
    }

    // Search by name or description
    if (safeSearch) {
      const escapedSearch = escapeRegex(safeSearch);
      query.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { description: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    const skip = (safePage - 1) * safeLimit;

    const [policies, total] = await Promise.all([
      RoomPolicy.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(safeLimit),
      RoomPolicy.countDocuments(query),
    ]);

    return {
      policies,
      total,
      page: safePage,
      pages: Math.ceil(total / safeLimit),
    };
  }

  /**
   * Create a new policy
   */
  async createPolicy(policyData) {
    try {
      const policy = new RoomPolicy(policyData);
      await policy.save();
      return policy;
    } catch (error) {
      throw new ApiError(400, `Failed to create policy: ${error.message}`);
    }
  }

  /**
   * Get policy by ID
   */
  async getPolicyById(policyId) {
    try {
      const policy = await RoomPolicy.findById(policyId);
      if (!policy) {
        throw new ApiError(404, "Policy not found");
      }
      return policy;
    } catch (error) {
      throw new ApiError(500, `Failed to get policy: ${error.message}`);
    }
  }

  /**
   * Get policies by type
   */
  async getPoliciesByType(type, isActive = true) {
    try {
      return await RoomPolicy.find({ type, isActive });
    } catch (error) {
      throw new ApiError(500, `Failed to get policies: ${error.message}`);
    }
  }

  /**
   * Calculate refund amount for cancellation
   * @param {Object} cancellationPolicy - Policy snapshot
   * @param {Date} bookingStartTime - Booking start time
   * @param {Date} cancellationTime - Cancellation time
   * @param {Number} bookingAmount - Total booking amount
   * @returns {Object} Refund calculation result
   */
  calculateRefund(cancellationPolicy, bookingStartTime, cancellationTime, bookingAmount) {
    if (!cancellationPolicy || cancellationPolicy.type !== 'CANCELLATION') {
      throw new ApiError(400, "Invalid cancellation policy");
    }

    const hoursBeforeBooking = Math.floor(
      (bookingStartTime - cancellationTime) / (1000 * 60 * 60)
    );

    // Find applicable tier (tiers are sorted by hoursBeforeBooking descending)
    const applicableTier = cancellationPolicy.refundTiers.find(
      tier => hoursBeforeBooking >= tier.hoursBeforeBooking
    );

    if (!applicableTier) {
      return {
        refundAmount: 0,
        refundPercentage: 0,
        tier: null,
        hoursBeforeBooking
      };
    }

    const refundAmount = Math.round(
      (bookingAmount * applicableTier.refundPercentage) / 100
    );

    return {
      refundAmount,
      refundPercentage: applicableTier.refundPercentage,
      tier: applicableTier,
      hoursBeforeBooking
    };
  }

  /**
   * Calculate no-show charge
   * @param {Object} noShowPolicy - Policy snapshot
   * @param {Date} bookingStartTime - Booking start time
   * @param {Date} checkInTime - Actual check-in time (null if no-show)
   * @param {Number} bookingAmount - Total booking amount
   * @param {Number} previousNoShowCount - Number of previous no-shows
   * @returns {Object} Charge calculation result
   */
  calculateNoShowCharge(noShowPolicy, bookingStartTime, checkInTime, bookingAmount, previousNoShowCount = 0) {
    if (!noShowPolicy || noShowPolicy.type !== 'NO_SHOW') {
      throw new ApiError(400, "Invalid no-show policy");
    }

    const rules = noShowPolicy.noShowRules;

    // Check if it's actually a no-show
    const isNoShow = !checkInTime || checkInTime > bookingStartTime;

    if (!isNoShow) {
      return {
        chargeAmount: 0,
        chargeType: 'NO_CHARGE',
        isNoShow: false
      };
    }

    switch (rules.chargeType) {
      case 'FULL_CHARGE':
        return {
          chargeAmount: bookingAmount,
          chargeType: 'FULL_CHARGE',
          isNoShow: true
        };

      case 'PARTIAL_CHARGE':
        const partialAmount = Math.round(
          (bookingAmount * rules.chargePercentage) / 100
        );
        return {
          chargeAmount: partialAmount,
          chargeType: 'PARTIAL_CHARGE',
          chargePercentage: rules.chargePercentage,
          isNoShow: true
        };

      case 'GRACE_PERIOD':
        // If within grace period, no charge
        if (checkInTime) {
          const minutesLate = Math.floor(
            (checkInTime - bookingStartTime) / (1000 * 60)
          );
          if (minutesLate <= rules.graceMinutes) {
            return {
              chargeAmount: 0,
              chargeType: 'GRACE_PERIOD',
              minutesLate,
              isNoShow: false
            };
          }
        }
        // Beyond grace period = full charge
        return {
          chargeAmount: bookingAmount,
          chargeType: 'GRACE_PERIOD_EXCEEDED',
          isNoShow: true
        };

      case 'FORGIVENESS':
        if (previousNoShowCount < rules.maxForgivenessCount) {
          return {
            chargeAmount: 0,
            chargeType: 'FORGIVENESS',
            previousNoShowCount,
            isNoShow: true,
            forgiven: true
          };
        } else {
          return {
            chargeAmount: bookingAmount,
            chargeType: 'FORGIVENESS_EXCEEDED',
            previousNoShowCount,
            isNoShow: true,
            forgiven: false
          };
        }

      default:
        throw new ApiError(400, "Unknown charge type");
    }
  }

  /**
   * Update policy
   */
  async updatePolicy(policyId, updateData) {
    try {
      const policy = await RoomPolicy.findByIdAndUpdate(
        policyId,
        updateData,
        { new: true, runValidators: true }
      );

      if (!policy) {
        throw new ApiError(404, "Policy not found");
      }

      return policy;
    } catch (error) {
      throw new ApiError(400, `Failed to update policy: ${error.message}`);
    }
  }

  /**
   * Delete policy (soft delete by setting isActive to false)
   */
  async deletePolicy(policyId) {
    try {
      const policy = await RoomPolicy.findByIdAndUpdate(
        policyId,
        { isActive: false },
        { new: true }
      );

      if (!policy) {
        throw new ApiError(404, "Policy not found");
      }

      return policy;
    } catch (error) {
      throw new ApiError(500, `Failed to delete policy: ${error.message}`);
    }
  }

  /**
   * Get all active policies grouped by type
   */
  async getAllActivePolicies() {
    try {
      const policies = await RoomPolicy.find({ isActive: true });

      return policies.reduce((acc, policy) => {
        if (!acc[policy.type]) {
          acc[policy.type] = [];
        }
        acc[policy.type].push(policy);
        return acc;
      }, {});
    } catch (error) {
      throw new ApiError(500, `Failed to get policies: ${error.message}`);
    }
  }
}

export default new RoomPolicyService();