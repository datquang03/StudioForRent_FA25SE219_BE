// #region Imports
import { User, CustomerProfile, StaffProfile } from '../models/index.js';
import { createAndSendNotification } from '../services/notification.service.js';
import { USER_MESSAGES, NOTIFICATION_TYPE } from '../utils/constants.js';
import { NotFoundError } from '../utils/errors.js';
import { escapeRegex } from '../utils/helpers.js';
// #endregion

// #region Customer Profile Management
export const getCustomerProfile = async (userId) => {
  const user = await User.findById(userId)
    .select('-passwordHash -verificationCode -verificationCodeExpiry');

  if (!user) {
    throw new NotFoundError(USER_MESSAGES.USER_NOT_FOUND);
  }

  const customerProfile = await CustomerProfile.findOne({ userId });

  return {
    ...user.toObject(),
    profile: customerProfile,
  };
};

export const updateCustomerProfile = async (userId, updateData) => {
  const allowedUserFields = ['fullName', 'phone', 'avatar'];
  const allowedProfileFields = ['address', 'dateOfBirth', 'preferences'];

  const userUpdateData = {};
  allowedUserFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      userUpdateData[field] = updateData[field];
    }
  });

  const profileUpdateData = {};
  allowedProfileFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      profileUpdateData[field] = updateData[field];
    }
  });

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: userUpdateData },
    { new: true, runValidators: true }
  ).select('-passwordHash -verificationCode -verificationCodeExpiry');

  if (!user) {
    throw new NotFoundError(USER_MESSAGES.USER_NOT_FOUND);
  }

  if (Object.keys(profileUpdateData).length > 0) {
    await CustomerProfile.findOneAndUpdate(
      { userId },
      { $set: profileUpdateData },
      { new: true, runValidators: true }
    );
  }

  // Create notification for profile update
  await createAndSendNotification(
    userId,
    NOTIFICATION_TYPE.INFO,
    'Profile Updated',
    'Your profile information has been successfully updated.',
    false,
    null
  );

  return user;
};
// #endregion

// #region Customer List & Search (Admin)
export const getAllCustomers = async ({ page = 1, limit = 10, isActive, search }) => {
  // Validate and sanitize pagination
  const safePage = Math.max(parseInt(page) || 1, 1);
  const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
  
  // Validate and sanitize search (prevent ReDoS)
  const safeSearch = search && search.length > 100 ? search.substring(0, 100) : search;
  
  const query = { role: 'customer' };

  if (isActive !== undefined) {
    query.isActive = isActive;
  }

  if (safeSearch) {
    const escapedSearch = escapeRegex(safeSearch);
    query.$or = [
      { username: { $regex: escapedSearch, $options: 'i' } },
      { email: { $regex: escapedSearch, $options: 'i' } },
      { fullName: { $regex: escapedSearch, $options: 'i' } },
    ];
  }

  const skip = (safePage - 1) * safeLimit;

  const [users, total] = await Promise.all([
    User.find(query)
      .select('-passwordHash -verificationCode -verificationCodeExpiry')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    User.countDocuments(query),
  ]);

  return {
    users,
    total,
    page: safePage,
    pages: Math.ceil(total / safeLimit),
  };
};

export const getCustomerById = async (userId) => {
  const user = await User.findById(userId)
    .select('-passwordHash -verificationCode -verificationCodeExpiry');

  if (!user || user.role !== 'customer') {
    throw new NotFoundError(USER_MESSAGES.USER_NOT_FOUND);
  }

  const customerProfile = await CustomerProfile.findOne({ userId });

  return {
    ...user.toObject(),
    profile: customerProfile,
  };
};

