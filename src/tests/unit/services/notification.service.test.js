/**
 * Unit Tests for Notification Service
 * Tests notification functions in src/services/notification.service.js
 * 
 * Note: Tests are designed to work without jest.mock in ESM environment
 */

import mongoose from 'mongoose';
import Notification from '../../../models/Notification/notification.model.js';
import { User } from '../../../models/index.js';
import {
  createAndSendNotification,
  sendNotification,
  getNotifications,
  markAsRead,
  deleteNotification,
  deleteAllReadNotifications,
} from '../../../services/notification.service.js';
import { NOTIFICATION_TYPE } from '../../../utils/constants.js';
import { createMockUser, generateObjectId } from '../../mocks/factories.js';

// Note: Email services will execute normally in test environment

describe('Notification Service', () => {
  let testUser;

  beforeEach(async () => {
    testUser = await User.create(createMockUser());
  });

  // #region Create and Send Notification Tests
  describe('createAndSendNotification', () => {
    it('should be a function', () => {
      expect(typeof createAndSendNotification).toBe('function');
    });

    it('should create notification with valid data', async () => {
      const result = await createAndSendNotification(
        testUser._id,
        NOTIFICATION_TYPE.INFO,
        'Test Notification',
        'This is a test notification'
      );

      expect(result).toBeDefined();
      expect(result.userId.toString()).toBe(testUser._id.toString());
      expect(result.type).toBe(NOTIFICATION_TYPE.INFO);
    });

    it('should create notification with all required fields', async () => {
      const result = await createAndSendNotification(
        testUser._id,
        NOTIFICATION_TYPE.BOOKING,
        'Booking Notification',
        'Your booking has been confirmed'
      );

      expect(result.title).toBe('Booking Notification');
      expect(result.message).toBe('Your booking has been confirmed');
      expect(result.isRead).toBe(false);
    });

    it('should create notifications with different types', async () => {
      const types = [NOTIFICATION_TYPE.INFO, NOTIFICATION_TYPE.WARNING, NOTIFICATION_TYPE.SUCCESS];

      for (const type of types) {
        const result = await createAndSendNotification(
          testUser._id,
          type,
          'Type Test',
          'Testing ' + type
        );
        expect(result.type).toBe(type);
      }
    });
  });
  // #endregion

  // #region Get Notifications Tests
  describe('getNotifications', () => {
    it('should be a function', () => {
      expect(typeof getNotifications).toBe('function');
    });

    it('should return notifications for user', async () => {
      await createAndSendNotification(
        testUser._id,
        NOTIFICATION_TYPE.INFO,
        'Test 1',
        'Message 1'
      );
      await createAndSendNotification(
        testUser._id,
        NOTIFICATION_TYPE.INFO,
        'Test 2',
        'Message 2'
      );

      const result = await getNotifications(testUser._id);
      expect(result).toBeDefined();
      expect(result.notifications.length).toBeGreaterThanOrEqual(2);
    });

    it('should support pagination', async () => {
      const result = await getNotifications(testUser._id, { page: 1, limit: 5 });
      expect(result).toBeDefined();
      expect(result.pagination.page).toBe(1);
    });

    it('should return empty for user without notifications', async () => {
      const newUser = await User.create(createMockUser({
        email: 'new@test.com',
        username: 'newuser'
      }));
      const result = await getNotifications(newUser._id);
      expect(result.notifications).toHaveLength(0);
    });
  });
  // #endregion

  // #region Mark As Read Tests
  describe('markAsRead', () => {
    it('should be a function', () => {
      expect(typeof markAsRead).toBe('function');
    });

    it('should mark notification as read', async () => {
      const notification = await createAndSendNotification(
        testUser._id,
        NOTIFICATION_TYPE.INFO,
        'Test',
        'Test message'
      );

      const result = await markAsRead(notification._id, testUser._id);
      expect(result.isRead).toBe(true);
    });

    it('should throw error for non-existent notification', async () => {
      await expect(markAsRead(generateObjectId(), testUser._id))
        .rejects
        .toThrow();
    });
  });
  // #endregion

  // #region Delete Notification Tests
  describe('deleteNotification', () => {
    it('should be a function', () => {
      expect(typeof deleteNotification).toBe('function');
    });

    it('should delete notification', async () => {
      const notification = await createAndSendNotification(
        testUser._id,
        NOTIFICATION_TYPE.INFO,
        'Test',
        'Test message'
      );

      await deleteNotification(notification._id, testUser._id);
      
      const deleted = await Notification.findById(notification._id);
      expect(deleted.isDeleted).toBe(true);
    });
  });

  describe('deleteAllReadNotifications', () => {
    it('should be a function', () => {
      expect(typeof deleteAllReadNotifications).toBe('function');
    });

    it('should delete all read notifications for user', async () => {
      // Create and mark as read
      const n1 = await createAndSendNotification(testUser._id, NOTIFICATION_TYPE.INFO, 'Test 1', 'Msg 1');
      const n2 = await createAndSendNotification(testUser._id, NOTIFICATION_TYPE.INFO, 'Test 2', 'Msg 2');
      
      await markAsRead(n1._id, testUser._id);
      await markAsRead(n2._id, testUser._id);

      const result = await deleteAllReadNotifications(testUser._id);
      expect(result).toBeDefined();
    });
  });
  // #endregion

  // #region Notification Type Constants Tests
  describe('Notification Types', () => {
    it('should have correct notification type values', () => {
      expect(NOTIFICATION_TYPE.INFO).toBeDefined();
      expect(NOTIFICATION_TYPE.WARNING).toBeDefined();
      expect(NOTIFICATION_TYPE.SUCCESS).toBeDefined();
    });
  });
  // #endregion
});