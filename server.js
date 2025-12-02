import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { Server } from "socket.io";
import { createServer } from "http";
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
import notificationRoutes from "./src/routes/notification.route.js";
import analyticsRoutes from "./src/routes/analytics.route.js";
import messageRoutes from "./src/routes/message.route.js";
import bookingRoutes from "./src/routes/booking.route.js";
import scheduleRoutes from "./src/routes/schedule.route.js";
import paymentRoutes from "./src/routes/payment.route.js";
import setDesignRoutes from "./src/routes/setDesign.route.js";
import commentRoutes from "./src/routes/comment.route.js";
import roomPolicyRoutes from "./src/routes/roomPolicy.route.js";
import reportRoutes from "./src/routes/report.route.js";
import reviewRoutes from "./src/routes/review.route.js";
import logger from "./src/utils/logger.js";
import { errorHandler, notFoundHandler } from "./src/middlewares/errorHandler.js";
import { socketAuth, handleSocketConnection } from "./src/middlewares/socket.js";
import { validateEnvironmentVariables } from "./src/utils/helpers.js";

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'MONGODB_URI', 'EMAIL_USER', 'EMAIL_PASS'];
if (!validateEnvironmentVariables(requiredEnvVars)) {
  process.exit(1);
}

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});
const PORT = process.env.PORT || 8000;

app.set('trust proxy', 1);

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

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
app.use("/api/notifications", notificationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/set-designs", setDesignRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/room-policies", roomPolicyRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/reviews", reviewRoutes);

// Setup Socket.io with authentication
io.use(socketAuth);
handleSocketConnection(io);

// Attach io to req for controllers
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Background jobs (no-show, reminders, etc.) should NOT be started
// from the web server process. Start jobs via the dedicated worker:
//   `npm run worker` which runs `src/jobs/worker.js`.
// This file intentionally does not initialize schedulers or cron jobs.

app.get("/", (req, res) => {
  res.send("🚀 API is running...");
});

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

server.listen(PORT, () => {
  logger.success(`Server is running on http://localhost:${PORT}`);
});

export { io };
