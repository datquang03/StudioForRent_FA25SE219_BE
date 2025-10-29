import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, CustomerProfile, StaffProfile } from '../models/index.js';
import { sendVerificationEmail } from './email.service.js';
import { AUTH_MESSAGES, USER_ROLES, TIME_CONSTANTS } from '../utils/constants.js';

export const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET,
    { expiresIn: TIME_CONSTANTS.JWT_EXPIRY }
  );
};

const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

const comparePassword = async (plainPassword, hashedPassword) => {
  return bcrypt.compare(plainPassword, hashedPassword);
};

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

  const token = generateToken(user._id, user.role);
  const userObject = user.toObject();
  delete userObject.passwordHash;

  return { user: userObject, token };
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

export const login = async (data) => {
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

  const token = generateToken(user._id, user.role);
  const userObject = user.toObject();
  delete userObject.passwordHash;
  delete userObject.verificationCode;
  delete userObject.verificationCodeExpiry;

  return { user: userObject, token };
};

export const createStaffAccount = async (data) => {
  const { username, email, password, fullName, phone, position, salary } = data;

  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    throw new Error(AUTH_MESSAGES.EMAIL_EXISTS);
  }

  const existingUsername = await User.findOne({ username });
  if (existingUsername) {
    throw new Error(AUTH_MESSAGES.USERNAME_EXISTS);
  }

  const passwordHash = await hashPassword(password);
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
    salary,
    hireDate: new Date(),
    isActive: true,
  });

  const userObject = user.toObject();
  delete userObject.passwordHash;

  return userObject;
};
