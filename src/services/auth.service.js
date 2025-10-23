import bcrypt from "bcryptjs";
import Customer from "../models/Customer/customer.model.js";
import Account from "../models/Account/account.model.js";
import { generateVerificationCode, getExpiryTime, isExpired } from "../utils/helpers.js";
import { sendVerificationEmail } from "./email.service.js";
import { AUTH_MESSAGES } from "../utils/constants.js";

/**
 * Auth Service - Xử lý business logic cho authentication
 */
class AuthService {
  /**
   * Đăng ký customer mới
   * @param {Object} userData - { username, email, password, phone, fullName }
   * @returns {Promise<Object>} - Customer object
   */
  async register({ username, email, password, phone, fullName }) {
    // Kiểm tra email đã tồn tại
    const customerExistsEmail = await Customer.findOne({ email });
    if (customerExistsEmail) {
      throw new Error("EMAIL_EXISTS");
    }

    // Kiểm tra username đã tồn tại
    const customerExistsUsername = await Customer.findOne({ username });
    if (customerExistsUsername) {
      throw new Error("USERNAME_EXISTS");
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Tạo verification code
    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = getExpiryTime(15); // 15 phút

    // Tạo customer mới
    const customer = await Customer.create({
      username,
      email,
      passwordHash: hashedPassword,
      phone,
      fullName: fullName || username,
      verificationCode,
      verificationCodeExpires,
      isVerified: false,
    });

    // Gửi email xác thực
    await sendVerificationEmail(email, verificationCode);

    return customer;
  }

  /**
   * Xác thực email
   * @param {string} email - Email
   * @param {string} code - Mã xác thực
   * @returns {Promise<Object>} - Customer object
   */
  async verifyEmail(email, code) {
    const customer = await Customer.findOne({ email });

    if (!customer) {
      throw new Error("USER_NOT_FOUND");
    }

    if (customer.isVerified) {
      throw new Error("ALREADY_VERIFIED");
    }

    // Kiểm tra mã xác thực tồn tại
    if (!customer.verificationCode || !customer.verificationCodeExpires) {
      throw new Error("CODE_NOT_FOUND");
    }

    // Kiểm tra mã hết hạn
    if (isExpired(customer.verificationCodeExpires)) {
      // Clear expired code
      customer.verificationCode = null;
      customer.verificationCodeExpires = null;
      await customer.save();
      throw new Error("CODE_EXPIRED");
    }

    // Kiểm tra mã đúng
    if (customer.verificationCode !== code) {
      throw new Error("INVALID_CODE");
    }

    // Verify thành công
    customer.isVerified = true;
    customer.verificationCode = null;
    customer.verificationCodeExpires = null;
    await customer.save();

    return customer;
  }

  /**
   * Gửi lại mã xác thực
   * @param {string} email - Email
   * @returns {Promise<boolean>}
   */
  async resendVerificationCode(email) {
    const customer = await Customer.findOne({ email });

    if (!customer) {
      throw new Error("USER_NOT_FOUND");
    }

    if (customer.isVerified) {
      throw new Error("ALREADY_VERIFIED");
    }

    // Tạo mã mới
    const newCode = generateVerificationCode();
    customer.verificationCode = newCode;
    customer.verificationCodeExpires = getExpiryTime(15);
    await customer.save();

    // Gửi email
    await sendVerificationEmail(email, newCode);

    return true;
  }

  /**
   * Đăng nhập
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Promise<Object>} - Customer object
   */
  async login(username, password) {
    const customer = await Customer.findOne({ username });

    if (!customer) {
      throw new Error("INVALID_CREDENTIALS");
    }

    if (!customer.isVerified) {
      throw new Error("NOT_VERIFIED");
    }

    // Kiểm tra password
    const isMatch = await bcrypt.compare(password, customer.passwordHash);
    if (!isMatch) {
      throw new Error("INVALID_CREDENTIALS");
    }

    // Update last login
    customer.lastLogin = Date.now();
    await customer.save();

    return customer;
  }

  /**
   * Đăng nhập cho Staff & Admin
   * @param {string} email - Email
   * @param {string} password - Password
   * @returns {Promise<Object>} - Account object
   */
  async loginStaffAdmin(email, password) {
    const account = await Account.findOne({ email });

    if (!account) {
      throw new Error("INVALID_CREDENTIALS");
    }

    // Kiểm tra account có active không
    if (!account.isActive) {
      throw new Error("ACCOUNT_INACTIVE");
    }

    // Kiểm tra password
    const isMatch = await bcrypt.compare(password, account.passwordHash);
    if (!isMatch) {
      throw new Error("INVALID_CREDENTIALS");
    }

    // Update last login
    account.lastLogin = Date.now();
    await account.save();

    return account;
  }

  /**
   * Tìm customer theo ID
   * @param {string} customerId - Customer ID
   * @returns {Promise<Object>} - Customer object
   */
  async findById(customerId) {
    const customer = await Customer.findById(customerId).select("-passwordHash");
    if (!customer) {
      throw new Error("USER_NOT_FOUND");
    }
    return customer;
  }

  /**
   * Cập nhật thông tin customer
   * @param {string} customerId - Customer ID
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Promise<Object>} - Customer object
   */
  async updateUser(customerId, updateData) {
    // Loại bỏ các field không được phép update trực tiếp
    const { passwordHash, verificationCode, verificationCodeExpires, ...allowedData } = updateData;

    const customer = await Customer.findByIdAndUpdate(
      customerId,
      allowedData,
      { new: true, runValidators: true }
    ).select("-passwordHash");

    if (!customer) {
      throw new Error("USER_NOT_FOUND");
    }

    return customer;
  }

  /**
   * Đổi mật khẩu
   * @param {string} customerId - Customer ID
   * @param {string} oldPassword - Mật khẩu cũ
   * @param {string} newPassword - Mật khẩu mới
   * @returns {Promise<boolean>}
   */
  async changePassword(customerId, oldPassword, newPassword) {
    const customer = await Customer.findById(customerId);

    if (!customer) {
      throw new Error("USER_NOT_FOUND");
    }

    // Kiểm tra mật khẩu cũ
    const isMatch = await bcrypt.compare(oldPassword, customer.passwordHash);
    if (!isMatch) {
      throw new Error("INVALID_OLD_PASSWORD");
    }

    // Hash mật khẩu mới
    const salt = await bcrypt.genSalt(10);
    customer.passwordHash = await bcrypt.hash(newPassword, salt);
    await customer.save();

    return true;
  }

  // ============================================
  // ADMIN SETUP
  // ============================================

  /**
   * Tạo tài khoản admin (One-time setup)
   * @param {Object} adminData - { email, password, fullName }
   * @returns {Promise<Object>} - Account object
   */
  async createAdmin({ email, password, fullName }) {
    // Kiểm tra đã có admin chưa
    const existingAdmin = await Account.findOne({ role: "admin" });
    if (existingAdmin) {
      throw new Error("Admin đã tồn tại! Không thể tạo thêm.");
    }

    // Kiểm tra email đã tồn tại
    const accountExists = await Account.findOne({ email });
    if (accountExists) {
      throw new Error("EMAIL_EXISTS");
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Tạo admin account
    const admin = await Account.create({
      email,
      passwordHash: hashedPassword,
      fullName: fullName || "Admin",
      role: "admin",
      isActive: true,
    });

    return admin;
  }

  // ============================================
  // CUSTOMER-SPECIFIC METHODS (NEW)
  // ============================================

  /**
   * Đăng ký customer mới
   * @param {Object} customerData - { fullName, email, password, phone }
   * @returns {Promise<Object>} - Customer object
   */
  async registerCustomer({ fullName, email, password, phone }) {
    // Kiểm tra email đã tồn tại
    const customerExists = await Customer.findOne({ email });
    if (customerExists) {
      throw new Error("EMAIL_EXISTS");
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Tạo verification code
    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = getExpiryTime(15); // 15 phút

    // Tạo customer mới
    const customer = await Customer.create({
      fullName,
      email,
      phone,
      passwordHash,
      verificationCode,
      verificationCodeExpires,
      isVerified: false,
    });

    // Gửi email xác thực
    await sendVerificationEmail(email, verificationCode);

    return customer;
  }

  /**
   * Đăng nhập customer
   * @param {string} email - Email
   * @param {string} password - Password
   * @returns {Promise<Object>} - Customer object
   */
  async loginCustomer(email, password) {
    const customer = await Customer.findOne({ email });

    if (!customer) {
      throw new Error("INVALID_CREDENTIALS");
    }

    if (!customer.isVerified) {
      throw new Error("NOT_VERIFIED");
    }

    if (customer.isBanned) {
      throw new Error("ACCOUNT_BANNED");
    }

    // Kiểm tra password
    const isMatch = await bcrypt.compare(password, customer.passwordHash);
    if (!isMatch) {
      throw new Error("INVALID_CREDENTIALS");
    }

    // Update last login
    customer.lastLogin = Date.now();
    await customer.save();

    return customer;
  }

  /**
   * Xác thực email customer
   * @param {string} email - Email
   * @param {string} code - Mã xác thực
   * @returns {Promise<Object>} - Customer object
   */
  async verifyCustomerEmail(email, code) {
    const customer = await Customer.findOne({ email });

    if (!customer) {
      throw new Error("USER_NOT_FOUND");
    }

    if (customer.isVerified) {
      throw new Error("ALREADY_VERIFIED");
    }

    // Kiểm tra mã xác thực tồn tại
    if (!customer.verificationCode || !customer.verificationCodeExpires) {
      throw new Error("CODE_NOT_FOUND");
    }

    // Kiểm tra mã hết hạn
    if (isExpired(customer.verificationCodeExpires)) {
      customer.verificationCode = null;
      customer.verificationCodeExpires = null;
      await customer.save();
      throw new Error("CODE_EXPIRED");
    }

    // Kiểm tra mã đúng
    if (customer.verificationCode !== code) {
      throw new Error("INVALID_CODE");
    }

    // Verify thành công
    customer.isVerified = true;
    customer.verificationCode = null;
    customer.verificationCodeExpires = null;
    await customer.save();

    return customer;
  }

  /**
   * Gửi lại mã xác thực cho customer
   * @param {string} email - Email
   * @returns {Promise<boolean>}
   */
  async resendCustomerVerificationCode(email) {
    const customer = await Customer.findOne({ email });

    if (!customer) {
      throw new Error("USER_NOT_FOUND");
    }

    if (customer.isVerified) {
      throw new Error("ALREADY_VERIFIED");
    }

    // Tạo mã mới
    const newCode = generateVerificationCode();
    customer.verificationCode = newCode;
    customer.verificationCodeExpires = getExpiryTime(15);
    await customer.save();

    // Gửi email
    await sendVerificationEmail(email, newCode);

    return true;
  }

  // ============================================
  // ACCOUNT-SPECIFIC METHODS (STAFF & ADMIN)
  // ============================================

  /**
   * Tạo account mới (chỉ admin mới có quyền)
   * @param {Object} accountData - { fullName, email, password, phone, role }
   * @returns {Promise<Object>} - Account object
   */
  async createAccount({ fullName, email, password, phone, role }) {
    // Kiểm tra email đã tồn tại
    const accountExists = await Account.findOne({ email });
    if (accountExists) {
      throw new Error("EMAIL_EXISTS");
    }

    // Validate role
    if (!["staff", "admin"].includes(role)) {
      throw new Error("INVALID_ROLE");
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Tạo account mới (không cần verify email)
    const account = await Account.create({
      fullName,
      email,
      phone,
      passwordHash,
      role,
      isActive: true,
    });

    return account;
  }

  /**
   * Đăng nhập account (staff/admin)
   * @param {string} email - Email
   * @param {string} password - Password
   * @returns {Promise<Object>} - Account object
   */
  async loginAccount(email, password) {
    const account = await Account.findOne({ email });

    if (!account) {
      throw new Error("INVALID_CREDENTIALS");
    }

    if (!account.isActive) {
      throw new Error("ACCOUNT_DEACTIVATED");
    }

    // Kiểm tra password
    const isMatch = await bcrypt.compare(password, account.passwordHash);
    if (!isMatch) {
      throw new Error("INVALID_CREDENTIALS");
    }

    // Update last login
    account.lastLogin = Date.now();
    await account.save();

    return account;
  }

  /**
   * Deactivate account
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} - Account object
   */
  async deactivateAccount(accountId) {
    const account = await Account.findById(accountId);
    
    if (!account) {
      throw new Error("USER_NOT_FOUND");
    }

    account.isActive = false;
    await account.save();

    return account;
  }
}

export default new AuthService();
