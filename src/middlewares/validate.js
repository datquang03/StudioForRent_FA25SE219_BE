import { isValidEmail, isValidPassword, isNotEmpty } from "../utils/validators.js";
import { VALIDATION_MESSAGES } from "../utils/constants.js";
import { createResponse } from "../utils/helpers.js";

/**
 * Validate dữ liệu đăng ký
 */
export const validateRegister = (req, res, next) => {
  const { username, email, password } = req.body;

  // Check required fields
  if (!isNotEmpty(username)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.REQUIRED_USERNAME)
    );
  }

  if (!isNotEmpty(email)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.REQUIRED_EMAIL)
    );
  }

  if (!isNotEmpty(password)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.REQUIRED_PASSWORD)
    );
  }

  // Validate email format
  if (!isValidEmail(email)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.INVALID_EMAIL)
    );
  }

  // Validate password strength
  if (!isValidPassword(password)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.WEAK_PASSWORD)
    );
  }

  next();
};

/**
 * Validate dữ liệu đăng nhập
 */
export const validateLogin = (req, res, next) => {
  const { username, password } = req.body;

  if (!isNotEmpty(username)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.REQUIRED_USERNAME)
    );
  }

  if (!isNotEmpty(password)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.REQUIRED_PASSWORD)
    );
  }

  next();
};

/**
 * Validate dữ liệu xác thực email
 */
export const validateVerifyEmail = (req, res, next) => {
  const { email, code } = req.body;

  if (!isNotEmpty(email)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.REQUIRED_EMAIL)
    );
  }

  if (!isValidEmail(email)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.INVALID_EMAIL)
    );
  }

  if (!isNotEmpty(code)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.REQUIRED_CODE)
    );
  }

  if (code.length !== 6) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.INVALID_CODE_LENGTH)
    );
  }

  next();
};

/**
 * Validate email cho resend code
 */
export const validateResendCode = (req, res, next) => {
  const { email } = req.body;

  if (!isNotEmpty(email)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.REQUIRED_EMAIL)
    );
  }

  if (!isValidEmail(email)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.INVALID_EMAIL)
    );
  }

  next();
};

/**
 * Validate dữ liệu đổi mật khẩu
 */
export const validateChangePassword = (req, res, next) => {
  const { oldPassword, newPassword } = req.body;

  if (!isNotEmpty(oldPassword)) {
    return res.status(400).json(
      createResponse(false, "Vui lòng điền mật khẩu cũ!")
    );
  }

  if (!isNotEmpty(newPassword)) {
    return res.status(400).json(
      createResponse(false, "Vui lòng điền mật khẩu mới!")
    );
  }

  if (!isValidPassword(newPassword)) {
    return res.status(400).json(
      createResponse(false, VALIDATION_MESSAGES.WEAK_PASSWORD)
    );
  }

  next();
};

/**
 * Validate ObjectId
 */
export const validateObjectId = (paramName = "id") => {
  return (req, res, next) => {
    const id = req.params[paramName];
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;

    if (!objectIdPattern.test(id)) {
      return res.status(400).json(
        createResponse(false, `${paramName} không hợp lệ!`)
      );
    }

    next();
  };
};
