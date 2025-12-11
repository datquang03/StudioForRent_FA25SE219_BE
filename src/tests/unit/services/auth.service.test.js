/**
 * Unit Tests for Auth Service
 * Tests all authentication functions in src/services/auth.service.js
 * 
 * Note: Tests are designed to work without external service mocks in ESM
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, CustomerProfile, StaffProfile, RefreshToken } from '../../../models/index.js';
import {
  generateToken,
  generateRefreshToken,
  generateRandomPassword,
  createRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  registerCustomer,
  verifyEmail,
  resendVerificationCode,
  login,
  refreshAccessToken,
  logout,
  createStaffAccount,
  changePassword,
  forgotPassword,
} from '../../../services/auth.service.js';
import { AUTH_MESSAGES, USER_ROLES } from '../../../utils/constants.js';
import { createMockUser, generateObjectId } from '../../mocks/factories.js';

// Note: External services (email, notification) will execute normally
// Tests verify core auth logic independent of external service responses

describe('Auth Service', () => {
  // #region Helper Functions Tests
  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const userId = generateObjectId();
      const role = 'customer';
      const token = generateToken(userId, role);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.id.toString()).toBe(userId.toString());
      expect(decoded.role).toBe(role);
    });

    it('should generate tokens with correct expiry', () => {
      const userId = generateObjectId();
      const token = generateToken(userId, 'customer');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
    });

    it('should generate different tokens for different users', () => {
      const userId1 = generateObjectId();
      const userId2 = generateObjectId();

      const token1 = generateToken(userId1, 'customer');
      const token2 = generateToken(userId2, 'customer');

      expect(token1).not.toBe(token2);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a random hex string', () => {
      const token = generateRefreshToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(80); // 40 bytes = 80 hex characters
    });

    it('should generate unique tokens', () => {
      const tokens = new Set();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateRefreshToken());
      }
      expect(tokens.size).toBe(100);
    });
  });

  describe('generateRandomPassword', () => {
    it('should generate password of correct length', () => {
      const password = generateRandomPassword();
      expect(password.length).toBe(10); // 2 upper + 2 lower + 4 numbers + 2 special
    });

    it('should contain uppercase letters', () => {
      const password = generateRandomPassword();
      expect(/[A-Z]/.test(password)).toBe(true);
    });

    it('should contain lowercase letters', () => {
      const password = generateRandomPassword();
      expect(/[a-z]/.test(password)).toBe(true);
    });

    it('should contain numbers', () => {
      const password = generateRandomPassword();
      expect(/[0-9]/.test(password)).toBe(true);
    });

    it('should contain special characters', () => {
      const password = generateRandomPassword();
      expect(/[!@#$%]/.test(password)).toBe(true);
    });

    it('should generate unique passwords', () => {
      const passwords = new Set();
      for (let i = 0; i < 50; i++) {
        passwords.add(generateRandomPassword());
      }
      expect(passwords.size).toBeGreaterThan(45); // Allow some collisions
    });
  });
  // #endregion

  // #region Refresh Token Tests
  describe('createRefreshToken', () => {
    it('should create and store refresh token in database', async () => {
      const user = await User.create(createMockUser());
      const ipAddress = '192.168.1.1';

      const token = await createRefreshToken(user._id, ipAddress);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const storedToken = await RefreshToken.findOne({ token });
      expect(storedToken).toBeDefined();
      expect(storedToken.userId.toString()).toBe(user._id.toString());
      expect(storedToken.createdByIp).toBe(ipAddress);
    });

    it('should set correct expiry date', async () => {
      const user = await User.create(createMockUser());
      const token = await createRefreshToken(user._id, '127.0.0.1');

      const storedToken = await RefreshToken.findOne({ token });
      const expectedExpiry = new Date();
      expectedExpiry.setDate(expectedExpiry.getDate() + 7);

      // Allow 1 minute tolerance
      const diff = Math.abs(storedToken.expiresAt - expectedExpiry);
      expect(diff).toBeLessThan(60 * 1000);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', async () => {
      const user = await User.create(createMockUser());
      const token = await createRefreshToken(user._id, '127.0.0.1');

      const refreshToken = await verifyRefreshToken(token);

      expect(refreshToken).toBeDefined();
      expect(refreshToken.token).toBe(token);
      expect(refreshToken.userId).toBeDefined();
    });

    it('should throw error for invalid token', async () => {
      await expect(verifyRefreshToken('invalid-token'))
        .rejects
        .toThrow(AUTH_MESSAGES.INVALID_REFRESH_TOKEN);
    });

    it('should throw error for expired token', async () => {
      const user = await User.create(createMockUser());
      await RefreshToken.create({
        userId: user._id,
        token: 'expired-token',
        expiresAt: new Date(Date.now() - 1000), // Already expired
        createdByIp: '127.0.0.1',
      });

      await expect(verifyRefreshToken('expired-token'))
        .rejects
        .toThrow(AUTH_MESSAGES.INVALID_REFRESH_TOKEN);
    });

    it('should throw error for revoked token', async () => {
      const user = await User.create(createMockUser());
      await RefreshToken.create({
        userId: user._id,
        token: 'revoked-token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdByIp: '127.0.0.1',
        revokedAt: new Date(),
      });

      await expect(verifyRefreshToken('revoked-token'))
        .rejects
        .toThrow(AUTH_MESSAGES.INVALID_REFRESH_TOKEN);
    });
  });

  describe('revokeRefreshToken', () => {
    it('should revoke valid refresh token', async () => {
      const user = await User.create(createMockUser());
      const token = await createRefreshToken(user._id, '127.0.0.1');

      await revokeRefreshToken(token, '192.168.1.1');

      const revokedToken = await RefreshToken.findOne({ token });
      expect(revokedToken.revokedAt).toBeDefined();
      expect(revokedToken.revokedByIp).toBe('192.168.1.1');
    });

    it('should throw error for invalid token', async () => {
      await expect(revokeRefreshToken('invalid-token', '127.0.0.1'))
        .rejects
        .toThrow(AUTH_MESSAGES.INVALID_REFRESH_TOKEN);
    });
  });
  // #endregion

  // #region Customer Registration Tests
  describe('registerCustomer', () => {
    it('should register new customer successfully', async () => {
      const userData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'Password123',
        fullName: 'New User',
        phone: '0912345678',
      };

      const result = await registerCustomer(userData);

      expect(result).toBeDefined();
      expect(result.username).toBe(userData.username);
      expect(result.email).toBe(userData.email);
      expect(result.role).toBe(USER_ROLES.CUSTOMER);
      expect(result.isVerified).toBe(false);
      expect(result.passwordHash).toBeUndefined();
      expect(result.verificationCode).toBeUndefined();

      // Check customer profile created
      const profile = await CustomerProfile.findOne({ userId: result._id });
      expect(profile).toBeDefined();
      expect(profile.loyaltyPoints).toBe(0);
    });

    it('should throw error for existing email', async () => {
      await User.create(createMockUser({ email: 'existing@example.com' }));

      await expect(
        registerCustomer({
          username: 'newuser',
          email: 'existing@example.com',
          password: 'Password123',
          fullName: 'New User',
        })
      ).rejects.toThrow(AUTH_MESSAGES.EMAIL_EXISTS);
    });

    it('should throw error for existing username', async () => {
      await User.create(createMockUser({ username: 'existinguser' }));

      await expect(
        registerCustomer({
          username: 'existinguser',
          email: 'new@example.com',
          password: 'Password123',
          fullName: 'New User',
        })
      ).rejects.toThrow(AUTH_MESSAGES.USERNAME_EXISTS);
    });

    it('should hash password correctly', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
        fullName: 'Test User',
      };

      await registerCustomer(userData);

      const user = await User.findOne({ email: userData.email });
      const isMatch = await bcrypt.compare(userData.password, user.passwordHash);
      expect(isMatch).toBe(true);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email with correct code', async () => {
      const user = await User.create(
        createMockUser({
          isVerified: false,
          verificationCode: '123456',
          verificationCodeExpiry: new Date(Date.now() + 10 * 60 * 1000),
        })
      );

      const result = await verifyEmail(user.email, '123456');

      expect(result).toBeDefined();
      expect(result.user.isVerified).toBe(true);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw error for non-existent user', async () => {
      await expect(verifyEmail('nonexistent@example.com', '123456'))
        .rejects
        .toThrow(AUTH_MESSAGES.USER_NOT_FOUND);
    });

    it('should throw error for already verified user', async () => {
      const user = await User.create(createMockUser({ isVerified: true }));

      await expect(verifyEmail(user.email, '123456'))
        .rejects
        .toThrow(AUTH_MESSAGES.ALREADY_VERIFIED);
    });

    it('should throw error for expired code', async () => {
      const user = await User.create(
        createMockUser({
          isVerified: false,
          verificationCode: '123456',
          verificationCodeExpiry: new Date(Date.now() - 1000),
        })
      );

      await expect(verifyEmail(user.email, '123456'))
        .rejects
        .toThrow(AUTH_MESSAGES.CODE_EXPIRED);
    });

    it('should throw error for invalid code', async () => {
      const user = await User.create(
        createMockUser({
          isVerified: false,
          verificationCode: '123456',
          verificationCodeExpiry: new Date(Date.now() + 10 * 60 * 1000),
        })
      );

      await expect(verifyEmail(user.email, '654321'))
        .rejects
        .toThrow(AUTH_MESSAGES.INVALID_CODE);
    });
  });

  describe('resendVerificationCode', () => {
    it('should resend verification code successfully', async () => {
      const user = await User.create(
        createMockUser({
          isVerified: false,
          verificationCode: '123456',
        })
      );

      await resendVerificationCode(user.email);

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.verificationCode).toBeDefined();
      expect(updatedUser.verificationCode).not.toBe('123456');
    });

    it('should throw error for non-existent user', async () => {
      await expect(resendVerificationCode('nonexistent@example.com'))
        .rejects
        .toThrow(AUTH_MESSAGES.USER_NOT_FOUND);
    });

    it('should throw error for already verified user', async () => {
      const user = await User.create(createMockUser({ isVerified: true }));

      await expect(resendVerificationCode(user.email))
        .rejects
        .toThrow(AUTH_MESSAGES.ALREADY_VERIFIED);
    });
  });
  // #endregion

  // #region Login Tests
  describe('login', () => {
    it('should login with correct username and password', async () => {
      const password = 'Password123';
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create(
        createMockUser({
          passwordHash,
          isVerified: true,
          isActive: true,
        })
      );

      const result = await login({ username: user.username, password }, '127.0.0.1');

      expect(result).toBeDefined();
      expect(result.user.username).toBe(user.username);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.passwordHash).toBeUndefined();
    });

    it('should login with email instead of username', async () => {
      const password = 'Password123';
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create(
        createMockUser({
          passwordHash,
          isVerified: true,
          isActive: true,
        })
      );

      const result = await login({ username: user.email, password }, '127.0.0.1');

      expect(result.user.email).toBe(user.email);
      expect(result.accessToken).toBeDefined();
    });

    it('should throw error for wrong password', async () => {
      const passwordHash = await bcrypt.hash('Password123', 10);
      const user = await User.create(
        createMockUser({
          passwordHash,
          isVerified: true,
        })
      );

      await expect(
        login({ username: user.username, password: 'WrongPassword123' }, '127.0.0.1')
      ).rejects.toThrow(AUTH_MESSAGES.INVALID_CREDENTIALS);
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        login({ username: 'nonexistent', password: 'Password123' }, '127.0.0.1')
      ).rejects.toThrow(AUTH_MESSAGES.INVALID_CREDENTIALS);
    });

    it('should throw error for inactive user', async () => {
      const password = 'Password123';
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create(
        createMockUser({
          passwordHash,
          isActive: false,
        })
      );

      await expect(
        login({ username: user.username, password }, '127.0.0.1')
      ).rejects.toThrow(AUTH_MESSAGES.ACCOUNT_INACTIVE);
    });

    it('should throw error for unverified customer', async () => {
      const password = 'Password123';
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create(
        createMockUser({
          passwordHash,
          role: USER_ROLES.CUSTOMER,
          isVerified: false,
          isActive: true,
        })
      );

      await expect(
        login({ username: user.username, password }, '127.0.0.1')
      ).rejects.toThrow(AUTH_MESSAGES.NOT_VERIFIED);
    });

    it('should allow unverified staff to login', async () => {
      const password = 'Password123';
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create(
        createMockUser({
          passwordHash,
          role: USER_ROLES.STAFF,
          isVerified: false,
          isActive: true,
        })
      );

      const result = await login({ username: user.username, password }, '127.0.0.1');
      expect(result.user).toBeDefined();
    });
  });
  // #endregion

  // #region Token Refresh & Logout Tests
  describe('refreshAccessToken', () => {
    it('should refresh access token with valid refresh token', async () => {
      const user = await User.create(createMockUser());
      const token = await createRefreshToken(user._id, '127.0.0.1');

      const result = await refreshAccessToken(token, '192.168.1.1');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe(token);

      // Old token should be revoked
      const oldToken = await RefreshToken.findOne({ token });
      expect(oldToken.revokedAt).toBeDefined();
    });

    it('should throw error for invalid refresh token', async () => {
      await expect(refreshAccessToken('invalid-token', '127.0.0.1'))
        .rejects
        .toThrow();
    });
  });

  describe('logout', () => {
    it('should logout by revoking refresh token', async () => {
      const user = await User.create(createMockUser());
      const token = await createRefreshToken(user._id, '127.0.0.1');

      await logout(token, '192.168.1.1');

      const revokedToken = await RefreshToken.findOne({ token });
      expect(revokedToken.revokedAt).toBeDefined();
    });

    it('should throw error for invalid token', async () => {
      await expect(logout('invalid-token', '127.0.0.1'))
        .rejects
        .toThrow(AUTH_MESSAGES.INVALID_REFRESH_TOKEN);
    });
  });
  // #endregion

  // #region Staff Account Management Tests
  describe('createStaffAccount', () => {
    it('should create staff account successfully', async () => {
      const staffData = {
        username: 'newstaff',
        email: 'staff@example.com',
        fullName: 'New Staff',
        phone: '0912345678',
        position: 'staff',
      };

      const result = await createStaffAccount(staffData);

      expect(result).toBeDefined();
      expect(result.username).toBe(staffData.username);
      expect(result.role).toBe(USER_ROLES.STAFF);
      expect(result.isVerified).toBe(true);
      expect(result.generatedPassword).toBeDefined();
      expect(result.passwordHash).toBeUndefined();

      // Check staff profile created
      const profile = await StaffProfile.findOne({ userId: result._id });
      expect(profile).toBeDefined();
      expect(profile.position).toBe('staff');
    });

    it('should throw error for existing email', async () => {
      await User.create(createMockUser({ email: 'existing@example.com' }));

      await expect(
        createStaffAccount({
          username: 'newstaff',
          email: 'existing@example.com',
          fullName: 'New Staff',
          position: 'staff',
        })
      ).rejects.toThrow(AUTH_MESSAGES.EMAIL_EXISTS);
    });

    it('should throw error for existing username', async () => {
      await User.create(createMockUser({ username: 'existingstaff' }));

      await expect(
        createStaffAccount({
          username: 'existingstaff',
          email: 'new@example.com',
          fullName: 'New Staff',
          position: 'staff',
        })
      ).rejects.toThrow(AUTH_MESSAGES.USERNAME_EXISTS);
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const oldPassword = 'OldPassword123';
      const newPassword = 'NewPassword456';
      const passwordHash = await bcrypt.hash(oldPassword, 10);
      const user = await User.create(createMockUser({ passwordHash }));

      const result = await changePassword(user._id, oldPassword, newPassword);

      expect(result.message).toBeDefined();

      // Verify new password works
      const updatedUser = await User.findById(user._id);
      const isMatch = await bcrypt.compare(newPassword, updatedUser.passwordHash);
      expect(isMatch).toBe(true);
    });

    it('should throw error for wrong old password', async () => {
      const passwordHash = await bcrypt.hash('CorrectPassword123', 10);
      const user = await User.create(createMockUser({ passwordHash }));

      await expect(
        changePassword(user._id, 'WrongPassword123', 'NewPassword456')
      ).rejects.toThrow('Mật khẩu cũ không đúng!');
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        changePassword(generateObjectId(), 'OldPassword123', 'NewPassword456')
      ).rejects.toThrow('Người dùng không tồn tại!');
    });
  });

  describe('forgotPassword', () => {
    it('should generate and send new password', async () => {
      const user = await User.create(createMockUser());
      const oldPasswordHash = user.passwordHash;

      const result = await forgotPassword(user.email);

      expect(result.message).toBeDefined();

      // Password should have changed
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.passwordHash).not.toBe(oldPasswordHash);
    });

    it('should throw error for non-existent email', async () => {
      await expect(forgotPassword('nonexistent@example.com'))
        .rejects
        .toThrow('Người dùng không tồn tại!');
    });
  });
  // #endregion
});
