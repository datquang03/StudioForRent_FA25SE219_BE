import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// ============================================
// EMAIL CONFIGURATION
// ============================================

const EMAIL_CONFIG = {
  SERVICE: "gmail",
  USER: process.env.EMAIL_USER,
  PASS: process.env.EMAIL_PASS,
};

// Create transporter
const transporter = nodemailer.createTransport({
  service: EMAIL_CONFIG.SERVICE,
  auth: {
    user: EMAIL_CONFIG.USER,
    pass: EMAIL_CONFIG.PASS,
  },
});

// ============================================
// EMAIL TEMPLATES
// ============================================

/**
 * Tạo HTML template cho email xác thực
 * @param {string} code - Mã xác thực 6 số
 * @returns {string} - HTML template
 */
const createVerificationEmailTemplate = (code) => {
  return `
  <div style="font-family: Arial, sans-serif; background: #f4f6f8; padding: 30px;">
    <div style="max-width: 500px; margin: auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      <div style="background: linear-gradient(135deg,#6a11cb 0%,#2575fc 100%); padding: 20px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 22px; font-weight: bold; color: white;">Studio Management</h1>
      </div>
      <div style="padding: 30px; text-align: center; color: #333;">
        <h2 style="margin-bottom: 10px;">Xác thực email của bạn</h2>
        <p style="margin-bottom: 20px;">Hãy nhập mã bên dưới vào hệ thống để kích hoạt tài khoản:</p>
        <div style="display: flex; justify-content: center; gap: 10px; margin: 20px 0;">
          ${code
            .split("")
            .map(
              (char) => `
                  <span style="
                    display: inline-block;
                    width: 50px;
                    height: 50px;
                    line-height: 50px;
                    font-size: 32px;
                    font-weight: bold;
                    color: #2575fc;
                    background: #fff;
                    border: 2px solid #2575fc;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(37,117,252,0.15);
                    text-align: center;
                  ">
                    ${char}
                  </span>
                `
            )
            .join("")}
        </div>
        <p style="font-size: 14px; color: #777;">Mã xác thực có hiệu lực trong 15 phút.</p>
        <p style="font-size: 14px; color: #777;">Nếu bạn không đăng ký tài khoản này, vui lòng bỏ qua email.</p>
      </div>
      <div style="background: #f9fafb; padding: 15px; text-align: center; font-size: 12px; color: #aaa;">
        &copy; ${new Date().getFullYear()} StudioManagement. All rights reserved.
      </div>
    </div>
  </div>`;
};

/**
 * Tạo HTML template cho email reset password
 * @param {string} resetLink - Link reset password
 * @returns {string} - HTML template
 */
const createPasswordResetTemplate = (resetLink) => {
  return `
  <div style="font-family: Arial, sans-serif; background: #f4f6f8; padding: 30px;">
    <div style="max-width: 500px; margin: auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      <div style="background: linear-gradient(135deg,#6a11cb 0%,#2575fc 100%); padding: 20px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 22px; font-weight: bold; color: white;">Studio Management</h1>
      </div>
      <div style="padding: 30px; text-align: center; color: #333;">
        <h2 style="margin-bottom: 10px;">Đặt lại mật khẩu</h2>
        <p style="margin-bottom: 20px;">Bạn đã yêu cầu đặt lại mật khẩu. Click vào nút bên dưới để tiếp tục:</p>
        <a href="${resetLink}" style="display: inline-block; padding: 12px 30px; background: #2575fc; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Đặt lại mật khẩu</a>
        <p style="font-size: 14px; color: #777; margin-top: 20px;">Link có hiệu lực trong 1 giờ.</p>
        <p style="font-size: 14px; color: #777;">Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
      </div>
      <div style="background: #f9fafb; padding: 15px; text-align: center; font-size: 12px; color: #aaa;">
        &copy; ${new Date().getFullYear()} StudioManagement. All rights reserved.
      </div>
    </div>
  </div>`;
};

/**
 * Tạo HTML template cho email xác nhận booking
 * @param {Object} bookingDetails - Chi tiết booking
 * @returns {string} - HTML template
 */
