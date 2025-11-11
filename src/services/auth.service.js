// #region Imports
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, CustomerProfile, StaffProfile, RefreshToken } from '../models/index.js';
import { sendVerificationEmail, sendStaffCredentialsEmail } from './email.service.js';
import { AUTH_MESSAGES, USER_ROLES, TIME_CONSTANTS } from '../utils/constants.js';
import { generateVerificationCode } from '../utils/helpers.js';
import { NotFoundError, UnauthorizedError } from '../utils/errors.js';
import logger from '../utils/logger.js';
// #endregion

// #region Helper Functions
export const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET,
    { expiresIn: TIME_CONSTANTS.JWT_EXPIRY }
  );
};

export const generateRefreshToken = () => {
  return crypto.randomBytes(40).toString('hex');
};

export const generateRandomPassword = () => {
  // Generate password: 2 chữ hoa + 2 chữ thường + 4 số + 2 ký tự đặc biệt
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%';
  
  let password = '';
  
  // 2 chữ hoa
  for (let i = 0; i < 2; i++) {
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
  }
  
  // 2 chữ thường
  for (let i = 0; i < 2; i++) {
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
  }
  
  // 4 số
  for (let i = 0; i < 4; i++) {
    password += numbers[Math.floor(Math.random() * numbers.length)];
  }
  
  // 2 ký tự đặc biệt
  for (let i = 0; i < 2; i++) {
    password += special[Math.floor(Math.random() * special.length)];
  }
  
  // Shuffle password để random vị trí
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

export const createRefreshToken = async (userId, ipAddress) => {
  const token = generateRefreshToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TIME_CONSTANTS.REFRESH_TOKEN_EXPIRY_DAYS);

  const refreshToken = await RefreshToken.create({
    userId,
    token,
    expiresAt,
    createdByIp: ipAddress,
  });

  return refreshToken.token;
};

export const verifyRefreshToken = async (token) => {
  const refreshToken = await RefreshToken.findOne({ token }).populate('userId');

  if (!refreshToken || !refreshToken.isActive) {
    throw new Error(AUTH_MESSAGES.INVALID_REFRESH_TOKEN);
  }

  return refreshToken;
};

export const revokeRefreshToken = async (token, ipAddress) => {
  const refreshToken = await RefreshToken.findOne({ token });

  if (!refreshToken || !refreshToken.isActive) {
    throw new Error(AUTH_MESSAGES.INVALID_REFRESH_TOKEN);
  }

  refreshToken.revoke(ipAddress);
  await refreshToken.save();
};

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

const comparePassword = async (plainPassword, hashedPassword) => {
  return bcrypt.compare(plainPassword, hashedPassword);
};
// #endregion

// #region Customer Registration & Verification
export const registerCustomer = async (data) => {
  const { username, email, password, fullName, phone } = data;

  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    throw new Error(AUTH_MESSAGES.EMAIL_EXISTS);
  }

  const existingUsername = await User.findOne({ username });
  if (existingUsername) {
    throw new Error(AUTH_MESSAGES.USERNAME_EXISTS);
  }

  const passwordHash = await hashPassword(password);
  const verificationCode = generateVerificationCode();
  const codeExpiry = new Date(Date.now() + TIME_CONSTANTS.VERIFICATION_CODE_EXPIRY);

  const user = await User.create({
    username,
    email,
    phone,
    passwordHash,
    role: USER_ROLES.CUSTOMER,
    fullName,
    isVerified: false,
    verificationCode,
    verificationCodeExpiry: codeExpiry,
  });

  await CustomerProfile.create({
    userId: user._id,
    loyaltyPoints: 0,
  });

  await sendVerificationEmail(email, verificationCode);

  const userObject = user.toObject();
  delete userObject.passwordHash;
  delete userObject.verificationCode;
  delete userObject.verificationCodeExpiry;

  return userObject;
};

export const verifyEmail = async (email, code) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new Error(AUTH_MESSAGES.USER_NOT_FOUND);
  }

  if (user.isVerified) {
    throw new Error(AUTH_MESSAGES.ALREADY_VERIFIED);
  }

  if (new Date() > user.verificationCodeExpiry) {
    throw new Error(AUTH_MESSAGES.CODE_EXPIRED);
  }

  if (user.verificationCode !== code) {
    throw new Error(AUTH_MESSAGES.INVALID_CODE);
  }

  user.isVerified = true;
  user.verificationCode = undefined;
  user.verificationCodeExpiry = undefined;
  await user.save();

  const accessToken = generateToken(user._id, user.role);
  const refreshToken = await createRefreshToken(user._id, 'unknown');
  const userObject = user.toObject();
  delete userObject.passwordHash;

  return { user: userObject, accessToken, refreshToken };
};

export const resendVerificationCode = async (email) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new Error(AUTH_MESSAGES.USER_NOT_FOUND);
  }

  if (user.isVerified) {
    throw new Error(AUTH_MESSAGES.ALREADY_VERIFIED);
  }

  const verificationCode = generateVerificationCode();
  const codeExpiry = new Date(Date.now() + TIME_CONSTANTS.VERIFICATION_CODE_EXPIRY);

  user.verificationCode = verificationCode;
  user.verificationCodeExpiry = codeExpiry;
  await user.save();

  await sendVerificationEmail(email, verificationCode);
};
// #endregion

