import express from "express";
import {
  loginUser,
  registerUser,
  resendVerificationCode,
  verifyEmail,
} from "../controllers/User/user.controller.js";
const router = express.Router();
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/verify-email", verifyEmail);
router.post("/resend-code", resendVerificationCode);


export default router;
