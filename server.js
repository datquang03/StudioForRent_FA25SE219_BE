import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import { connectDB } from "./src/config/db.js";
import authRoutes from "./src/routes/auth.route.js";
import customerRoutes from "./src/routes/customer.route.js";
import adminRoutes from "./src/routes/admin.route.js";

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

app.get("/", (req, res) => {
  res.send("🚀 API is running...");
});

app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    success: false,
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
