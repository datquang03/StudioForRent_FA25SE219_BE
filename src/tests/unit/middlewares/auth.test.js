/**
 * Unit Tests for Middleware
 * Tests authentication and authorization middleware
 */

import jwt from 'jsonwebtoken';
import { User } from '../../../models/index.js';
import { protect, authorize, optionalProtect } from '../../../middlewares/auth.js';
import { AUTH_MESSAGES } from '../../../utils/constants.js';
import { createMockUser, createMockRequest, createMockResponse, createMockNext, generateObjectId } from '../../mocks/factories.js';

describe('Auth Middleware', () => {
  // #region protect Middleware Tests
  describe('protect', () => {
    it('should allow access with valid token', async () => {
      const user = await User.create(createMockUser());
      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const req = createMockRequest({
        headers: { authorization: `Bearer ${token}` },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await protect(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user._id.toString()).toBe(user._id.toString());
    });

    it('should reject request without token', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: AUTH_MESSAGES.TOKEN_MISSING,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token', async () => {
      const req = createMockRequest({
        headers: { authorization: 'Bearer invalid-token' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: AUTH_MESSAGES.TOKEN_INVALID,
      });
    });

    it('should reject request with expired token', async () => {
      const user = await User.create(createMockUser());
      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' } // Already expired
      );

      const req = createMockRequest({
        headers: { authorization: `Bearer ${token}` },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: AUTH_MESSAGES.TOKEN_INVALID,
      });
    });

    it('should reject request for non-existent user', async () => {
      const token = jwt.sign(
        { id: generateObjectId(), role: 'customer' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const req = createMockRequest({
        headers: { authorization: `Bearer ${token}` },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: AUTH_MESSAGES.USER_NOT_FOUND,
      });
    });

    it('should reject request for inactive user', async () => {
      const user = await User.create(createMockUser({ isActive: false }));
      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const req = createMockRequest({
        headers: { authorization: `Bearer ${token}` },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: AUTH_MESSAGES.ACCOUNT_INACTIVE,
      });
    });

    it('should handle malformed authorization header', async () => {
      const req = createMockRequest({
        headers: { authorization: 'InvalidFormat' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: AUTH_MESSAGES.TOKEN_MISSING,
      });
    });
  });
  // #endregion

  // #region optionalProtect Middleware Tests
  describe('optionalProtect', () => {
    it('should attach user if valid token provided', async () => {
      const user = await User.create(createMockUser());
      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const req = createMockRequest({
        headers: { authorization: `Bearer ${token}` },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await optionalProtect(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user._id.toString()).toBe(user._id.toString());
    });

    it('should continue without user if no token', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await optionalProtect(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeFalsy();
    });

    it('should continue without user if invalid token', async () => {
      const req = createMockRequest({
        headers: { authorization: 'Bearer invalid-token' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await optionalProtect(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeFalsy();
    });
  });
  // #endregion

  // #region authorize Middleware Tests
  describe('authorize', () => {
    it('should allow access for authorized role', async () => {
      const req = createMockRequest();
      req.user = { role: 'admin' };
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = authorize('admin', 'staff');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow access when role is in array', async () => {
      const req = createMockRequest();
      req.user = { role: 'staff' };
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = authorize(['admin', 'staff']);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject access for unauthorized role', async () => {
      const req = createMockRequest();
      req.user = { role: 'customer' };
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = authorize('admin', 'staff');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: AUTH_MESSAGES.UNAUTHORIZED,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should work with single role', async () => {
      const req = createMockRequest();
      req.user = { role: 'admin' };
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = authorize('admin');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject when user role not in allowed roles', async () => {
      const req = createMockRequest();
      req.user = { role: 'customer' };
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = authorize('admin');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
  // #endregion
});
