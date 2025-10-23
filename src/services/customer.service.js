import Customer from "../models/Customer/customer.model.js";

/**
 * ============================================
 * CUSTOMER SERVICE
 * Xử lý logic liên quan đến Customer management
 * ============================================
 */

/**
 * @desc    Lấy thông tin profile của customer
 * @param   {String} customerId - ID của customer
 * @returns {Object} Customer object (không bao gồm sensitive data)
 */
export const getCustomerProfile = async (customerId) => {
  const customer = await Customer.findById(customerId).select(
    "-passwordHash -verificationCode -verificationCodeExpires"
  );

  if (!customer) {
    throw new Error("USER_NOT_FOUND");
  }

  return customer;
};

/**
 * @desc    Lấy danh sách tất cả customers (có phân trang, tìm kiếm, lọc)
 * @param   {Object} options - { page, limit, isBanned, search }
 * @returns {Object} { customers, total, page, pages }
 */
export const getAllCustomers = async ({ page = 1, limit = 10, isBanned, search }) => {
  const query = {};

  // Lọc theo trạng thái banned
  if (isBanned !== undefined) {
    query.isBanned = isBanned;
  }

  // Tìm kiếm theo username, email, fullName
  if (search) {
    query.$or = [
      { username: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { fullName: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;

  const [customers, total] = await Promise.all([
    Customer.find(query)
      .select("-passwordHash -verificationCode -verificationCodeExpires")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Customer.countDocuments(query),
  ]);

  return {
    customers,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
  };
};

/**
 * @desc    Lấy thông tin chi tiết 1 customer (cho admin)
 * @param   {String} customerId - ID của customer
 * @returns {Object} Customer object
 */
export const getCustomerById = async (customerId) => {
  const customer = await Customer.findById(customerId).select(
    "-passwordHash -verificationCode -verificationCodeExpires"
  );

  if (!customer) {
    throw new Error("USER_NOT_FOUND");
  }

  return customer;
};

/**
 * @desc    Cập nhật thông tin profile của customer
 * @param   {String} customerId - ID của customer
 * @param   {Object} updateData - { fullName, phone, avatarUrl, preferences }
 * @returns {Object} Customer object đã cập nhật
 */
export const updateCustomerProfile = async (customerId, updateData) => {
  const allowedFields = ["fullName", "phone", "avatarUrl", "preferences"];
  const filteredData = {};

  // Chỉ cho phép cập nhật các field được phép
  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      filteredData[field] = updateData[field];
    }
  });

  const customer = await Customer.findByIdAndUpdate(
    customerId,
    { $set: filteredData },
    { new: true, runValidators: true }
  ).select("-passwordHash -verificationCode -verificationCodeExpires");

  if (!customer) {
    throw new Error("USER_NOT_FOUND");
  }

  return customer;
};

/**
 * @desc    Admin ban/unban customer
 * @param   {String} customerId - ID của customer
 * @param   {Boolean} isBanned - true = ban, false = unban
 * @returns {Object} Customer object đã cập nhật
 */
export const toggleBanCustomer = async (customerId, isBanned) => {
  const customer = await Customer.findByIdAndUpdate(
    customerId,
    { $set: { isBanned } },
    { new: true }
  ).select("-passwordHash -verificationCode -verificationCodeExpires");

  if (!customer) {
    throw new Error("USER_NOT_FOUND");
  }

  return customer;
};
