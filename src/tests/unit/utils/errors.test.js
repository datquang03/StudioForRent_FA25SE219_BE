/**
 * Unit Tests for Custom Errors
 * Tests all error classes in src/utils/errors.js
 */

import {
  AppError,
  ApiError,
  NotFoundError,
  BadRequestError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} from '../../../utils/errors.js';

describe('Custom Errors', () => {
  // #region AppError Tests
  describe('AppError', () => {
    it('should create error with message and status code', () => {
      const error = new AppError('Test error', 500);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
    });

    it('should capture stack trace', () => {
      const error = new AppError('Test error', 400);
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('Test error');
    });

    it('should work with different status codes', () => {
      expect(new AppError('Not Found', 404).statusCode).toBe(404);
      expect(new AppError('Bad Request', 400).statusCode).toBe(400);
      expect(new AppError('Internal Error', 500).statusCode).toBe(500);
    });
  });
  // #endregion

  // #region ApiError Tests
  describe('ApiError (Alias)', () => {
    it('should be an alias for AppError', () => {
      expect(ApiError).toBe(AppError);
    });

    it('should create error same as AppError', () => {
      const error = new ApiError('API error', 400);

      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('API error');
      expect(error.statusCode).toBe(400);
    });
  });
  // #endregion

  // #region NotFoundError Tests
  describe('NotFoundError', () => {
    it('should create 404 error with default message', () => {
      const error = new NotFoundError();

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.isOperational).toBe(true);
    });

    it('should create 404 error with custom message', () => {
      const error = new NotFoundError('User not found');

      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(404);
    });

    it('should capture stack trace', () => {
      const error = new NotFoundError('Studio not found');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('Studio not found');
    });
  });
  // #endregion

  // #region BadRequestError Tests
  describe('BadRequestError', () => {
    it('should create 400 error with default message', () => {
      const error = new BadRequestError();

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(BadRequestError);
      expect(error.message).toBe('Bad request');
      expect(error.statusCode).toBe(400);
    });

    it('should create 400 error with custom message', () => {
      const error = new BadRequestError('Invalid input data');

      expect(error.message).toBe('Invalid input data');
      expect(error.statusCode).toBe(400);
    });
  });
  // #endregion

  // #region ValidationError Tests
  describe('ValidationError', () => {
    it('should create 400 error with default message', () => {
      const error = new ValidationError();

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
    });

    it('should create 400 error with custom message', () => {
      const error = new ValidationError('Email is required');

      expect(error.message).toBe('Email is required');
      expect(error.statusCode).toBe(400);
    });

    it('should be distinct from BadRequestError', () => {
      const badRequest = new BadRequestError('Bad');
      const validation = new ValidationError('Invalid');

      expect(badRequest).not.toBeInstanceOf(ValidationError);
      expect(validation).not.toBeInstanceOf(BadRequestError);
    });
  });
  // #endregion

  // #region UnauthorizedError Tests
  describe('UnauthorizedError', () => {
    it('should create 401 error with default message', () => {
      const error = new UnauthorizedError();

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error.message).toBe('Unauthorized');
      expect(error.statusCode).toBe(401);
    });

    it('should create 401 error with custom message', () => {
      const error = new UnauthorizedError('Invalid token');

      expect(error.message).toBe('Invalid token');
      expect(error.statusCode).toBe(401);
    });
  });
  // #endregion

  // #region ForbiddenError Tests
  describe('ForbiddenError', () => {
    it('should create 403 error with default message', () => {
      const error = new ForbiddenError();

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ForbiddenError);
      expect(error.message).toBe('Forbidden');
      expect(error.statusCode).toBe(403);
    });

    it('should create 403 error with custom message', () => {
      const error = new ForbiddenError('Access denied to this resource');

      expect(error.message).toBe('Access denied to this resource');
      expect(error.statusCode).toBe(403);
    });
  });
  // #endregion

  // #region ConflictError Tests
  describe('ConflictError', () => {
    it('should create 409 error with default message', () => {
      const error = new ConflictError();

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ConflictError);
      expect(error.message).toBe('Resource already exists');
      expect(error.statusCode).toBe(409);
    });

    it('should create 409 error with custom message', () => {
      const error = new ConflictError('Email already registered');

      expect(error.message).toBe('Email already registered');
      expect(error.statusCode).toBe(409);
    });
  });
  // #endregion

  // #region Error Hierarchy Tests
  describe('Error Hierarchy', () => {
    it('all custom errors should extend AppError', () => {
      const errors = [
        new NotFoundError(),
        new BadRequestError(),
        new ValidationError(),
        new UnauthorizedError(),
        new ForbiddenError(),
        new ConflictError(),
      ];

      errors.forEach((error) => {
        expect(error).toBeInstanceOf(AppError);
        expect(error).toBeInstanceOf(Error);
        expect(error.isOperational).toBe(true);
      });
    });

    it('errors should have correct status codes', () => {
      expect(new NotFoundError().statusCode).toBe(404);
      expect(new BadRequestError().statusCode).toBe(400);
      expect(new ValidationError().statusCode).toBe(400);
      expect(new UnauthorizedError().statusCode).toBe(401);
      expect(new ForbiddenError().statusCode).toBe(403);
      expect(new ConflictError().statusCode).toBe(409);
    });
  });
  // #endregion
});
