import User from "../../models/User/user.model.js";
import asyncHandler from "express-async-handler";
import bcrypt from "bcryptjs";
import { sendVerificationEmail } from "../../utils/EmailVerification.js";

// Sinh mã ngẫu nhiên 6 số
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Regex kiểm tra email hợp lệ
const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

// Regex kiểm tra mật khẩu mạnh (>=8, có chữ hoa, chữ thường, số)
const isValidPassword = (password) => {
  const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return re.test(password);
};

// 📌 Đăng ký
export const registerUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!username) return res.status(400).json({ message: "Vui lòng điền tên đăng nhập!" });
  if (!email) return res.status(400).json({ message: "Vui lòng điền email!" });
  if (!password) return res.status(400).json({ message: "Vui lòng điền mật khẩu!" });

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Email không hợp lệ!" });
  }

  if (!isValidPassword(password)) {
    return res.status(400).json({ message: "Mật khẩu phải ít nhất 8 ký tự, có chữ hoa, chữ thường và số!" });
  }

  const userExistsEmail = await User.findOne({ email });
  if (userExistsEmail) {
    return res.status(400).json({ message: "Email đã được sử dụng!" });
  }

  const userExistsUsername = await User.findOne({ username });
  if (userExistsUsername) {
    return res.status(400).json({ message: "Tên đăng nhập đã tồn tại!" });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const verificationCode = generateVerificationCode();
  const verificationCodeExpires = Date.now() + 15 * 60 * 1000; // 15 phút

  const user = await User.create({
    username,
    email,
    password: hashedPassword,
    verificationCode,
    verificationCodeExpires,
    isVerified: false,
  });

  if (user) {
    await sendVerificationEmail(email, verificationCode);
    res.status(201).json({
      message: "Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.",
    });
  } else {
    res.status(400).json({ message: "Thông tin không hợp lệ!" });
  }
});

// 📌 Xác thực email
export const verifyEmail = asyncHandler(async (req, res) => {
  const { email, code } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: "Người dùng không tồn tại!" });

  if (user.isVerified) {
    return res.status(400).json({ message: "Tài khoản đã được xác thực!" });
  }

  // Kiểm tra mã xác thực và thời gian hết hạn
  if (
    !user.verificationCode ||
    !user.verificationCodeExpires ||
    user.verificationCodeExpires < Date.now()
  ) {
    user.verificationCode = null;
    user.verificationCodeExpires = null;
    await user.save();
    return res.status(400).json({ message: "Mã xác thực đã hết hạn, vui lòng gửi lại mã mới!" });
  }

  if (user.verificationCode !== code) {
    return res.status(400).json({ message: "Mã xác thực không đúng!" });
  }

  user.isVerified = true;
  user.verificationCode = null;
  user.verificationCodeExpires = null;
  await user.save();

  res.status(200).json({ message: "Xác thực email thành công!" });
});

// 📌 Gửi lại mã xác thực
export const resendVerificationCode = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: "Người dùng không tồn tại!" });

  if (user.isVerified) {
    return res.status(400).json({ message: "Tài khoản đã được xác thực!" });
  }

  const newCode = generateVerificationCode();
  user.verificationCode = newCode;
  user.verificationCodeExpires = Date.now() + 15 * 60 * 1000; // 15 phút
  await user.save();

  await sendVerificationEmail(email, newCode);

  res.status(200).json({ message: "Mã xác thực mới đã được gửi đến email của bạn." });
});

// 📌 Đăng nhập
export const loginUser = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username) return res.status(400).json({ message: "Vui lòng nhập tên đăng nhập!" });
  if (!password) return res.status(400).json({ message: "Vui lòng nhập mật khẩu!" });

  const user = await User.findOne({ username });
  if (!user) {
    return res.status(400).json({ message: "Tên đăng nhập không tồn tại!" });
  }

  if (!user.isVerified) {
    return res.status(400).json({ message: "Tài khoản chưa được xác thực, vui lòng kiểm tra email!" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).json({ message: "Mật khẩu không chính xác!" });
  }

  // Nếu login thành công
  const token = generateToken(user._id, user.role);
  res.status(200).json({
    message: "Đăng nhập thành công!",
    token,
    user: {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  });
});