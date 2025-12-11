/**
 * Unit Tests for Schedule Service
 * Tests schedule management functions in src/services/schedule.service.js
 */

import mongoose from 'mongoose';
import { Schedule } from '../../../models/index.js';
import Studio from '../../../models/Studio/studio.model.js';
import {
  createSchedule,
  getScheduleById,
  getSchedules,
  updateSchedule,
  markScheduleBooked,
  freeSchedule,
  deleteSchedule,
} from '../../../services/schedule.service.js';
import { SCHEDULE_STATUS } from '../../../utils/constants.js';
import { createMockStudio, createMockSchedule, generateObjectId } from '../../mocks/factories.js';

describe('Schedule Service', () => {
  let testStudio;

  beforeEach(async () => {
    testStudio = await Studio.create(createMockStudio());
  });

  // #region Create Schedule Tests
  describe('createSchedule', () => {
    it('should create schedule with valid data', async () => {
      const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours later

      const result = await createSchedule({
        studioId: testStudio._id,
        startTime,
        endTime,
      });

      expect(result).toBeDefined();
      expect(result.studioId.toString()).toBe(testStudio._id.toString());
      expect(result.status).toBe(SCHEDULE_STATUS.AVAILABLE);
    });

    it('should throw error for missing required fields', async () => {
      await expect(createSchedule({ studioId: testStudio._id }))
        .rejects
        .toThrow('ID studio, thời gian bắt đầu và thời gian kết thúc là bắt buộc');
    });

    it('should throw error for invalid start time', async () => {
      await expect(
        createSchedule({
          studioId: testStudio._id,
          startTime: 'invalid',
          endTime: new Date(),
        })
      ).rejects.toThrow('Thời gian bắt đầu không hợp lệ');
    });

    it('should throw error for invalid end time', async () => {
      await expect(
        createSchedule({
          studioId: testStudio._id,
          startTime: new Date(),
          endTime: 'invalid',
        })
      ).rejects.toThrow('Thời gian kết thúc không hợp lệ');
    });

    it('should throw error if end time before start time', async () => {
      const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() - 60 * 60 * 1000);

      await expect(
        createSchedule({
          studioId: testStudio._id,
          startTime,
          endTime,
        })
      ).rejects.toThrow('Thời gian kết thúc phải lớn hơn thời gian bắt đầu');
    });

    it('should throw error for start time in the past', async () => {
      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      const endTime = new Date(Date.now() + 2 * 60 * 60 * 1000);

      await expect(
        createSchedule({
          studioId: testStudio._id,
          startTime,
          endTime,
        })
      ).rejects.toThrow('Thời gian bắt đầu không được ở quá khứ');
    });

    it('should throw error for duration less than 1 hour', async () => {
      const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutes

      await expect(
        createSchedule({
          studioId: testStudio._id,
          startTime,
          endTime,
        })
      ).rejects.toThrow('Thời gian thuê tối thiểu là 1 giờ');
    });

    it('should throw error for overlapping schedules', async () => {
      const startTime1 = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const endTime1 = new Date(startTime1.getTime() + 2 * 60 * 60 * 1000);

      // Create first schedule
      await createSchedule({
        studioId: testStudio._id,
        startTime: startTime1,
        endTime: endTime1,
      });

      // Try to create overlapping schedule
      const startTime2 = new Date(startTime1.getTime() + 60 * 60 * 1000); // 1 hour into first
      const endTime2 = new Date(startTime2.getTime() + 2 * 60 * 60 * 1000);

      await expect(
        createSchedule({
          studioId: testStudio._id,
          startTime: startTime2,
          endTime: endTime2,
        })
      ).rejects.toThrow('Lịch bị trùng hoặc quá gần');
    });

    it('should throw error for schedules too close (less than 30 min gap)', async () => {
      const startTime1 = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const endTime1 = new Date(startTime1.getTime() + 2 * 60 * 60 * 1000);

      await createSchedule({
        studioId: testStudio._id,
        startTime: startTime1,
        endTime: endTime1,
      });

      // Try to create schedule 15 minutes after
      const startTime2 = new Date(endTime1.getTime() + 15 * 60 * 1000);
      const endTime2 = new Date(startTime2.getTime() + 2 * 60 * 60 * 1000);

      await expect(
        createSchedule({
          studioId: testStudio._id,
          startTime: startTime2,
          endTime: endTime2,
        })
      ).rejects.toThrow('Lịch bị trùng hoặc quá gần');
    });

    it('should allow schedules with 30+ minute gap', async () => {
      const startTime1 = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const endTime1 = new Date(startTime1.getTime() + 2 * 60 * 60 * 1000);

      await createSchedule({
        studioId: testStudio._id,
        startTime: startTime1,
        endTime: endTime1,
      });

      // Create schedule 30 minutes after
      const startTime2 = new Date(endTime1.getTime() + 30 * 60 * 1000);
      const endTime2 = new Date(startTime2.getTime() + 2 * 60 * 60 * 1000);

      const result = await createSchedule({
        studioId: testStudio._id,
        startTime: startTime2,
        endTime: endTime2,
      });

      expect(result).toBeDefined();
    });
  });
  // #endregion

  // #region Get Schedule Tests
  describe('getScheduleById', () => {
    it('should return schedule by id', async () => {
      const schedule = await Schedule.create({
        studioId: testStudio._id,
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
        status: SCHEDULE_STATUS.AVAILABLE,
      });

      const result = await getScheduleById(schedule._id);

      expect(result._id.toString()).toBe(schedule._id.toString());
    });

    it('should throw error for non-existent schedule', async () => {
      await expect(getScheduleById(generateObjectId()))
        .rejects
        .toThrow('Lịch không tồn tại');
    });

    it('should throw error for missing id', async () => {
      await expect(getScheduleById(null))
        .rejects
        .toThrow('ID lịch là bắt buộc');
    });
  });

  describe('getSchedules', () => {
    beforeEach(async () => {
      await Schedule.create([
        {
          studioId: testStudio._id,
          startTime: new Date('2025-12-20T10:00:00Z'),
          endTime: new Date('2025-12-20T12:00:00Z'),
          status: SCHEDULE_STATUS.AVAILABLE,
        },
        {
          studioId: testStudio._id,
          startTime: new Date('2025-12-20T14:00:00Z'),
          endTime: new Date('2025-12-20T16:00:00Z'),
          status: SCHEDULE_STATUS.BOOKED,
        },
        {
          studioId: testStudio._id,
          startTime: new Date('2025-12-21T10:00:00Z'),
          endTime: new Date('2025-12-21T12:00:00Z'),
          status: SCHEDULE_STATUS.CANCELLED,
        },
      ]);
    });

    it('should return paginated schedules', async () => {
      const result = await getSchedules({ page: 1, limit: 10 });

      expect(result.items).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should filter by studioId', async () => {
      const otherStudio = await Studio.create(createMockStudio({ name: 'Other Studio' }));
      await Schedule.create({
        studioId: otherStudio._id,
        startTime: new Date('2025-12-22T10:00:00Z'),
        endTime: new Date('2025-12-22T12:00:00Z'),
        status: SCHEDULE_STATUS.AVAILABLE,
      });

      const result = await getSchedules({ studioId: testStudio._id });

      expect(result.items).toHaveLength(3);
      expect(result.items.every(s => s.studioId.toString() === testStudio._id.toString())).toBe(true);
    });

    it('should filter by status', async () => {
      const result = await getSchedules({ status: SCHEDULE_STATUS.AVAILABLE });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe(SCHEDULE_STATUS.AVAILABLE);
    });

    it('should handle pagination', async () => {
      const page1 = await getSchedules({ page: 1, limit: 2 });
      const page2 = await getSchedules({ page: 2, limit: 2 });

      expect(page1.items).toHaveLength(2);
      expect(page2.items).toHaveLength(1);
    });

    it('should sort by startTime ascending', async () => {
      const result = await getSchedules({});

      for (let i = 1; i < result.items.length; i++) {
        expect(new Date(result.items[i].startTime) >= new Date(result.items[i - 1].startTime)).toBe(true);
      }
    });
  });
  // #endregion

  // #region Update Schedule Tests
  describe('updateSchedule', () => {
    it('should update schedule times', async () => {
      const schedule = await Schedule.create({
        studioId: testStudio._id,
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
        status: SCHEDULE_STATUS.AVAILABLE,
      });

      const newStartTime = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const newEndTime = new Date(newStartTime.getTime() + 3 * 60 * 60 * 1000);

      const result = await updateSchedule(schedule._id, {
        startTime: newStartTime,
        endTime: newEndTime,
      });

      expect(new Date(result.startTime).getTime()).toBe(newStartTime.getTime());
      expect(new Date(result.endTime).getTime()).toBe(newEndTime.getTime());
    });

    it('should throw error for non-existent schedule', async () => {
      await expect(
        updateSchedule(generateObjectId(), { status: SCHEDULE_STATUS.BOOKED })
      ).rejects.toThrow('Lịch không tồn tại');
    });
  });
  // #endregion

  // #region Schedule Status Tests
  describe('markScheduleBooked', () => {
    it('should mark schedule as booked', async () => {
      const schedule = await Schedule.create({
        studioId: testStudio._id,
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
        status: SCHEDULE_STATUS.AVAILABLE,
      });

      const bookingId = generateObjectId();
      const result = await markScheduleBooked(schedule._id, bookingId);

      expect(result.status).toBe(SCHEDULE_STATUS.BOOKED);
      expect(result.bookingId.toString()).toBe(bookingId.toString());
    });

    it('should throw error for non-existent schedule', async () => {
      await expect(markScheduleBooked(generateObjectId(), generateObjectId()))
        .rejects
        .toThrow();
    });
  });

  describe('freeSchedule', () => {
    it('should free booked schedule', async () => {
      const schedule = await Schedule.create({
        studioId: testStudio._id,
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
        status: SCHEDULE_STATUS.BOOKED,
        bookingId: generateObjectId(),
      });

      const result = await freeSchedule(schedule._id);

      expect(result.status).toBe(SCHEDULE_STATUS.AVAILABLE);
      expect(result.bookingId).toBeNull();
    });
  });

  describe('deleteSchedule', () => {
    it('should delete available schedule', async () => {
      const schedule = await Schedule.create({
        studioId: testStudio._id,
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
        status: SCHEDULE_STATUS.AVAILABLE,
      });

      const result = await deleteSchedule(schedule._id);

      // Service may return message object or just the deleted schedule
      expect(result).toBeDefined();

      const deleted = await Schedule.findById(schedule._id);
      expect(deleted).toBeNull();
    });

    it('should throw error for non-existent schedule', async () => {
      await expect(deleteSchedule(generateObjectId()))
        .rejects
        .toThrow();
    });
  });
  // #endregion
});
