/**
 * Unit Tests for Studio Service
 * Tests all studio management functions in src/services/studio.service.js
 * 
 * Note: Tests are designed to work without jest.mock in ESM environment
 */

import mongoose from 'mongoose';
import Studio from '../../../models/Studio/studio.model.js';
import { Schedule } from '../../../models/index.js';
import {
  getAllStudios,
  getStudioById,
  createStudio,
  updateStudio,
  addStudioImages,
  changeStudioStatus,
  deleteStudio,
  getActiveStudios,
  getStudioSchedule,
} from '../../../services/studio.service.js';
import { STUDIO_STATUS, SCHEDULE_STATUS } from '../../../utils/constants.js';
import { createMockStudio, createMockSchedule, generateObjectId } from '../../mocks/factories.js';

// Note: Cache and notification services will execute normally in test environment

describe('Studio Service', () => {
  // #region Get Studios Tests
  describe('getAllStudios', () => {
    beforeEach(async () => {
      await Studio.create([
        createMockStudio({ name: 'Studio A', status: STUDIO_STATUS.ACTIVE }),
        createMockStudio({ name: 'Studio B', status: STUDIO_STATUS.ACTIVE }),
        createMockStudio({ name: 'Studio C', status: STUDIO_STATUS.INACTIVE }),
        createMockStudio({ name: 'Photo Studio', status: STUDIO_STATUS.MAINTENANCE }),
      ]);
    });

    it('should return paginated list of studios', async () => {
      const result = await getAllStudios({ page: 1, limit: 10 });

      expect(result.studios).toHaveLength(4);
      expect(result.pagination.total).toBe(4);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should filter by status', async () => {
      const result = await getAllStudios({ status: STUDIO_STATUS.ACTIVE });

      expect(result.studios).toHaveLength(2);
      expect(result.studios.every(s => s.status === STUDIO_STATUS.ACTIVE)).toBe(true);
    });

    it('should search by name or description', async () => {
      const result = await getAllStudios({ search: 'Photo' });

      expect(result.studios).toHaveLength(1);
      expect(result.studios[0].name).toBe('Photo Studio');
    });

    it('should handle pagination correctly', async () => {
      const page1 = await getAllStudios({ page: 1, limit: 2 });
      const page2 = await getAllStudios({ page: 2, limit: 2 });

      expect(page1.studios).toHaveLength(2);
      expect(page2.studios).toHaveLength(2);
      expect(page1.pagination.totalPages).toBe(2);
    });

    it('should sort studios', async () => {
      const ascResult = await getAllStudios({ sortBy: 'name', sortOrder: 'asc' });
      const descResult = await getAllStudios({ sortBy: 'name', sortOrder: 'desc' });

      expect(ascResult.studios[0].name).toBe('Photo Studio');
      expect(descResult.studios[0].name).toBe('Studio C');
    });

    it('should sanitize pagination params', async () => {
      const result = await getAllStudios({ page: -1, limit: 1000 });

      expect(result.pagination.page).toBe(1);
      expect(result.studios.length).toBeLessThanOrEqual(100);
    });

    it('should escape regex in search', async () => {
      // Create studio with special characters
      await Studio.create(createMockStudio({ name: 'Test.Studio[1]' }));

      const result = await getAllStudios({ search: 'Test.Studio[1]' });

      expect(result.studios).toHaveLength(1);
    });
  });

  describe('getStudioById', () => {
    it('should return studio by id', async () => {
      const studio = await Studio.create(createMockStudio());

      const result = await getStudioById(studio._id);

      expect(result._id.toString()).toBe(studio._id.toString());
      expect(result.name).toBe(studio.name);
    });

    it('should throw error for non-existent studio', async () => {
      await expect(getStudioById(generateObjectId()))
        .rejects
        .toThrow('Studio không tồn tại!');
    });

    // Note: Cache testing would require complex ESM mocking setup
    // Cache behavior is better tested through integration tests
  });

  describe('getActiveStudios', () => {
    beforeEach(async () => {
      await Studio.create([
        createMockStudio({ name: 'Active 1', status: STUDIO_STATUS.ACTIVE }),
        createMockStudio({ name: 'Active 2', status: STUDIO_STATUS.ACTIVE }),
        createMockStudio({ name: 'Inactive', status: STUDIO_STATUS.INACTIVE }),
      ]);
    });

    it('should return only active studios', async () => {
      const result = await getActiveStudios({});

      expect(result.studios).toHaveLength(2);
      expect(result.studios.every(s => s.status === STUDIO_STATUS.ACTIVE)).toBe(true);
    });

    it('should support search within active studios', async () => {
      const result = await getActiveStudios({ search: 'Active 1' });

      expect(result.studios).toHaveLength(1);
      expect(result.studios[0].name).toBe('Active 1');
    });
  });
  // #endregion

  // #region Create & Update Studios Tests
  describe('createStudio', () => {
    it('should create studio with valid data', async () => {
      const studioData = {
        name: 'New Studio',
        description: 'A new beautiful studio',
        area: 150,
        location: '123 Studio Street',
        basePricePerHour: 750000,
        capacity: 15,
        images: ['https://example.com/image1.jpg'],
      };

      const result = await createStudio(studioData);

      expect(result).toBeDefined();
      expect(result.name).toBe(studioData.name);
      expect(result.basePricePerHour).toBe(studioData.basePricePerHour);
      expect(result.status).toBe(STUDIO_STATUS.ACTIVE);
    });

    it('should throw error for missing required fields', async () => {
      await expect(createStudio({ name: 'Test' }))
        .rejects
        .toThrow('Thiếu thông tin bắt buộc');
    });

    it('should throw error for negative price', async () => {
      await expect(
        createStudio({
          name: 'Test',
          description: 'Test',
          area: 100,
          location: 'Test',
          basePricePerHour: -100,
          capacity: 10,
        })
      ).rejects.toThrow('Giá thuê phải lớn hơn hoặc bằng 0');
    });

    it('should throw error for zero capacity', async () => {
      await expect(
        createStudio({
          name: 'Test',
          description: 'Test',
          area: 100,
          location: 'Test',
          basePricePerHour: 100000,
          capacity: 0,
        })
      ).rejects.toThrow(); // capacity: 0 is falsy, so validation fails
    });

    it('should throw error for negative area', async () => {
      await expect(
        createStudio({
          name: 'Test',
          description: 'Test',
          area: -10,
          location: 'Test',
          basePricePerHour: 100000,
          capacity: 10,
        })
      ).rejects.toThrow('Diện tích phải lớn hơn hoặc bằng 0');
    });
  });

  describe('updateStudio', () => {
    it('should update studio fields', async () => {
      const studio = await Studio.create(createMockStudio());

      const result = await updateStudio(studio._id, {
        name: 'Updated Studio Name',
        basePricePerHour: 800000,
      });

      expect(result.name).toBe('Updated Studio Name');
      expect(result.basePricePerHour).toBe(800000);
    });

    it('should throw error for non-existent studio', async () => {
      await expect(
        updateStudio(generateObjectId(), { name: 'Test' })
      ).rejects.toThrow('Studio không tồn tại!');
    });

    it('should throw error for negative price', async () => {
      const studio = await Studio.create(createMockStudio());

      await expect(
        updateStudio(studio._id, { basePricePerHour: -100 })
      ).rejects.toThrow('Giá thuê phải lớn hơn hoặc bằng 0');
    });

    it('should throw error for zero capacity', async () => {
      const studio = await Studio.create(createMockStudio());

      await expect(
        updateStudio(studio._id, { capacity: 0 })
      ).rejects.toThrow('Sức chứa phải lớn hơn 0');
    });

    it('should not update disallowed fields', async () => {
      const studio = await Studio.create(createMockStudio({ status: STUDIO_STATUS.ACTIVE }));

      const result = await updateStudio(studio._id, { 
        name: 'Updated',
        status: STUDIO_STATUS.INACTIVE, // Should not be updated through this method
      });

      expect(result.name).toBe('Updated');
      expect(result.status).toBe(STUDIO_STATUS.ACTIVE);
    });
  });

  describe('addStudioImages', () => {
    it('should add images to studio', async () => {
      const studio = await Studio.create(createMockStudio({ images: ['original.jpg'] }));

      const result = await addStudioImages(studio._id, ['new1.jpg', 'new2.jpg']);

      expect(result.images).toHaveLength(3);
      expect(result.images).toContain('original.jpg');
      expect(result.images).toContain('new1.jpg');
      expect(result.images).toContain('new2.jpg');
    });

    it('should throw error for non-existent studio', async () => {
      await expect(
        addStudioImages(generateObjectId(), ['image.jpg'])
      ).rejects.toThrow('Studio không tồn tại!');
    });

    it('should throw error for empty images array', async () => {
      const studio = await Studio.create(createMockStudio());

      await expect(addStudioImages(studio._id, []))
        .rejects
        .toThrow('Không có ảnh nào để thêm');
    });

    it('should throw error for invalid image URLs', async () => {
      const studio = await Studio.create(createMockStudio());

      await expect(addStudioImages(studio._id, ['valid.jpg', '', '  ']))
        .rejects
        .toThrow('URL ảnh không hợp lệ');
    });
  });
  // #endregion

  // #region Status & Delete Tests
  describe('changeStudioStatus', () => {
    it('should change studio status', async () => {
      const studio = await Studio.create(createMockStudio({ status: STUDIO_STATUS.ACTIVE }));

      const result = await changeStudioStatus(studio._id, STUDIO_STATUS.MAINTENANCE);

      expect(result.status).toBe(STUDIO_STATUS.MAINTENANCE);
    });

    it('should throw error for non-existent studio', async () => {
      await expect(
        changeStudioStatus(generateObjectId(), STUDIO_STATUS.ACTIVE)
      ).rejects.toThrow('Studio không tồn tại!');
    });

    it('should throw error for invalid status', async () => {
      const studio = await Studio.create(createMockStudio());

      await expect(changeStudioStatus(studio._id, 'invalid_status'))
        .rejects
        .toThrow('Status không hợp lệ!');
    });

    it('should throw error for missing status', async () => {
      const studio = await Studio.create(createMockStudio());

      await expect(changeStudioStatus(studio._id, null))
        .rejects
        .toThrow('Trạng thái mới là bắt buộc');
    });
  });

  describe('deleteStudio', () => {
    it('should delete studio without future bookings', async () => {
      const studio = await Studio.create(createMockStudio());

      const result = await deleteStudio(studio._id);

      expect(result.message).toBe('Xóa studio thành công!');

      const deletedStudio = await Studio.findById(studio._id);
      expect(deletedStudio).toBeNull();
    });

    it('should throw error for non-existent studio', async () => {
      await expect(deleteStudio(generateObjectId()))
        .rejects
        .toThrow('Studio không tồn tại!');
    });

    it('should throw error if studio has future bookings', async () => {
      const studio = await Studio.create(createMockStudio());
      await Schedule.create({
        studioId: studio._id,
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        endTime: new Date(Date.now() + 25 * 60 * 60 * 1000),
        status: SCHEDULE_STATUS.BOOKED,
      });

      await expect(deleteStudio(studio._id))
        .rejects
        .toThrow('Không thể xóa studio đang có lịch đặt trong tương lai!');
    });
  });
  // #endregion

  // #region Schedule Tests
  describe('getStudioSchedule', () => {
    it('should return studio schedule grouped by date', async () => {
      const studio = await Studio.create(createMockStudio());
      await Schedule.create([
        {
          studioId: studio._id,
          startTime: new Date('2025-12-15T10:00:00Z'),
          endTime: new Date('2025-12-15T12:00:00Z'),
          status: SCHEDULE_STATUS.BOOKED,
        },
        {
          studioId: studio._id,
          startTime: new Date('2025-12-15T14:00:00Z'),
          endTime: new Date('2025-12-15T16:00:00Z'),
          status: SCHEDULE_STATUS.BOOKED,
        },
      ]);

      const result = await getStudioSchedule(studio._id);

      expect(result.studio._id.toString()).toBe(studio._id.toString());
      expect(result.totalSchedules).toBe(2);
      expect(result.scheduleByDate['2025-12-15']).toHaveLength(2);
    });

    it('should throw error for non-existent studio', async () => {
      await expect(getStudioSchedule(generateObjectId()))
        .rejects
        .toThrow('Studio không tồn tại!');
    });

    it('should filter by date range', async () => {
      const studio = await Studio.create(createMockStudio());
      await Schedule.create([
        {
          studioId: studio._id,
          startTime: new Date('2025-12-10T10:00:00Z'),
          endTime: new Date('2025-12-10T12:00:00Z'),
          status: SCHEDULE_STATUS.BOOKED,
        },
        {
          studioId: studio._id,
          startTime: new Date('2025-12-20T10:00:00Z'),
          endTime: new Date('2025-12-20T12:00:00Z'),
          status: SCHEDULE_STATUS.BOOKED,
        },
      ]);

      const result = await getStudioSchedule(studio._id, {
        startDate: new Date('2025-12-15'),
        endDate: new Date('2025-12-25'),
      });

      expect(result.totalSchedules).toBe(1);
    });

    it('should return empty schedule for studio without bookings', async () => {
      const studio = await Studio.create(createMockStudio());

      const result = await getStudioSchedule(studio._id);

      expect(result.totalSchedules).toBe(0);
      expect(Object.keys(result.scheduleByDate)).toHaveLength(0);
    });
  });
  // #endregion
});
