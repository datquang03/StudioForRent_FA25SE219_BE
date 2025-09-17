import dotenv from "dotenv";
import nodemailer from "nodemailer";
dotenv.config();
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendVerificationEmail = async (to, code) => {
  const htmlTemplate = `
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
                    width: 100%;
                    height: 50px;
                    line-height: 50px;
                    gap: 10px;  
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
        <p style="font-size: 14px; color: #777;">Nếu bạn không đăng ký tài khoản này, vui lòng bỏ qua email.</p>
      </div>
      <div style="background: #f9fafb; padding: 15px; text-align: center; font-size: 12px; color: #aaa;">
        &copy; ${new Date().getFullYear()} StudioManagement.
      </div>
    </div>
  </div>`;

  try {
    await transporter.sendMail({
      from: `"StudioManage" <${process.env.EMAIL_USER}>`,
      to,
      subject: "Xác thực email - STUDIO MANAGEMENT",
      html: htmlTemplate,
    });
  } catch (error) {
    throw new Error(error.message);
  }
};
