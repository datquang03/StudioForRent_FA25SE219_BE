// #region Imports
import { User, CustomerProfile, StaffProfile } from '../models/index.js';
// #endregion

// #region Customer Profile Management
export const getCustomerProfile = async (userId) => {
  const user = await User.findById(userId)
    .select('-passwordHash -verificationCode -verificationCodeExpiry');

  if (!user) {
    throw new Error('USER_NOT_FOUND');
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
    throw new Error('USER_NOT_FOUND');
  }

  if (Object.keys(profileUpdateData).length > 0) {
    await CustomerProfile.findOneAndUpdate(
      { userId },
      { $set: profileUpdateData },
      { new: true, runValidators: true }
    );
  }

  return user;
};
// #endregion

// #region Customer List & Search (Admin)
export const getAllCustomers = async ({ page = 1, limit = 10, isActive, search }) => {
  const query = { role: 'customer' };

  if (isActive !== undefined) {
    query.isActive = isActive;
  }

  if (search) {
    query.$or = [
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { fullName: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find(query)
      .select('-passwordHash -verificationCode -verificationCodeExpiry')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(query),
  ]);

  return {
    users,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
  };
};

export const getCustomerById = async (userId) => {
  const user = await User.findById(userId)
    .select('-passwordHash -verificationCode -verificationCodeExpiry');

  if (!user || user.role !== 'customer') {
    throw new Error('USER_NOT_FOUND');
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
    throw new Error('USER_NOT_FOUND');
  }

  return user;
};
// #endregion

// #region Staff Management (Admin)
export const getAllStaff = async ({ page = 1, limit = 10, position, isActive }) => {
  const query = { role: { $in: ['staff', 'admin'] } };

  if (isActive !== undefined) {
    query.isActive = isActive;
  }

  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find(query)
      .select('-passwordHash -verificationCode -verificationCodeExpiry')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
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
    page: parseInt(page),
    pages: Math.ceil((position ? filteredUsers.length : total) / limit),
  };
};

export const getStaffById = async (userId) => {
  const user = await User.findById(userId)
    .select('-passwordHash -verificationCode -verificationCodeExpiry');

  if (!user || !['staff', 'admin'].includes(user.role)) {
    throw new Error('USER_NOT_FOUND');
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
    throw new Error('USER_NOT_FOUND');
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
    throw new Error('USER_NOT_FOUND');
  }

  await StaffProfile.findOneAndUpdate(
    { userId },
    { $set: { isActive } },
    { new: true }
  );

  return user;
};
// #endregion
