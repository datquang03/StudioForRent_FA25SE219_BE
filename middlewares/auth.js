import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import User from "../models/User/user.model.js";

// Generate token
export const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "1d" });
};