export const toggleCustomerActive = async (userId, isActive) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { isActive } },
    { new: true }
  ).select('-passwordHash -verificationCode -verificationCodeExpiry');

  if (!user || user.role !== 'customer') {
    throw new NotFoundError(USER_MESSAGES.USER_NOT_FOUND);
  }

  // Create notification for ban/unban
  const action = isActive ? 'unbanned' : 'banned';
  await createAndSendNotification(
    userId,
    NOTIFICATION_TYPE.WARNING,
    `Account ${action}`,
    `Your account has been ${action} by admin. ${isActive ? 'You can now log in.' : 'Please contact support if you have questions.'}`,
    false,
    null
  );

  return user;
};
// #endregion

// #region Staff Management (Admin)
export const getAllStaff = async ({ page = 1, limit = 10, position, isActive }) => {
  // Validate and sanitize pagination
  const safePage = Math.max(parseInt(page) || 1, 1);
  const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
  
  const query = { role: { $in: ['staff', 'admin'] } };

  if (isActive !== undefined) {
    query.isActive = isActive;
  }

  const skip = (safePage - 1) * safeLimit;

  const [users, total] = await Promise.all([
    User.find(query)
      .select('-passwordHash -verificationCode -verificationCodeExpiry')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    User.countDocuments(query),
  ]);

  const userIds = users.map(u => u._id);
  const staffProfiles = await StaffProfile.find({ userId: { $in: userIds } });

  let filteredUsers = users;
  if (position) {
    const filteredProfileIds = staffProfiles
      .filter(p => p.position === position)
      .map(p => p.userId.toString());
    
    filteredUsers = users.filter(u => filteredProfileIds.includes(u._id.toString()));
  }

  const usersWithProfiles = filteredUsers.map(user => {
    const profile = staffProfiles.find(p => p.userId.toString() === user._id.toString());
    return { ...user, profile };
  });

  return {
    users: usersWithProfiles,
    total: position ? filteredUsers.length : total,
    page: safePage,
    pages: Math.ceil((position ? filteredUsers.length : total) / safeLimit),
  };
};

export const getStaffById = async (userId) => {
  const user = await User.findById(userId)
    .select('-passwordHash -verificationCode -verificationCodeExpiry');

  if (!user || !['staff', 'admin'].includes(user.role)) {
    throw new NotFoundError(USER_MESSAGES.USER_NOT_FOUND);
  }

  const staffProfile = await StaffProfile.findOne({ userId });

  return {
    ...user.toObject(),
    profile: staffProfile,
  };
};

export const updateStaffProfile = async (userId, updateData) => {
  const allowedUserFields = ['fullName', 'phone', 'avatar'];
  const allowedProfileFields = ['position']; // Removed salary

  const userUpdateData = {};
  allowedUserFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      userUpdateData[field] = updateData[field];
    }
  });

  const profileUpdateData = {};
  allowedProfileFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      profileUpdateData[field] = updateData[field];
    }
  });

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: userUpdateData },
    { new: true, runValidators: true }
  ).select('-passwordHash -verificationCode -verificationCodeExpiry');

  if (!user) {
    throw new NotFoundError(USER_MESSAGES.USER_NOT_FOUND);
  }

  if (Object.keys(profileUpdateData).length > 0) {
    await StaffProfile.findOneAndUpdate(
      { userId },
      { $set: profileUpdateData },
      { new: true, runValidators: true }
    );
  }

  return user;
};

export const toggleStaffActive = async (userId, isActive) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { isActive } },
    { new: true }
  ).select('-passwordHash -verificationCode -verificationCodeExpiry');

  if (!user || !['staff', 'admin'].includes(user.role)) {
    throw new NotFoundError(USER_MESSAGES.USER_NOT_FOUND);
  }

  await StaffProfile.findOneAndUpdate(
    { userId },
    { $set: { isActive } },
    { new: true }
  );

  // Create notification for ban/unban
  const action = isActive ? 'unbanned' : 'banned';
  await createAndSendNotification(
    userId,
    NOTIFICATION_TYPE.WARNING,
    `Account ${action}`,
    `Your account has been ${action} by admin. ${isActive ? 'You can now log in.' : 'Please contact support if you have questions.'}`,
    false,
    null
  );

  return user;
};
// #endregion
