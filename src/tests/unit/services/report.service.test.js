/**
 * Unit Tests for Report Service
 * Tests report functions in src/services/report.service.js
 */

import mongoose from 'mongoose';
import Report from '../../../models/Report/report.model.js';
import Review from '../../../models/Review/review.model.js';
import Comment from '../../../models/Comment/comment.model.js';
import { Booking, User, Studio } from '../../../models/index.js';
import {
  createReport,
  getReports,
  getReportById,
  updateReport,
  deleteReport,
} from '../../../services/report.service.js';
import { REPORT_TARGET_TYPES, REPORT_ISSUE_TYPE, REPORT_STATUS, USER_ROLES, BOOKING_STATUS, REVIEW_TARGET_TYPES } from '../../../utils/constants.js';
import { createMockUser, createMockStudio, createMockBooking, generateObjectId } from '../../mocks/factories.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../../../utils/errors.js';

describe('Report Service', () => {
  let customer, admin, staff, studio, booking;

  beforeEach(async () => {
    customer = await User.create(createMockUser({ role: 'customer' }));
    admin = await User.create(createMockUser({ 
      role: 'admin', 
      email: 'admin@test.com', 
      username: 'adminuser' 
    }));
    staff = await User.create(createMockUser({ 
      role: 'staff', 
      email: 'staff@test.com', 
      username: 'staffuser' 
    }));
    studio = await Studio.create(createMockStudio());
    booking = await Booking.create({
      ...createMockBooking(),
      userId: customer._id,
      studioId: studio._id,
      status: BOOKING_STATUS.COMPLETED,
    });
  });

  // #region Create Report Tests
  describe('createReport', () => {
    it('should create report with valid data for booking', async () => {
      const reportData = {
        reporterId: customer._id,
        targetType: REPORT_TARGET_TYPES.BOOKING,
        targetId: booking._id,
        issueType: REPORT_ISSUE_TYPE.DAMAGE,
        description: 'Equipment was damaged during the session',
        priority: 'high',
      };

      const result = await createReport(reportData);

      expect(result).toBeDefined();
      expect(result.reporterId.toString()).toBe(customer._id.toString());
      expect(result.targetType).toBe(REPORT_TARGET_TYPES.BOOKING);
      expect(result.issueType).toBe(REPORT_ISSUE_TYPE.DAMAGE);
      expect(result.priority).toBe('high');
    });

    it('should create report for review', async () => {
      const review = await Review.create({
        bookingId: booking._id,
        userId: customer._id,
        targetType: REVIEW_TARGET_TYPES.STUDIO,
        targetId: studio._id,
        rating: 1,
        content: 'Inappropriate content',
      });

      const reportData = {
        reporterId: admin._id,
        targetType: REPORT_TARGET_TYPES.REVIEW,
        targetId: review._id,
        issueType: REPORT_ISSUE_TYPE.INAPPROPRIATE_CONTENT,
        description: 'Review contains inappropriate language',
      };

      const result = await createReport(reportData);

      expect(result.targetType).toBe(REPORT_TARGET_TYPES.REVIEW);
    });

    it('should throw error if reporterId is missing', async () => {
      const reportData = {
        targetType: REPORT_TARGET_TYPES.BOOKING,
        targetId: booking._id,
        issueType: REPORT_ISSUE_TYPE.DAMAGE,
        description: 'Issue description',
      };

      await expect(createReport(reportData))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw error if targetType is missing and no bookingId', async () => {
      const reportData = {
        reporterId: customer._id,
        targetId: generateObjectId(),
        issueType: REPORT_ISSUE_TYPE.DAMAGE,
        description: 'Issue description',
      };

      await expect(createReport(reportData))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw error if targetId is missing', async () => {
      const reportData = {
        reporterId: customer._id,
        targetType: REPORT_TARGET_TYPES.BOOKING,
        issueType: REPORT_ISSUE_TYPE.DAMAGE,
        description: 'Issue description',
      };

      await expect(createReport(reportData))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw error if issueType is missing', async () => {
      const reportData = {
        reporterId: customer._id,
        targetType: REPORT_TARGET_TYPES.BOOKING,
        targetId: booking._id,
        description: 'Issue description',
      };

      await expect(createReport(reportData))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw error if description is missing', async () => {
      const reportData = {
        reporterId: customer._id,
        targetType: REPORT_TARGET_TYPES.BOOKING,
        targetId: booking._id,
        issueType: REPORT_ISSUE_TYPE.DAMAGE,
      };

      await expect(createReport(reportData))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw error for invalid issueType', async () => {
      const reportData = {
        reporterId: customer._id,
        targetType: REPORT_TARGET_TYPES.BOOKING,
        targetId: booking._id,
        issueType: 'invalid_issue_type',
        description: 'Issue description',
      };

      await expect(createReport(reportData))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw error for invalid priority', async () => {
      const reportData = {
        reporterId: customer._id,
        targetType: REPORT_TARGET_TYPES.BOOKING,
        targetId: booking._id,
        issueType: REPORT_ISSUE_TYPE.DAMAGE,
        description: 'Issue description',
        priority: 'invalid_priority',
      };

      await expect(createReport(reportData))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw error for invalid status', async () => {
      const reportData = {
        reporterId: customer._id,
        targetType: REPORT_TARGET_TYPES.BOOKING,
        targetId: booking._id,
        issueType: REPORT_ISSUE_TYPE.DAMAGE,
        description: 'Issue description',
        status: 'invalid_status',
      };

      await expect(createReport(reportData))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw error for negative compensationAmount', async () => {
      const reportData = {
        reporterId: customer._id,
        targetType: REPORT_TARGET_TYPES.BOOKING,
        targetId: booking._id,
        issueType: REPORT_ISSUE_TYPE.DAMAGE,
        description: 'Issue description',
        compensationAmount: -100,
      };

      await expect(createReport(reportData))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw error if target does not exist', async () => {
      const reportData = {
        reporterId: customer._id,
        targetType: REPORT_TARGET_TYPES.BOOKING,
        targetId: generateObjectId(),
        issueType: REPORT_ISSUE_TYPE.DAMAGE,
        description: 'Issue description',
      };

      await expect(createReport(reportData))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should use bookingId as targetId for backward compatibility', async () => {
      const reportData = {
        reporterId: customer._id,
        bookingId: booking._id,
        issueType: REPORT_ISSUE_TYPE.DAMAGE,
        description: 'Issue description',
      };

      const result = await createReport(reportData);

      expect(result.targetType).toBe(REPORT_TARGET_TYPES.BOOKING);
      expect(result.targetId.toString()).toBe(booking._id.toString());
    });
  });
  // #endregion

  // #region Get Reports Tests
  describe('getReports', () => {
    beforeEach(async () => {
      await Report.create([
        {
          reporterId: customer._id,
          targetType: REPORT_TARGET_TYPES.BOOKING,
          targetId: booking._id,
          bookingId: booking._id,
          issueType: REPORT_ISSUE_TYPE.DAMAGE,
          description: 'Report 1',
          status: REPORT_STATUS.PENDING,
          priority: 'high',
        },
        {
          reporterId: customer._id,
          targetType: REPORT_TARGET_TYPES.BOOKING,
          targetId: booking._id,
          bookingId: booking._id,
          issueType: REPORT_ISSUE_TYPE.OTHER,
          description: 'Report 2',
          status: REPORT_STATUS.IN_PROGRESS,
          priority: 'medium',
        },
        {
          reporterId: customer._id,
          targetType: REPORT_TARGET_TYPES.BOOKING,
          targetId: booking._id,
          bookingId: booking._id,
          issueType: REPORT_ISSUE_TYPE.EQUIPMENT,
          description: 'Report 3',
          status: REPORT_STATUS.RESOLVED,
          priority: 'low',
        },
      ]);
    });

    it('should return all reports', async () => {
      const result = await getReports();

      expect(result.length).toBe(3);
    });

    it('should filter by status', async () => {
      const result = await getReports({ status: REPORT_STATUS.PENDING });

      expect(result.length).toBe(1);
      expect(result[0].status).toBe(REPORT_STATUS.PENDING);
    });

    it('should filter by issueType', async () => {
      const result = await getReports({ issueType: REPORT_ISSUE_TYPE.DAMAGE });

      expect(result.length).toBe(1);
    });

    it('should filter by priority', async () => {
      const result = await getReports({ priority: 'high' });

      expect(result.length).toBe(1);
    });

    it('should throw error for invalid status filter', async () => {
      await expect(getReports({ status: 'invalid_status' }))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw error for invalid issueType filter', async () => {
      await expect(getReports({ issueType: 'invalid_type' }))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw error for invalid priority filter', async () => {
      await expect(getReports({ priority: 'invalid_priority' }))
        .rejects
        .toThrow(ValidationError);
    });
  });
  // #endregion

  // #region Get Report By Id Tests
  describe('getReportById', () => {
    let report;

    beforeEach(async () => {
      report = await Report.create({
        reporterId: customer._id,
        targetType: REPORT_TARGET_TYPES.BOOKING,
        targetId: booking._id,
        bookingId: booking._id,
        issueType: REPORT_ISSUE_TYPE.DAMAGE,
        description: 'Test report',
      });
    });

    it('should return report by id for admin', async () => {
      const result = await getReportById(report._id, admin);

      expect(result).toBeDefined();
      expect(result._id.toString()).toBe(report._id.toString());
    });

    it('should return report by id for staff', async () => {
      const result = await getReportById(report._id, staff);

      expect(result).toBeDefined();
    });

    it('should return report by id for owner', async () => {
      const result = await getReportById(report._id, customer);

      expect(result).toBeDefined();
    });

    it('should throw error if id is missing', async () => {
      await expect(getReportById(null, admin))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw error if report not found', async () => {
      await expect(getReportById(generateObjectId(), admin))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should throw error if user not authorized', async () => {
      const otherCustomer = await User.create(createMockUser({ 
        email: 'other@test.com', 
        username: 'other',
        role: 'customer' 
      }));

      await expect(getReportById(report._id, otherCustomer))
        .rejects
        .toThrow(ForbiddenError);
    });
  });
  // #endregion

  // #region Update Report Tests
  describe('updateReport', () => {
    let report;

    beforeEach(async () => {
      report = await Report.create({
        reporterId: customer._id,
        targetType: REPORT_TARGET_TYPES.BOOKING,
        targetId: booking._id,
        bookingId: booking._id,
        issueType: REPORT_ISSUE_TYPE.DAMAGE,
        description: 'Test report',
        status: REPORT_STATUS.PENDING,
      });
    });

    it('should update report status', async () => {
      const result = await updateReport(report._id, { 
        status: REPORT_STATUS.IN_PROGRESS 
      });

      expect(result.status).toBe(REPORT_STATUS.IN_PROGRESS);
    });

    it('should update report priority', async () => {
      const result = await updateReport(report._id, { priority: 'urgent' });

      expect(result.priority).toBe('urgent');
    });

    it('should update compensationAmount', async () => {
      const result = await updateReport(report._id, { compensationAmount: 500000 });

      expect(result.compensationAmount).toBe(500000);
    });

    it('should update description', async () => {
      const result = await updateReport(report._id, { 
        description: 'Updated description' 
      });

      expect(result.description).toBe('Updated description');
    });

    it('should throw error if id is missing', async () => {
      await expect(updateReport(null, { status: REPORT_STATUS.RESOLVED }))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw error if update data is empty', async () => {
      await expect(updateReport(report._id, {}))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw error for invalid status', async () => {
      await expect(updateReport(report._id, { status: 'invalid' }))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw error for invalid priority', async () => {
      await expect(updateReport(report._id, { priority: 'invalid' }))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw error for negative compensationAmount', async () => {
      await expect(updateReport(report._id, { compensationAmount: -100 }))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw error for empty description', async () => {
      await expect(updateReport(report._id, { description: '   ' }))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw error if report not found', async () => {
      await expect(updateReport(generateObjectId(), { status: REPORT_STATUS.RESOLVED }))
        .rejects
        .toThrow(NotFoundError);
    });
  });
  // #endregion

  // #region Delete Report Tests
  describe('deleteReport', () => {
    let report;

    beforeEach(async () => {
      report = await Report.create({
        reporterId: customer._id,
        targetType: REPORT_TARGET_TYPES.BOOKING,
        targetId: booking._id,
        bookingId: booking._id,
        issueType: REPORT_ISSUE_TYPE.DAMAGE,
        description: 'Test report',
      });
    });

    it('should delete report', async () => {
      const result = await deleteReport(report._id);

      expect(result).toBeDefined();

      const deleted = await Report.findById(report._id);
      expect(deleted).toBeNull();
    });

    it('should throw error if id is missing', async () => {
      await expect(deleteReport(null))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw error if report not found', async () => {
      await expect(deleteReport(generateObjectId()))
        .rejects
        .toThrow(NotFoundError);
    });
  });
  // #endregion

  // #region Report Constants Tests
  describe('Report Constants', () => {
    it('should have all report target types', () => {
      expect(REPORT_TARGET_TYPES.BOOKING).toBeDefined();
      expect(REPORT_TARGET_TYPES.REVIEW).toBeDefined();
      expect(REPORT_TARGET_TYPES.COMMENT).toBeDefined();
    });

    it('should have all report statuses', () => {
      expect(REPORT_STATUS.PENDING).toBeDefined();
      expect(REPORT_STATUS.IN_PROGRESS).toBeDefined();
      expect(REPORT_STATUS.RESOLVED).toBeDefined();
      expect(REPORT_STATUS.CLOSED).toBeDefined();
    });

    it('should have report issue types', () => {
      expect(REPORT_ISSUE_TYPE.DAMAGE).toBeDefined();
      expect(REPORT_ISSUE_TYPE.OTHER).toBeDefined();
    });
  });
  // #endregion
});
