import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import { connectDB } from "./src/config/db.js";
import authRoutes from "./src/routes/auth.route.js";
import customerRoutes from "./src/routes/customer.route.js";
import adminRoutes from "./src/routes/admin.route.js";
import studioRoutes from "./src/routes/studio.route.js";
import logger from "./src/utils/logger.js";
import { errorHandler, notFoundHandler } from "./src/middlewares/errorHandler.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

connectDB();

app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/studios", studioRoutes);

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