// #region Login & Authentication
export const login = async (data, ipAddress) => {
  const { username, password } = data;

  const user = await User.findOne({
    $or: [{ username }, { email: username }]
  });

  if (!user) {
    throw new Error(AUTH_MESSAGES.INVALID_CREDENTIALS);
  }

  if (!user.isActive) {
    throw new Error(AUTH_MESSAGES.ACCOUNT_INACTIVE);
  }

  const isPasswordValid = await comparePassword(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new Error(AUTH_MESSAGES.INVALID_CREDENTIALS);
  }

  if (user.role === USER_ROLES.CUSTOMER && !user.isVerified) {
    throw new Error(AUTH_MESSAGES.NOT_VERIFIED);
  }

  const accessToken = generateToken(user._id, user.role);
  const refreshToken = await createRefreshToken(user._id, ipAddress);
  const userObject = user.toObject();
  delete userObject.passwordHash;
  delete userObject.verificationCode;
  delete userObject.verificationCodeExpiry;

  return { user: userObject, accessToken, refreshToken };
};

export const refreshAccessToken = async (token, ipAddress) => {
  const refreshToken = await verifyRefreshToken(token);
  const { userId } = refreshToken;

  // Generate new tokens
  const accessToken = generateToken(userId._id, userId.role);
  const newRefreshToken = await createRefreshToken(userId._id, ipAddress);

  // Revoke old refresh token
  refreshToken.revokedAt = new Date();
  refreshToken.revokedByIp = ipAddress;
  refreshToken.replacedByToken = newRefreshToken;
  await refreshToken.save();

  return { accessToken, refreshToken: newRefreshToken };
};

export const logout = async (token, ipAddress) => {
  await revokeRefreshToken(token, ipAddress);
};
// #endregion

// #region Staff Account Management
export const createStaffAccount = async (data) => {
  const { username, email, fullName, phone, position } = data; // Không cần password từ admin

  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    throw new Error(AUTH_MESSAGES.EMAIL_EXISTS);
  }

  const existingUsername = await User.findOne({ username });
  if (existingUsername) {
    throw new Error(AUTH_MESSAGES.USERNAME_EXISTS);
  }

  // Auto-generate password
  const autoPassword = generateRandomPassword();
  const passwordHash = await hashPassword(autoPassword);
  const role = position === 'admin' ? USER_ROLES.ADMIN : USER_ROLES.STAFF;
  
  const user = await User.create({
    username,
    email,
    phone,
    passwordHash,
    role,
    fullName,
    isVerified: true,
    isActive: true,
  });

  await StaffProfile.create({
    userId: user._id,
    position,
    hireDate: new Date(),
    isActive: true,
  });

  // Gửi email thông tin tài khoản cho staff (non-blocking)
  try {
    await sendStaffCredentialsEmail(email, {
      username,
      password: autoPassword,
      fullName,
      role,
    });
  } catch (emailError) {
    // Log error nhưng không fail toàn bộ request
    logger.error('Failed to send staff credentials email', emailError);
  }

  const userObject = user.toObject();
  delete userObject.passwordHash;

  // Return cả auto-generated password để gửi email
  return {
    ...userObject,
    generatedPassword: autoPassword, // Password tự động tạo
  };
};

// Change password cho user (Staff/Customer/Admin)
export const changePassword = async (userId, oldPassword, newPassword) => {
  const user = await User.findById(userId);
  
  if (!user) {
    throw new NotFoundError('Người dùng không tồn tại!');
  }

  // Verify old password
  const isValidPassword = await comparePassword(oldPassword, user.passwordHash);
  if (!isValidPassword) {
    throw new UnauthorizedError('Mật khẩu cũ không đúng!');
  }

  // Hash new password
  const newPasswordHash = await hashPassword(newPassword);
  
  // Update password
  user.passwordHash = newPasswordHash;
  await user.save();

  return { message: 'Đổi mật khẩu thành công!' };
};
// #endregion

// #region Forgot Password (generate new password and send via email)
export const forgotPassword = async (email) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new NotFoundError('Người dùng không tồn tại!');
  }

  // Generate a new random password and hash it
  const newPassword = generateRandomPassword();
  const newPasswordHash = await hashPassword(newPassword);

  user.passwordHash = newPasswordHash;
  await user.save();

  // Send email with new credentials (reuse staff credentials template)
  try {
    await sendStaffCredentialsEmail(email, {
      username: user.username,
      password: newPassword,
      fullName: user.fullName || user.username,
      role: user.role || 'customer',
    });
  } catch (emailError) {
    logger.error('Failed to send new password email', emailError);
    throw new Error('Failed to send email with new password');
  }

  return { message: 'Mật khẩu mới đã được gửi tới email của bạn.' };
};
// #endregion
