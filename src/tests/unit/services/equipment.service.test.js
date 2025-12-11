/**
 * Unit Tests for Equipment Service
 * Tests equipment management functions in src/services/equipment.service.js
 * 
 * Note: Tests are designed to work without jest.mock in ESM environment
 */

import mongoose from 'mongoose';
import Equipment from '../../../models/Equipment/equipment.model.js';
import {
  getAllEquipment,
  getEquipmentById,
  getAvailableEquipment,
  createEquipment,
  updateEquipment,
  reserveEquipment,
  releaseEquipment,
  deleteEquipment,
} from '../../../services/equipment.service.js';
import { EQUIPMENT_STATUS } from '../../../utils/constants.js';
import { createMockEquipment, generateObjectId } from '../../mocks/factories.js';

// Note: External notification services will execute normally in test environment

describe('Equipment Service', () => {
  // #region Get Equipment Tests
  describe('getAllEquipment', () => {
    beforeEach(async () => {
      await Equipment.create([
        {
          name: 'Camera A',
          description: 'Professional camera',
          pricePerHour: 100000,
          totalQty: 5,
          availableQty: 5,
          inUseQty: 0,
          maintenanceQty: 0,
          status: EQUIPMENT_STATUS.AVAILABLE,
        },
        {
          name: 'Light B',
          description: 'Studio light',
          pricePerHour: 50000,
          totalQty: 10,
          availableQty: 8,
          inUseQty: 2,
          maintenanceQty: 0,
          status: EQUIPMENT_STATUS.IN_USE,
        },
        {
          name: 'Tripod C',
          description: 'Camera tripod',
          pricePerHour: 30000,
          totalQty: 3,
          availableQty: 0,
          inUseQty: 0,
          maintenanceQty: 3,
          status: EQUIPMENT_STATUS.MAINTENANCE,
        },
      ]);
    });

    it('should return paginated list of equipment', async () => {
      const result = await getAllEquipment({ page: 1, limit: 10 });

      expect(result.equipment).toHaveLength(3);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter by status', async () => {
      const result = await getAllEquipment({ status: EQUIPMENT_STATUS.AVAILABLE });

      expect(result.equipment).toHaveLength(1);
      expect(result.equipment[0].name).toBe('Camera A');
    });

    it('should search by name', async () => {
      // Note: search matches both name and description
      // 'Camera' matches 'Camera A' name and 'Camera tripod' description
      const result = await getAllEquipment({ search: 'Camera' });

      expect(result.equipment).toHaveLength(2);
      expect(result.equipment.some(e => e.name === 'Camera A')).toBe(true);
    });

    it('should search by description', async () => {
      const result = await getAllEquipment({ search: 'tripod' });

      expect(result.equipment).toHaveLength(1);
      expect(result.equipment[0].name).toBe('Tripod C');
    });

    it('should handle pagination', async () => {
      const page1 = await getAllEquipment({ page: 1, limit: 2 });
      const page2 = await getAllEquipment({ page: 2, limit: 2 });

      expect(page1.equipment).toHaveLength(2);
      expect(page2.equipment).toHaveLength(1);
    });

    it('should sort equipment', async () => {
      const ascResult = await getAllEquipment({ sortBy: 'name', sortOrder: 'asc' });

      expect(ascResult.equipment[0].name).toBe('Camera A');
      expect(ascResult.equipment[2].name).toBe('Tripod C');
    });

    it('should exclude deleted equipment', async () => {
      await Equipment.create({
        name: 'Deleted Equipment',
        pricePerHour: 10000,
        totalQty: 1,
        availableQty: 1,
        inUseQty: 0,
        maintenanceQty: 0,
        isDeleted: true,
      });

      const result = await getAllEquipment({});

      expect(result.equipment.every(e => e.isDeleted !== true)).toBe(true);
    });
  });

  describe('getEquipmentById', () => {
    it('should return equipment by id', async () => {
      const equipment = await Equipment.create({
        name: 'Test Equipment',
        pricePerHour: 50000,
        totalQty: 3,
        availableQty: 3,
        inUseQty: 0,
        maintenanceQty: 0,
      });

      const result = await getEquipmentById(equipment._id);

      expect(result._id.toString()).toBe(equipment._id.toString());
      expect(result.name).toBe('Test Equipment');
    });

    it('should throw error for non-existent equipment', async () => {
      await expect(getEquipmentById(generateObjectId()))
        .rejects
        .toThrow('Equipment không tồn tại!');
    });

    it('should throw error for deleted equipment', async () => {
      const equipment = await Equipment.create({
        name: 'Deleted Equipment',
        pricePerHour: 50000,
        totalQty: 3,
        availableQty: 3,
        inUseQty: 0,
        maintenanceQty: 0,
        isDeleted: true,
      });

      await expect(getEquipmentById(equipment._id))
        .rejects
        .toThrow('Equipment không tồn tại!');
    });
  });

  describe('getAvailableEquipment', () => {
    it('should return only available equipment with stock', async () => {
      await Equipment.create([
        {
          name: 'Available Equipment',
          pricePerHour: 50000,
          totalQty: 5,
          availableQty: 5,
          inUseQty: 0,
          maintenanceQty: 0,
          status: EQUIPMENT_STATUS.AVAILABLE,
        },
        {
          name: 'Out of Stock',
          pricePerHour: 50000,
          totalQty: 2,
          availableQty: 0,
          inUseQty: 2,
          maintenanceQty: 0,
          status: EQUIPMENT_STATUS.IN_USE,
        },
        {
          name: 'In Maintenance',
          pricePerHour: 50000,
          totalQty: 3,
          availableQty: 0,
          inUseQty: 0,
          maintenanceQty: 3,
          status: EQUIPMENT_STATUS.MAINTENANCE,
        },
      ]);

      const result = await getAvailableEquipment();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Available Equipment');
    });
  });
  // #endregion

  // #region Create Equipment Tests
  describe('createEquipment', () => {
    it('should create equipment with valid data', async () => {
      const equipmentData = {
        name: 'New Camera',
        description: 'Brand new camera',
        pricePerHour: 150000,
        totalQty: 10,
        image: 'https://example.com/camera.jpg',
      };

      const result = await createEquipment(equipmentData);

      expect(result).toBeDefined();
      expect(result.name).toBe(equipmentData.name);
      expect(result.totalQty).toBe(10);
      expect(result.availableQty).toBe(10);
      expect(result.inUseQty).toBe(0);
      expect(result.maintenanceQty).toBe(0);
      expect(result.status).toBe(EQUIPMENT_STATUS.AVAILABLE);
    });

    it('should throw error for missing required fields', async () => {
      await expect(createEquipment({ name: 'Test' }))
        .rejects
        .toThrow('Vui lòng điền đầy đủ thông tin bắt buộc');
    });

    it('should throw error for negative price', async () => {
      await expect(
        createEquipment({
          name: 'Test',
          pricePerHour: -100,
          totalQty: 5,
        })
      ).rejects.toThrow('Giá thuê phải >= 0!');
    });

    it('should throw error for negative quantity', async () => {
      await expect(
        createEquipment({
          name: 'Test',
          pricePerHour: 100,
          totalQty: -5,
        })
      ).rejects.toThrow('Số lượng phải >= 0!');
    });

    it('should allow duplicate name (no unique constraint)', async () => {
      await Equipment.create({
        name: 'Existing Equipment',
        pricePerHour: 50000,
        totalQty: 5,
        availableQty: 5,
        inUseQty: 0,
        maintenanceQty: 0,
      });

      // Service does not check for duplicate names
      const result = await createEquipment({
        name: 'Existing Equipment',
        pricePerHour: 60000,
        totalQty: 3,
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Existing Equipment');
    });
  });
  // #endregion

  // #region Update Equipment Tests
  describe('updateEquipment', () => {
    it('should update equipment fields', async () => {
      const equipment = await Equipment.create({
        name: 'Original Name',
        description: 'Original description',
        pricePerHour: 50000,
        totalQty: 5,
        availableQty: 5,
        inUseQty: 0,
        maintenanceQty: 0,
      });

      const result = await updateEquipment(equipment._id, {
        name: 'Updated Name',
        pricePerHour: 75000,
      });

      expect(result.name).toBe('Updated Name');
      expect(result.pricePerHour).toBe(75000);
    });

    it('should throw error for non-existent equipment', async () => {
      await expect(
        updateEquipment(generateObjectId(), { name: 'Test' })
      ).rejects.toThrow('Equipment không tồn tại!');
    });

    it('should throw error for negative price', async () => {
      const equipment = await Equipment.create({
        name: 'Test',
        pricePerHour: 50000,
        totalQty: 5,
        availableQty: 5,
        inUseQty: 0,
        maintenanceQty: 0,
      });

      await expect(
        updateEquipment(equipment._id, { pricePerHour: -100 })
      ).rejects.toThrow('Giá thuê phải >= 0!');
    });
  });
  // #endregion

  // #region Reserve/Release Equipment Tests
  describe('reserveEquipment', () => {
    it('should reserve available equipment', async () => {
      const equipment = await Equipment.create({
        name: 'Test Equipment',
        pricePerHour: 50000,
        totalQty: 5,
        availableQty: 5,
        inUseQty: 0,
        maintenanceQty: 0,
        status: EQUIPMENT_STATUS.AVAILABLE,
      });

      const result = await reserveEquipment(equipment._id, 2);

      expect(result.availableQty).toBe(3);
      expect(result.inUseQty).toBe(2);
      expect(result.status).toBe(EQUIPMENT_STATUS.IN_USE);
    });

    it('should throw error if not enough quantity', async () => {
      const equipment = await Equipment.create({
        name: 'Test Equipment',
        pricePerHour: 50000,
        totalQty: 5,
        availableQty: 2,
        inUseQty: 3,
        maintenanceQty: 0,
        status: EQUIPMENT_STATUS.IN_USE,
      });

      await expect(reserveEquipment(equipment._id, 5))
        .rejects
        .toThrow();
    });
  });

  describe('releaseEquipment', () => {
    it('should release reserved equipment', async () => {
      const equipment = await Equipment.create({
        name: 'Test Equipment',
        pricePerHour: 50000,
        totalQty: 5,
        availableQty: 3,
        inUseQty: 2,
        maintenanceQty: 0,
        status: EQUIPMENT_STATUS.IN_USE,
      });

      const result = await releaseEquipment(equipment._id, 2);

      expect(result.availableQty).toBe(5);
      expect(result.inUseQty).toBe(0);
      expect(result.status).toBe(EQUIPMENT_STATUS.AVAILABLE);
    });

    it('should throw error for non-existent equipment', async () => {
      await expect(releaseEquipment(generateObjectId(), 1))
        .rejects
        .toThrow();
    });
  });
  // #endregion

  // #region Delete Equipment Tests
  describe('deleteEquipment', () => {
    it('should soft delete equipment', async () => {
      const equipment = await Equipment.create({
        name: 'To Be Deleted',
        pricePerHour: 50000,
        totalQty: 5,
        availableQty: 5,
        inUseQty: 0,
        maintenanceQty: 0,
      });

      const result = await deleteEquipment(equipment._id);

      expect(result.message).toBeDefined();

      const deletedEquipment = await Equipment.findById(equipment._id);
      expect(deletedEquipment.isDeleted).toBe(true);
    });

    it('should throw error for non-existent equipment', async () => {
      await expect(deleteEquipment(generateObjectId()))
        .rejects
        .toThrow('Equipment không tồn tại!');
    });

    it('should soft delete equipment even when in use', async () => {
      // Note: Service does not prevent deletion of in-use equipment
      // It only does soft delete (marks isDeleted=true)
      const equipment = await Equipment.create({
        name: 'In Use Equipment',
        pricePerHour: 50000,
        totalQty: 5,
        availableQty: 3,
        inUseQty: 2,
        maintenanceQty: 0,
        status: EQUIPMENT_STATUS.IN_USE,
      });

      const result = await deleteEquipment(equipment._id);
      expect(result.message).toBeDefined();

      const deletedEquipment = await Equipment.findById(equipment._id);
      expect(deletedEquipment.isDeleted).toBe(true);
    });
  });
  // #endregion
});
