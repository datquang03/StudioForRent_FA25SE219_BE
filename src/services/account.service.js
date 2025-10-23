import Account from "../models/Account/account.model.js";

/**
 * ============================================
 * ACCOUNT SERVICE
 * Xử lý logic liên quan đến Staff/Admin management
 * ============================================
 */

/**
 * @desc    Lấy danh sách tất cả staff/admin (có phân trang, lọc)
 * @param   {Object} options - { page, limit, role, isActive }
 * @returns {Object} { accounts, total, page, pages }
 */
export const getAllStaff = async ({ page = 1, limit = 10, role, isActive }) => {
  const query = {};

  // Lọc theo role (staff hoặc admin)
  if (role) {
    query.role = role;
  }

  // Lọc theo trạng thái active
  if (isActive !== undefined) {
    query.isActive = isActive;
  }

  const skip = (page - 1) * limit;

  const [accounts, total] = await Promise.all([
    Account.find(query)
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Account.countDocuments(query),
  ]);

  return {
    accounts,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
  };
};

/**
 * @desc    Lấy thông tin chi tiết 1 staff/admin
 * @param   {String} accountId - ID của account
 * @returns {Object} Account object
 */
export const getStaffById = async (accountId) => {
  const account = await Account.findById(accountId).select("-passwordHash");

  if (!account) {
    throw new Error("ACCOUNT_NOT_FOUND");
  }

  return account;
};

/**
 * @desc    Cập nhật thông tin staff/admin
 * @param   {String} accountId - ID của account
 * @param   {Object} updateData - { fullName, phone, avatarUrl }
 * @returns {Object} Account object đã cập nhật
 */
export const updateStaff = async (accountId, updateData) => {
  const allowedFields = ["fullName", "phone", "avatarUrl"];
  const filteredData = {};

  // Chỉ cho phép cập nhật các field được phép
  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      filteredData[field] = updateData[field];
    }
  });

  const account = await Account.findByIdAndUpdate(
    accountId,
    { $set: filteredData },
    { new: true, runValidators: true }
  ).select("-passwordHash");

  if (!account) {
    throw new Error("ACCOUNT_NOT_FOUND");
  }

  return account;
};

/**
 * @desc    Admin active/deactive staff
 * @param   {String} accountId - ID của account
 * @param   {Boolean} isActive - true = active, false = deactive
 * @returns {Object} Account object đã cập nhật
 */
export const toggleActiveStaff = async (accountId, isActive) => {
  const account = await Account.findByIdAndUpdate(
    accountId,
    { $set: { isActive } },
    { new: true }
  ).select("-passwordHash");

  if (!account) {
    throw new Error("ACCOUNT_NOT_FOUND");
  }

  return account;
};

/**
 * @desc    Tạo tài khoản staff mới (chỉ admin mới được tạo)
 * @param   {Object} data - { email, password, fullName, phone }
 * @returns {Object} Account object mới
 */
export const createStaff = async ({ email, password, fullName, phone }) => {
  const bcrypt = await import("bcryptjs");

  // Check email đã tồn tại chưa
  const existingAccount = await Account.findOne({ email });
  if (existingAccount) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  // Hash password
  const salt = await bcrypt.default.genSalt(10);
  const passwordHash = await bcrypt.default.hash(password, salt);

  // Tạo staff mới
  const staff = await Account.create({
    email,
    passwordHash,
    fullName,
    phone,
    role: "staff",
    isActive: true,
  });

  return staff;
};
