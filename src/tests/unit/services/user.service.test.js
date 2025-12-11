/**
 * Unit Tests for User Service
 * Tests all user management functions in src/services/user.service.js
 */

import mongoose from 'mongoose';
import { User, CustomerProfile, StaffProfile } from '../../../models/index.js';
import {
  getCustomerProfile,
  updateCustomerProfile,
  getAllCustomers,
  getCustomerById,
  toggleCustomerActive,
  getAllStaff,
  getStaffById,
  updateStaffProfile,
  toggleStaffActive,
} from '../../../services/user.service.js';
import { USER_MESSAGES } from '../../../utils/constants.js';
import { createMockUser, createMockCustomerProfile, createMockStaffProfile, generateObjectId } from '../../mocks/factories.js';

// Note: Notification service will execute normally in test environment (no mock in ESM)

describe('User Service', () => {
  // #region Customer Profile Tests
  describe('getCustomerProfile', () => {
    it('should return customer with profile', async () => {
      const user = await User.create(createMockUser({ role: 'customer' }));
      await CustomerProfile.create(createMockCustomerProfile(user._id));

      const result = await getCustomerProfile(user._id);

      expect(result).toBeDefined();
      expect(result._id.toString()).toBe(user._id.toString());
      expect(result.profile).toBeDefined();
      expect(result.passwordHash).toBeUndefined();
    });

    it('should throw error for non-existent user', async () => {
      await expect(getCustomerProfile(generateObjectId()))
        .rejects
        .toThrow(USER_MESSAGES.USER_NOT_FOUND);
    });
  });

  describe('updateCustomerProfile', () => {
    it('should update user fields', async () => {
      const user = await User.create(createMockUser());
      await CustomerProfile.create(createMockCustomerProfile(user._id));

      const result = await updateCustomerProfile(user._id, {
        fullName: 'Updated Name',
        phone: '0987654321',
      });

      expect(result.fullName).toBe('Updated Name');
      expect(result.phone).toBe('0987654321');
    });

    it('should update profile fields', async () => {
      const user = await User.create(createMockUser());
      await CustomerProfile.create(createMockCustomerProfile(user._id));

      await updateCustomerProfile(user._id, {
        address: 'New Address',
      });

      const profile = await CustomerProfile.findOne({ userId: user._id });
      expect(profile.address).toBe('New Address');
    });

    it('should not update disallowed fields', async () => {
      const user = await User.create(createMockUser());
      await CustomerProfile.create(createMockCustomerProfile(user._id));
      const originalEmail = user.email;

      await updateCustomerProfile(user._id, {
        email: 'newemail@example.com',
        role: 'admin',
      });

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.email).toBe(originalEmail);
      expect(updatedUser.role).toBe('customer');
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        updateCustomerProfile(generateObjectId(), { fullName: 'Test' })
      ).rejects.toThrow(USER_MESSAGES.USER_NOT_FOUND);
    });
  });
  // #endregion

  // #region Customer List Tests (Admin)
  describe('getAllCustomers', () => {
    beforeEach(async () => {
      // Create test customers
      await User.create([
        createMockUser({ username: 'customer1', email: 'customer1@test.com', role: 'customer', isActive: true }),
        createMockUser({ username: 'customer2', email: 'customer2@test.com', role: 'customer', isActive: true }),
        createMockUser({ username: 'customer3', email: 'customer3@test.com', role: 'customer', isActive: false }),
        createMockUser({ username: 'staff1', email: 'staff1@test.com', role: 'staff', isActive: true }),
      ]);
    });

    it('should return paginated list of customers', async () => {
      const result = await getAllCustomers({ page: 1, limit: 10 });

      expect(result.users).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.users.every(u => u.role === 'customer')).toBe(true);
    });

    it('should filter by active status', async () => {
      const activeResult = await getAllCustomers({ isActive: true });
      const inactiveResult = await getAllCustomers({ isActive: false });

      expect(activeResult.users).toHaveLength(2);
      expect(inactiveResult.users).toHaveLength(1);
    });

    it('should search by username, email, or fullName', async () => {
      const result = await getAllCustomers({ search: 'customer1' });

      expect(result.users).toHaveLength(1);
      expect(result.users[0].username).toBe('customer1');
    });

    it('should handle pagination correctly', async () => {
      const page1 = await getAllCustomers({ page: 1, limit: 2 });
      const page2 = await getAllCustomers({ page: 2, limit: 2 });

      expect(page1.users).toHaveLength(2);
      expect(page2.users).toHaveLength(1);
      expect(page1.pages).toBe(2);
    });

    it('should sanitize pagination params', async () => {
      const result = await getAllCustomers({ page: -1, limit: 1000 });

      expect(result.page).toBe(1);
      expect(result.users.length).toBeLessThanOrEqual(100);
    });

    it('should sanitize search to prevent ReDoS', async () => {
      const longSearch = 'a'.repeat(200);
      const result = await getAllCustomers({ search: longSearch });

      expect(result).toBeDefined();
    });
  });

  describe('getCustomerById', () => {
    it('should return customer with profile', async () => {
      const user = await User.create(createMockUser({ role: 'customer' }));
      await CustomerProfile.create(createMockCustomerProfile(user._id));

      const result = await getCustomerById(user._id);

      expect(result._id.toString()).toBe(user._id.toString());
      expect(result.profile).toBeDefined();
    });

    it('should throw error for non-existent user', async () => {
      await expect(getCustomerById(generateObjectId()))
        .rejects
        .toThrow(USER_MESSAGES.USER_NOT_FOUND);
    });

    it('should throw error for non-customer user', async () => {
      const staff = await User.create(createMockUser({ role: 'staff' }));

      await expect(getCustomerById(staff._id))
        .rejects
        .toThrow(USER_MESSAGES.USER_NOT_FOUND);
    });
  });

  describe('toggleCustomerActive', () => {
    it('should ban customer', async () => {
      const user = await User.create(createMockUser({ role: 'customer', isActive: true }));

      const result = await toggleCustomerActive(user._id, false);

      expect(result.isActive).toBe(false);
    });

    it('should unban customer', async () => {
      const user = await User.create(createMockUser({ role: 'customer', isActive: false }));

      const result = await toggleCustomerActive(user._id, true);

      expect(result.isActive).toBe(true);
    });

    it('should throw error for non-existent user', async () => {
      await expect(toggleCustomerActive(generateObjectId(), false))
        .rejects
        .toThrow(USER_MESSAGES.USER_NOT_FOUND);
    });

    it('should throw error for non-customer user', async () => {
      const staff = await User.create(createMockUser({ role: 'staff' }));

      await expect(toggleCustomerActive(staff._id, false))
        .rejects
        .toThrow(USER_MESSAGES.USER_NOT_FOUND);
    });
  });
  // #endregion

  // #region Staff Management Tests (Admin)
  describe('getAllStaff', () => {
    beforeEach(async () => {
      // Create test staff
      const staff1 = await User.create(createMockUser({ username: 'staff1', email: 'staff1@test.com', role: 'staff', isActive: true }));
      const staff2 = await User.create(createMockUser({ username: 'staff2', email: 'staff2@test.com', role: 'staff', isActive: true }));
      const admin1 = await User.create(createMockUser({ username: 'admin1', email: 'admin1@test.com', role: 'admin', isActive: true }));
      const customer1 = await User.create(createMockUser({ username: 'customer1', email: 'customer1@test.com', role: 'customer' }));

      await StaffProfile.create([
        createMockStaffProfile(staff1._id, { position: 'staff' }),
        createMockStaffProfile(staff2._id, { position: 'staff' }),
        createMockStaffProfile(admin1._id, { position: 'admin' }),
      ]);
    });

    it('should return paginated list of staff and admins', async () => {
      const result = await getAllStaff({ page: 1, limit: 10 });

      expect(result.users).toHaveLength(3);
      expect(result.users.every(u => ['staff', 'admin'].includes(u.role))).toBe(true);
    });

    it('should filter by position', async () => {
      const result = await getAllStaff({ position: 'admin' });

      expect(result.users).toHaveLength(1);
      expect(result.users[0].role).toBe('admin');
    });

    it('should search by username, email, or fullName', async () => {
      const result = await getAllStaff({ search: 'staff1' });

      expect(result.users).toHaveLength(1);
      expect(result.users[0].username).toBe('staff1');
    });

    it('should include staff profiles', async () => {
      const result = await getAllStaff({});

      expect(result.users[0].profile).toBeDefined();
    });
  });

  describe('getStaffById', () => {
    it('should return staff with profile', async () => {
      const user = await User.create(createMockUser({ role: 'staff' }));
      await StaffProfile.create(createMockStaffProfile(user._id));

      const result = await getStaffById(user._id);

      expect(result._id.toString()).toBe(user._id.toString());
      expect(result.profile).toBeDefined();
    });

    it('should throw error for non-existent user', async () => {
      await expect(getStaffById(generateObjectId()))
        .rejects
        .toThrow(USER_MESSAGES.USER_NOT_FOUND);
    });

    it('should throw error for customer user', async () => {
      const customer = await User.create(createMockUser({ role: 'customer' }));

      await expect(getStaffById(customer._id))
        .rejects
        .toThrow(USER_MESSAGES.USER_NOT_FOUND);
    });
  });

  describe('updateStaffProfile', () => {
    it('should update user fields', async () => {
      const user = await User.create(createMockUser({ role: 'staff' }));
      await StaffProfile.create(createMockStaffProfile(user._id));

      const result = await updateStaffProfile(user._id, {
        fullName: 'Updated Staff Name',
        phone: '0987654321',
      });

      expect(result.fullName).toBe('Updated Staff Name');
      expect(result.phone).toBe('0987654321');
    });

    it('should update profile position', async () => {
      const user = await User.create(createMockUser({ role: 'staff' }));
      await StaffProfile.create(createMockStaffProfile(user._id, { position: 'staff' }));

      // Valid positions are: 'staff', 'admin'
      await updateStaffProfile(user._id, { position: 'admin' });

      const profile = await StaffProfile.findOne({ userId: user._id });
      expect(profile.position).toBe('admin');
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        updateStaffProfile(generateObjectId(), { fullName: 'Test' })
      ).rejects.toThrow(USER_MESSAGES.USER_NOT_FOUND);
    });
  });

  describe('toggleStaffActive', () => {
    it('should deactivate staff', async () => {
      const user = await User.create(createMockUser({ role: 'staff', isActive: true }));
      await StaffProfile.create(createMockStaffProfile(user._id));

      const result = await toggleStaffActive(user._id, false);

      expect(result.isActive).toBe(false);

      const profile = await StaffProfile.findOne({ userId: user._id });
      expect(profile.isActive).toBe(false);
    });

    it('should activate staff', async () => {
      const user = await User.create(createMockUser({ role: 'staff', isActive: false }));
      await StaffProfile.create(createMockStaffProfile(user._id, { isActive: false }));

      const result = await toggleStaffActive(user._id, true);

      expect(result.isActive).toBe(true);
    });

    it('should throw error for non-existent user', async () => {
      await expect(toggleStaffActive(generateObjectId(), false))
        .rejects
        .toThrow(USER_MESSAGES.USER_NOT_FOUND);
    });

    it('should throw error for customer user', async () => {
      const customer = await User.create(createMockUser({ role: 'customer' }));

      await expect(toggleStaffActive(customer._id, false))
        .rejects
        .toThrow(USER_MESSAGES.USER_NOT_FOUND);
    });
  });
  // #endregion
});
