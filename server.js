import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { connectDB } from "./src/config/db.js";
import authRoutes from "./src/routes/auth.route.js";
import customerRoutes from "./src/routes/customer.route.js";
import adminRoutes from "./src/routes/admin.route.js";
import staffRoutes from "./src/routes/staff.route.js";
import studioRoutes from "./src/routes/studio.route.js";
import equipmentRoutes from "./src/routes/equipment.route.js";
import serviceRoutes from "./src/routes/service.route.js";
import promotionRoutes from "./src/routes/promotion.route.js";
import uploadRoutes from "./src/routes/upload.route.js";
import logger from "./src/utils/logger.js";
import { errorHandler, notFoundHandler } from "./src/middlewares/errorHandler.js";

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'MONGODB_URI', 'EMAIL_USER', 'EMAIL_PASS'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  logger.error('Please create a .env file with these variables');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

connectDB();

// Ensure upload temp directory exists
const uploadTempDir = path.join(process.cwd(), 'uploads', 'temp');
if (!fs.existsSync(uploadTempDir)) {
  fs.mkdirSync(uploadTempDir, { recursive: true });
  logger.info('Created uploads/temp directory');
}

app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/studios", studioRoutes);
app.use("/api/equipment", equipmentRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/promotions", promotionRoutes);
app.use("/api/upload", uploadRoutes);

app.get("/", (req, res) => {
  res.send("🚀 API is running...");
});

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

app.listen(PORT, () => {
  logger.success(`Server is running on http://localhost:${PORT}`);
});
