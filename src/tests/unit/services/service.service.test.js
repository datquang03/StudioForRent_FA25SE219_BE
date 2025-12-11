/**
 * Unit Tests for Service Service
 * Tests service functions in src/services/service.service.js
 */

import mongoose from 'mongoose';
import Service from '../../../models/Service/service.model.js';
import BookingDetail from '../../../models/Booking/bookingDetail.model.js';
import {
  getAllServices,
  getAvailableServices,
  getAvailableServiceDetail,
  getServiceById,
  createService,
  updateService,
  deleteService,
} from '../../../services/service.service.js';
import { SERVICE_STATUS } from '../../../utils/constants.js';
import { ValidationError, NotFoundError } from '../../../utils/errors.js';
import { generateObjectId } from '../../mocks/factories.js';

describe('Service Service', () => {
  // #region Get All Services Tests
  describe('getAllServices', () => {
    beforeEach(async () => {
      await Service.create([
        { name: 'Photo Editing', description: 'Professional editing', pricePerUse: 100000, status: SERVICE_STATUS.ACTIVE },
        { name: 'Video Production', description: 'Video services', pricePerUse: 500000, status: SERVICE_STATUS.ACTIVE },
        { name: 'Makeup Service', description: 'Makeup for shoots', pricePerUse: 300000, status: SERVICE_STATUS.INACTIVE },
        { name: 'Lighting Setup', description: 'Professional lighting', pricePerUse: 200000, status: SERVICE_STATUS.ACTIVE },
        { name: 'Props Rental', description: 'Various props', pricePerUse: 50000, status: SERVICE_STATUS.ACTIVE },
      ]);
    });

    it('should return all services with pagination', async () => {
      const result = await getAllServices({ page: 1, limit: 10 });

      expect(result.services).toHaveLength(5);
      expect(result.pagination.total).toBe(5);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    it('should paginate services correctly', async () => {
      const page1 = await getAllServices({ page: 1, limit: 2 });
      const page2 = await getAllServices({ page: 2, limit: 2 });

      expect(page1.services).toHaveLength(2);
      expect(page2.services).toHaveLength(2);
    });

    it('should search by name', async () => {
      const result = await getAllServices({ search: 'Photo' });

      expect(result.services).toHaveLength(1);
      expect(result.services[0].name).toBe('Photo Editing');
    });

    it('should search by description', async () => {
      const result = await getAllServices({ search: 'Professional' });

      expect(result.services).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const result = await getAllServices({ status: SERVICE_STATUS.INACTIVE });

      expect(result.services).toHaveLength(1);
      expect(result.services[0].name).toBe('Makeup Service');
    });

    it('should combine search and status filter', async () => {
      const result = await getAllServices({ 
        search: 'service', 
        status: SERVICE_STATUS.ACTIVE 
      });

      // Only active services matching "service" in name or description
      expect(result.services.every(s => s.status === SERVICE_STATUS.ACTIVE)).toBe(true);
    });

    it('should handle invalid page number', async () => {
      const result = await getAllServices({ page: -1 });

      expect(result.pagination.page).toBe(1);
    });

    it('should limit max results', async () => {
      const result = await getAllServices({ limit: 1000 });

      expect(result.pagination.limit).toBeLessThanOrEqual(100);
    });

    it('should sort by createdAt descending', async () => {
      const result = await getAllServices({});

      for (let i = 1; i < result.services.length; i++) {
        expect(new Date(result.services[i].createdAt) <= new Date(result.services[i - 1].createdAt)).toBe(true);
      }
    });
  });
  // #endregion

  // #region Get Available Services Tests
  describe('getAvailableServices', () => {
    beforeEach(async () => {
      await Service.create([
        { name: 'Active Service', pricePerUse: 100000, status: SERVICE_STATUS.ACTIVE, isAvailable: true },
        { name: 'Inactive Service', pricePerUse: 200000, status: SERVICE_STATUS.INACTIVE, isAvailable: false },
        { name: 'Active Unavailable', pricePerUse: 300000, status: SERVICE_STATUS.INACTIVE, isAvailable: false },
      ]);
    });

    it('should return only active and available services', async () => {
      const result = await getAvailableServices();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Active Service');
    });

    it('should return limited fields', async () => {
      const result = await getAvailableServices();

      expect(result[0].name).toBeDefined();
      expect(result[0].description).toBeDefined();
      expect(result[0].pricePerUse).toBeDefined();
      expect(result[0].status).toBeUndefined();
    });

    it('should sort by name ascending', async () => {
      await Service.create({ 
        name: 'AAA Service', 
        pricePerUse: 50000, 
        status: SERVICE_STATUS.ACTIVE, 
        isAvailable: true 
      });

      const result = await getAvailableServices();

      expect(result[0].name).toBe('AAA Service');
    });
  });
  // #endregion

  // #region Get Available Service Detail Tests
  describe('getAvailableServiceDetail', () => {
    it('should return service detail', async () => {
      const service = await Service.create({
        name: 'Test Service',
        description: 'Test description',
        pricePerUse: 100000,
        status: SERVICE_STATUS.ACTIVE,
        isAvailable: true,
      });

      const result = await getAvailableServiceDetail(service._id);

      expect(result.name).toBe('Test Service');
      expect(result.description).toBe('Test description');
    });

    it('should throw error for inactive service', async () => {
      const service = await Service.create({
        name: 'Inactive',
        pricePerUse: 100000,
        status: SERVICE_STATUS.INACTIVE,
        isAvailable: true,
      });

      await expect(getAvailableServiceDetail(service._id))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should throw error for unavailable service', async () => {
      // Note: pre-save hook sets isAvailable=true when status=ACTIVE
      // So we test with INACTIVE status which keeps isAvailable=false
      const service = await Service.create({
        name: 'Unavailable',
        pricePerUse: 100000,
        status: SERVICE_STATUS.INACTIVE,
        isAvailable: false,
      });

      await expect(getAvailableServiceDetail(service._id))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should throw error for non-existent service', async () => {
      await expect(getAvailableServiceDetail(generateObjectId()))
        .rejects
        .toThrow(NotFoundError);
    });
  });
  // #endregion

  // #region Get Service By ID Tests
  describe('getServiceById', () => {
    it('should return service by id', async () => {
      const service = await Service.create({
        name: 'Test Service',
        pricePerUse: 100000,
        status: SERVICE_STATUS.ACTIVE,
      });

      const result = await getServiceById(service._id);

      expect(result._id.toString()).toBe(service._id.toString());
      expect(result.name).toBe('Test Service');
    });

    it('should throw error for non-existent service', async () => {
      await expect(getServiceById(generateObjectId()))
        .rejects
        .toThrow(NotFoundError);
    });
  });
  // #endregion

  // #region Create Service Tests
  describe('createService', () => {
    it('should create service with valid data', async () => {
      const result = await createService({
        name: 'New Service',
        description: 'Service description',
        pricePerUse: 150000,
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('New Service');
      expect(result.description).toBe('Service description');
      expect(result.pricePerUse).toBe(150000);
      expect(result.status).toBe(SERVICE_STATUS.ACTIVE);
      expect(result.isAvailable).toBe(true);
    });

    it('should trim whitespace from name and description', async () => {
      const result = await createService({
        name: '  Trimmed Service  ',
        description: '  Trimmed description  ',
        pricePerUse: 100000,
      });

      expect(result.name).toBe('Trimmed Service');
      expect(result.description).toBe('Trimmed description');
    });

    it('should create service without description', async () => {
      const result = await createService({
        name: 'No Description',
        pricePerUse: 100000,
      });

      expect(result.description).toBe('');
    });

    it('should throw error for duplicate name', async () => {
      await Service.create({
        name: 'Existing Service',
        pricePerUse: 100000,
        status: SERVICE_STATUS.ACTIVE,
      });

      await expect(createService({
        name: 'Existing Service',
        pricePerUse: 200000,
      }))
        .rejects
        .toThrow(ValidationError);
    });
  });
  // #endregion

  // #region Update Service Tests
  describe('updateService', () => {
    let service;

    beforeEach(async () => {
      service = await Service.create({
        name: 'Original Service',
        description: 'Original description',
        pricePerUse: 100000,
        status: SERVICE_STATUS.ACTIVE,
      });
    });

    it('should update service name', async () => {
      const result = await updateService(service._id, { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
    });

    it('should update service description', async () => {
      const result = await updateService(service._id, { 
        description: 'Updated description' 
      });

      expect(result.description).toBe('Updated description');
    });

    it('should update service price', async () => {
      const result = await updateService(service._id, { pricePerUse: 200000 });

      expect(result.pricePerUse).toBe(200000);
    });

    it('should update service status', async () => {
      const result = await updateService(service._id, { 
        status: SERVICE_STATUS.INACTIVE 
      });

      expect(result.status).toBe(SERVICE_STATUS.INACTIVE);
    });

    it('should throw error for non-existent service', async () => {
      await expect(updateService(generateObjectId(), { name: 'New' }))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should throw error for duplicate name', async () => {
      await Service.create({
        name: 'Another Service',
        pricePerUse: 100000,
        status: SERVICE_STATUS.ACTIVE,
      });

      await expect(updateService(service._id, { name: 'Another Service' }))
        .rejects
        .toThrow(ValidationError);
    });

    it('should trim whitespace from name and description', async () => {
      const result = await updateService(service._id, {
        name: '  Trimmed  ',
        description: '  Trimmed desc  ',
      });

      expect(result.name).toBe('Trimmed');
      expect(result.description).toBe('Trimmed desc');
    });
  });
  // #endregion

  // #region Delete Service Tests
  describe('deleteService', () => {
    it('should delete service not in use', async () => {
      const service = await Service.create({
        name: 'To Delete',
        pricePerUse: 100000,
        status: SERVICE_STATUS.ACTIVE,
      });

      const result = await deleteService(service._id);

      expect(result.message).toBeDefined();

      const deleted = await Service.findById(service._id);
      expect(deleted).toBeNull();
    });

    it('should throw error for non-existent service', async () => {
      await expect(deleteService(generateObjectId()))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should delete service even if in use (no FK check)', async () => {
      // Note: Service does not check for usage before deleting
      const service = await Service.create({
        name: 'In Use Service',
        pricePerUse: 100000,
        status: SERVICE_STATUS.ACTIVE,
      });

      // Create a booking detail using this service
      await BookingDetail.create({
        bookingId: generateObjectId(),
        extraServiceId: service._id,
        detailType: 'extra_service',
        description: 'In Use Service',
        quantity: 1,
        pricePerUnit: 100000,
        subtotal: 100000,
      });

      // Service allows deletion even when in use
      const result = await deleteService(service._id);
      expect(result.message).toBeDefined();
    });
  });
  // #endregion

  // #region Service Status Constants Tests
  describe('Service Status Constants', () => {
    it('should have ACTIVE status', () => {
      expect(SERVICE_STATUS.ACTIVE).toBeDefined();
    });

    it('should have INACTIVE status', () => {
      expect(SERVICE_STATUS.INACTIVE).toBeDefined();
    });
  });
  // #endregion
});
