import mongoose from "mongoose";

const MAX_RETRIES = 5;
const RETRY_INTERVAL = 3000; // 3s

export const connectDB = async () => {
  let retries = 0;

  const connectWithRetry = async () => {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        autoIndex: true, // Tự động build index
        maxPoolSize: 10, // Connection pool
        serverSelectionTimeoutMS: 5000, // Timeout khi không connect được server
        socketTimeoutMS: 45000, // Timeout socket
      });

      console.log("✅ Database connected successfully");
    } catch (error) {
      retries += 1;
      console.error(
        `❌ Database connection failed (attempt ${retries}/${MAX_RETRIES}):`,
        error.message
      );

      if (retries < MAX_RETRIES) {
        console.log(`🔄 Retrying in ${RETRY_INTERVAL / 1000}s...`);
        setTimeout(connectWithRetry, RETRY_INTERVAL);
      } else {
        console.error("🚨 Max retries reached. Exiting process.");
        process.exit(1);
      }
    }
  };

  mongoose.connection.on("connected", () => {
    console.log("📡 Mongoose is connected to MongoDB");
  });

  mongoose.connection.on("error", (err) => {
    console.error("⚠️ Mongoose connection error:", err.message);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("⚡ Mongoose disconnected. Trying to reconnect...");
  });

  connectWithRetry();
};

export default connectDB;
