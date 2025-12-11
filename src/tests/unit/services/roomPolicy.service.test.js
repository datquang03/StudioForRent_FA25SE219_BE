/**
 * Unit Tests for RoomPolicy Service
 * Tests policy functions in src/services/roomPolicy.service.js
 */

import mongoose from 'mongoose';
import RoomPolicy from '../../../models/Policy/roomPolicy.model.js';
import roomPolicyService from '../../../services/roomPolicy.service.js';
import { generateObjectId } from '../../mocks/factories.js';

describe('RoomPolicy Service', () => {
  // #region Get All Policies Tests
  describe('getAllPolicies', () => {
    beforeEach(async () => {
      await RoomPolicy.create([
        {
          name: 'Standard Cancellation',
          description: 'Standard cancellation policy',
          type: 'CANCELLATION',
          category: 'STANDARD',
          isActive: true,
          refundTiers: [
            { hoursBeforeBooking: 48, refundPercentage: 100 },
            { hoursBeforeBooking: 24, refundPercentage: 50 },
            { hoursBeforeBooking: 0, refundPercentage: 0 },
          ],
        },
        {
          name: 'No Show Policy',
          description: 'Policy for no-shows',
          type: 'NO_SHOW',
          category: 'STANDARD',
          isActive: true,
          noShowRules: {
            chargeType: 'FULL_CHARGE',
            chargePercentage: 100,
          },
        },
        {
          name: 'Inactive Policy',
          description: 'Inactive policy for testing',
          type: 'CANCELLATION',
          category: 'STANDARD',
          isActive: false,
        },
      ]);
    });

    it('should return all policies with pagination', async () => {
      const result = await roomPolicyService.getAllPolicies({ page: 1, limit: 10 });

      expect(result.policies.length).toBe(3);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
    });

    it('should filter by type', async () => {
      const result = await roomPolicyService.getAllPolicies({ type: 'CANCELLATION' });

      expect(result.policies.length).toBe(2);
      expect(result.policies.every(p => p.type === 'CANCELLATION')).toBe(true);
    });

    it('should filter by isActive', async () => {
      const result = await roomPolicyService.getAllPolicies({ isActive: true });

      expect(result.policies.length).toBe(2);
      expect(result.policies.every(p => p.isActive === true)).toBe(true);
    });

    it('should search by name', async () => {
      const result = await roomPolicyService.getAllPolicies({ search: 'Standard' });

      expect(result.policies.length).toBe(1);
      expect(result.policies[0].name).toBe('Standard Cancellation');
    });

    it('should search by description', async () => {
      const result = await roomPolicyService.getAllPolicies({ search: 'no-shows' });

      expect(result.policies.length).toBe(1);
    });

    it('should handle pagination correctly', async () => {
      const page1 = await roomPolicyService.getAllPolicies({ page: 1, limit: 2 });
      const page2 = await roomPolicyService.getAllPolicies({ page: 2, limit: 2 });

      expect(page1.policies.length).toBe(2);
      expect(page2.policies.length).toBe(1);
    });

    it('should handle invalid page number', async () => {
      const result = await roomPolicyService.getAllPolicies({ page: -5 });

      expect(result.page).toBe(1);
    });
  });
  // #endregion

  // #region Create Policy Tests
  describe('createPolicy', () => {
    it('should create cancellation policy', async () => {
      const result = await roomPolicyService.createPolicy({
        name: 'New Cancellation',
        description: 'New cancellation policy',
        type: 'CANCELLATION',
        category: 'STANDARD',
        isActive: true,
        refundTiers: [
          { hoursBeforeBooking: 72, refundPercentage: 100 },
        ],
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('New Cancellation');
      expect(result.type).toBe('CANCELLATION');
    });

    it('should create no-show policy', async () => {
      const result = await roomPolicyService.createPolicy({
        name: 'Grace Period No-Show',
        description: 'No-show with grace period',
        type: 'NO_SHOW',
        category: 'STANDARD',
        isActive: true,
        noShowRules: {
          chargeType: 'GRACE_PERIOD',
          graceMinutes: 15,
        },
      });

      expect(result.type).toBe('NO_SHOW');
      expect(result.noShowRules.chargeType).toBe('GRACE_PERIOD');
    });
  });
  // #endregion

  // #region Get Policy By ID Tests
  describe('getPolicyById', () => {
    it('should return policy by id', async () => {
      const policy = await RoomPolicy.create({
        name: 'Test Policy',
        type: 'CANCELLATION',
        category: 'STANDARD',
        isActive: true,
      });

      const result = await roomPolicyService.getPolicyById(policy._id);

      expect(result._id.toString()).toBe(policy._id.toString());
    });

    it('should throw error for non-existent policy', async () => {
      await expect(roomPolicyService.getPolicyById(generateObjectId()))
        .rejects
        .toThrow(); // Service throws ApiError
    });
  });
  // #endregion

  // #region Get Policies By Type Tests
  describe('getPoliciesByType', () => {
    beforeEach(async () => {
      await RoomPolicy.create([
        { name: 'Active Cancel 1', type: 'CANCELLATION', category: 'STANDARD', isActive: true },
        { name: 'Active Cancel 2', type: 'CANCELLATION', category: 'STANDARD', isActive: true },
        { name: 'Inactive Cancel', type: 'CANCELLATION', category: 'STANDARD', isActive: false },
        { name: 'Active NoShow', type: 'NO_SHOW', category: 'STANDARD', isActive: true, noShowRules: { chargeType: 'FULL_CHARGE', chargePercentage: 100 } },
      ]);
    });

    it('should return active policies by type', async () => {
      const result = await roomPolicyService.getPoliciesByType('CANCELLATION');

      expect(result.length).toBe(2);
      expect(result.every(p => p.type === 'CANCELLATION' && p.isActive)).toBe(true);
    });

    it('should return inactive policies when specified', async () => {
      const result = await roomPolicyService.getPoliciesByType('CANCELLATION', false);

      expect(result.length).toBe(1);
      expect(result[0].isActive).toBe(false);
    });
  });
  // #endregion

  // #region Calculate Refund Tests
  describe('calculateRefund', () => {
    const cancellationPolicy = {
      type: 'CANCELLATION',
      refundTiers: [
        { hoursBeforeBooking: 48, refundPercentage: 100 },
        { hoursBeforeBooking: 24, refundPercentage: 50 },
        { hoursBeforeBooking: 12, refundPercentage: 25 },
        { hoursBeforeBooking: 0, refundPercentage: 0 },
      ],
    };

    it('should return 100% refund for cancellation 72 hours before', () => {
      const bookingTime = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const cancellationTime = new Date();

      const result = roomPolicyService.calculateRefund(
        cancellationPolicy,
        bookingTime,
        cancellationTime,
        1000000
      );

      expect(result.refundPercentage).toBe(100);
      expect(result.refundAmount).toBe(1000000);
    });

    it('should return 50% refund for cancellation 36 hours before', () => {
      const bookingTime = new Date(Date.now() + 36 * 60 * 60 * 1000);
      const cancellationTime = new Date();

      const result = roomPolicyService.calculateRefund(
        cancellationPolicy,
        bookingTime,
        cancellationTime,
        1000000
      );

      expect(result.refundPercentage).toBe(50);
      expect(result.refundAmount).toBe(500000);
    });

    it('should return 25% refund for cancellation 20 hours before', () => {
      const bookingTime = new Date(Date.now() + 20 * 60 * 60 * 1000);
      const cancellationTime = new Date();

      const result = roomPolicyService.calculateRefund(
        cancellationPolicy,
        bookingTime,
        cancellationTime,
        1000000
      );

      expect(result.refundPercentage).toBe(25);
      expect(result.refundAmount).toBe(250000);
    });

    it('should return 0% refund for cancellation 6 hours before', () => {
      const bookingTime = new Date(Date.now() + 6 * 60 * 60 * 1000);
      const cancellationTime = new Date();

      const result = roomPolicyService.calculateRefund(
        cancellationPolicy,
        bookingTime,
        cancellationTime,
        1000000
      );

      expect(result.refundPercentage).toBe(0);
      expect(result.refundAmount).toBe(0);
    });

    it('should throw error for invalid policy type', () => {
      expect(() => roomPolicyService.calculateRefund(
        { type: 'NO_SHOW' },
        new Date(),
        new Date(),
        1000000
      )).toThrow(); // Throws ApiError for invalid policy type
    });

    it('should throw error for null policy', () => {
      expect(() => roomPolicyService.calculateRefund(
        null,
        new Date(),
        new Date(),
        1000000
      )).toThrow(); // Throws ApiError for null policy
    });
  });
  // #endregion

  // #region Calculate No-Show Charge Tests
  describe('calculateNoShowCharge', () => {
    it('should charge full amount for FULL_CHARGE type', () => {
      const noShowPolicy = {
        type: 'NO_SHOW',
        noShowRules: {
          chargeType: 'FULL_CHARGE',
        },
      };

      const result = roomPolicyService.calculateNoShowCharge(
        noShowPolicy,
        new Date(Date.now() - 60 * 60 * 1000), // Booking was 1 hour ago
        null, // No check-in
        1000000
      );

      expect(result.isNoShow).toBe(true);
      expect(result.chargeType).toBe('FULL_CHARGE');
      expect(result.chargeAmount).toBe(1000000);
    });

    it('should charge partial amount for PARTIAL_CHARGE type', () => {
      const noShowPolicy = {
        type: 'NO_SHOW',
        noShowRules: {
          chargeType: 'PARTIAL_CHARGE',
          chargePercentage: 50,
        },
      };

      const result = roomPolicyService.calculateNoShowCharge(
        noShowPolicy,
        new Date(Date.now() - 60 * 60 * 1000),
        null,
        1000000
      );

      expect(result.chargeType).toBe('PARTIAL_CHARGE');
      expect(result.chargeAmount).toBe(500000);
    });

    it('should not charge if within grace period', () => {
      const bookingTime = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago
      const checkInTime = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago (5 min late)

      const noShowPolicy = {
        type: 'NO_SHOW',
        noShowRules: {
          chargeType: 'GRACE_PERIOD',
          graceMinutes: 15,
        },
      };

      const result = roomPolicyService.calculateNoShowCharge(
        noShowPolicy,
        bookingTime,
        checkInTime,
        1000000
      );

      expect(result.isNoShow).toBe(false);
      expect(result.chargeAmount).toBe(0);
    });

    it('should charge if grace period exceeded', () => {
      const bookingTime = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
      const checkInTime = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago (25 min late)

      const noShowPolicy = {
        type: 'NO_SHOW',
        noShowRules: {
          chargeType: 'GRACE_PERIOD',
          graceMinutes: 15,
        },
      };

      const result = roomPolicyService.calculateNoShowCharge(
        noShowPolicy,
        bookingTime,
        checkInTime,
        1000000
      );

      expect(result.isNoShow).toBe(true);
      expect(result.chargeAmount).toBe(1000000);
    });

    it('should forgive first-time no-show', () => {
      const noShowPolicy = {
        type: 'NO_SHOW',
        noShowRules: {
          chargeType: 'FORGIVENESS',
          maxForgivenessCount: 1,
        },
      };

      const result = roomPolicyService.calculateNoShowCharge(
        noShowPolicy,
        new Date(Date.now() - 60 * 60 * 1000),
        null,
        1000000,
        0 // No previous no-shows
      );

      expect(result.isNoShow).toBe(true);
      expect(result.forgiven).toBe(true);
      expect(result.chargeAmount).toBe(0);
    });

    it('should charge after exceeding forgiveness limit', () => {
      const noShowPolicy = {
        type: 'NO_SHOW',
        noShowRules: {
          chargeType: 'FORGIVENESS',
          maxForgivenessCount: 1,
        },
      };

      const result = roomPolicyService.calculateNoShowCharge(
        noShowPolicy,
        new Date(Date.now() - 60 * 60 * 1000),
        null,
        1000000,
        1 // 1 previous no-show
      );

      expect(result.isNoShow).toBe(true);
      expect(result.forgiven).toBe(false);
      expect(result.chargeAmount).toBe(1000000);
    });

    it('should not charge if customer checked in on time', () => {
      const bookingTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour in future
      const checkInTime = new Date(Date.now()); // Now (before booking)

      const noShowPolicy = {
        type: 'NO_SHOW',
        noShowRules: {
          chargeType: 'FULL_CHARGE',
        },
      };

      const result = roomPolicyService.calculateNoShowCharge(
        noShowPolicy,
        bookingTime,
        checkInTime,
        1000000
      );

      expect(result.isNoShow).toBe(false);
      expect(result.chargeAmount).toBe(0);
    });

    it('should throw error for invalid policy type', () => {
      expect(() => roomPolicyService.calculateNoShowCharge(
        { type: 'CANCELLATION' },
        new Date(),
        null,
        1000000
      )).toThrow(); // Throws ApiError for invalid policy type
    });

    it('should throw error for unknown charge type', () => {
      const noShowPolicy = {
        type: 'NO_SHOW',
        noShowRules: {
          chargeType: 'UNKNOWN_TYPE',
        },
      };

      expect(() => roomPolicyService.calculateNoShowCharge(
        noShowPolicy,
        new Date(Date.now() - 60 * 60 * 1000),
        null,
        1000000
      )).toThrow(); // Throws ApiError for unknown charge type
    });
  });
  // #endregion

  // #region Update Policy Tests
  describe('updatePolicy', () => {
    it('should update policy', async () => {
      const policy = await RoomPolicy.create({
        name: 'Original',
        type: 'CANCELLATION',
        category: 'STANDARD',
        isActive: true,
      });

      const result = await roomPolicyService.updatePolicy(policy._id, {
        name: 'Updated Name',
        isActive: false,
      });

      expect(result.name).toBe('Updated Name');
      expect(result.isActive).toBe(false);
    });

    it('should throw error for non-existent policy', async () => {
      await expect(roomPolicyService.updatePolicy(generateObjectId(), { name: 'New' }))
        .rejects
        .toThrow(); // Service throws ApiError
    });
  });
  // #endregion

  // #region Delete Policy Tests
  describe('deletePolicy', () => {
    it('should soft delete policy by setting isActive to false', async () => {
      const policy = await RoomPolicy.create({
        name: 'To Delete',
        type: 'CANCELLATION',
        category: 'STANDARD',
        isActive: true,
      });

      const result = await roomPolicyService.deletePolicy(policy._id);

      expect(result.isActive).toBe(false);

      // Verify policy still exists but is inactive
      const deletedPolicy = await RoomPolicy.findById(policy._id);
      expect(deletedPolicy).not.toBeNull();
      expect(deletedPolicy.isActive).toBe(false);
    });

    it('should throw error for non-existent policy', async () => {
      await expect(roomPolicyService.deletePolicy(generateObjectId()))
        .rejects
        .toThrow(); // Service throws ApiError
    });
  });
  // #endregion

  // #region Get All Active Policies Tests
  describe('getAllActivePolicies', () => {
    beforeEach(async () => {
      await RoomPolicy.create([
        { name: 'Cancel 1', type: 'CANCELLATION', category: 'STANDARD', isActive: true },
        { name: 'Cancel 2', type: 'CANCELLATION', category: 'STANDARD', isActive: true },
        { name: 'NoShow 1', type: 'NO_SHOW', category: 'STANDARD', isActive: true, noShowRules: { chargeType: 'FULL_CHARGE', chargePercentage: 100 } },
        { name: 'Inactive', type: 'CANCELLATION', category: 'STANDARD', isActive: false },
      ]);
    });

    it('should return active policies grouped by type', async () => {
      const result = await roomPolicyService.getAllActivePolicies();

      expect(result.CANCELLATION).toBeDefined();
      expect(result.CANCELLATION.length).toBe(2);
      expect(result.NO_SHOW).toBeDefined();
      expect(result.NO_SHOW.length).toBe(1);
    });

    it('should not include inactive policies', async () => {
      const result = await roomPolicyService.getAllActivePolicies();

      const allPolicies = Object.values(result).flat();
      expect(allPolicies.every(p => p.isActive)).toBe(true);
    });
  });
  // #endregion
});