const createBookingConfirmationTemplate = (bookingDetails) => {
  return `
  <div style="font-family: Arial, sans-serif; background: #f4f6f8; padding: 30px;">
    <div style="max-width: 500px; margin: auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      <div style="background: linear-gradient(135deg,#6a11cb 0%,#2575fc 100%); padding: 20px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 22px; font-weight: bold; color: white;">Studio Management</h1>
      </div>
      <div style="padding: 30px; color: #333;">
        <h2 style="margin-bottom: 10px; text-align: center;">Xác nhận đặt phòng</h2>
        <p style="margin-bottom: 20px; text-align: center;">Đặt phòng của bạn đã được xác nhận!</p>
        <div style="background: #f9fafb; padding: 15px; border-radius: 5px;">
          <p><strong>Mã đặt phòng:</strong> ${bookingDetails.bookingId}</p>
          <p><strong>Studio:</strong> ${bookingDetails.studioName}</p>
          <p><strong>Ngày:</strong> ${bookingDetails.date}</p>
          <p><strong>Giờ:</strong> ${bookingDetails.time}</p>
          <p><strong>Tổng tiền:</strong> ${bookingDetails.totalAmount} VNĐ</p>
        </div>
        <p style="font-size: 14px; color: #777; margin-top: 20px; text-align: center;">Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!</p>
      </div>
      <div style="background: #f9fafb; padding: 15px; text-align: center; font-size: 12px; color: #aaa;">
        &copy; ${new Date().getFullYear()} StudioManagement. All rights reserved.
      </div>
    </div>
  </div>`;
};

// ============================================
// EMAIL SERVICES
// ============================================

/**
 * Gửi email xác thực
 * @param {string} to - Email người nhận
 * @param {string} code - Mã xác thực 6 số
 */
export const sendVerificationEmail = async (to, code) => {
  try {
    await transporter.sendMail({
      from: `"Studio Management" <${EMAIL_CONFIG.USER}>`,
      to,
      subject: "Xác thực email - STUDIO MANAGEMENT",
      html: createVerificationEmailTemplate(code),
    });
    console.log(`✅ Verification email sent to ${to}`);
  } catch (error) {
    console.error(`❌ Failed to send verification email to ${to}:`, error.message);
    throw new Error(`EMAIL_SEND_FAILED: ${error.message}`);
  }
};

/**
 * Gửi email reset password
 * @param {string} to - Email người nhận
 * @param {string} resetLink - Link reset password
 */
export const sendPasswordResetEmail = async (to, resetLink) => {
  try {
    await transporter.sendMail({
      from: `"Studio Management" <${EMAIL_CONFIG.USER}>`,
      to,
      subject: "Đặt lại mật khẩu - STUDIO MANAGEMENT",
      html: createPasswordResetTemplate(resetLink),
    });
    console.log(`✅ Password reset email sent to ${to}`);
  } catch (error) {
    console.error(`❌ Failed to send password reset email to ${to}:`, error.message);
    throw new Error(`EMAIL_SEND_FAILED: ${error.message}`);
  }
};

/**
 * Gửi email xác nhận booking
 * @param {string} to - Email người nhận
 * @param {Object} bookingDetails - Chi tiết booking
 */
export const sendBookingConfirmationEmail = async (to, bookingDetails) => {
  try {
    await transporter.sendMail({
      from: `"Studio Management" <${EMAIL_CONFIG.USER}>`,
      to,
      subject: "Xác nhận đặt phòng - STUDIO MANAGEMENT",
      html: createBookingConfirmationTemplate(bookingDetails),
    });
    console.log(`✅ Booking confirmation email sent to ${to}`);
  } catch (error) {
    console.error(`❌ Failed to send booking confirmation email to ${to}:`, error.message);
    throw new Error(`EMAIL_SEND_FAILED: ${error.message}`);
  }
};

/**
 * Gửi email notification chung
 * @param {string} to - Email người nhận
 * @param {string} subject - Tiêu đề email
 * @param {string} htmlContent - Nội dung HTML
 */
export const sendEmail = async (to, subject, htmlContent) => {
  try {
    await transporter.sendMail({
      from: `"Studio Management" <${EMAIL_CONFIG.USER}>`,
      to,
      subject,
      html: htmlContent,
    });
    console.log(`✅ Email sent to ${to}`);
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);
    throw new Error(`EMAIL_SEND_FAILED: ${error.message}`);
  }
};

export default {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendBookingConfirmationEmail,
  sendEmail,
};
