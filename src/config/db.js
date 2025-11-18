import mongoose from "mongoose";
import logger from "../utils/logger.js";

const MAX_RETRIES = 3;
const RETRY_INTERVAL = 3000; // 3s

export const connectDB = async () => {
  let retries = 0;

  const connectWithRetry = async () => {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        autoIndex: true, // Tự động build index
        maxPoolSize: 10, // Connection pool
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        // Stronger write/read concerns for majority durability in replica sets
        // This ensures that writes are acknowledged by the majority of voting nodes
        // and read operations use a majority-stable view.
        writeConcern: { w: 'majority', wtimeout: 10000 },
        readConcern: { level: 'majority' },
      });

      logger.success("Database connected successfully");
    } catch (error) {
      retries += 1;
      logger.error(
        `Database connection failed (attempt ${retries}/${MAX_RETRIES})`,
        error
      );

      if (retries < MAX_RETRIES) {
        logger.info(`Retrying in ${RETRY_INTERVAL / 1000}s...`);
        setTimeout(connectWithRetry, RETRY_INTERVAL);
      } else {
        logger.error("Max retries reached. Exiting process.");
        process.exit(1);
      }
    }
};

mongoose.connection.on("connected", () => {
  logger.info("Mongoose is connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
  logger.error("Mongoose connection error", err);
});

mongoose.connection.on("disconnected", () => {
  logger.warn("Mongoose disconnected. Trying to reconnect...");
});

  connectWithRetry();
};

export default connectDB;
