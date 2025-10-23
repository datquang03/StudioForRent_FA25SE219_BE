import mongoose from "mongoose";

const equipmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    studioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Studio",
      required: true,
    },
    status: {
      type: String,
      enum: ["available", "in_use", "maintenance"],
      default: "available",
      required: true,
    },
    price: {
      type: Number,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

const Equipment = mongoose.model("Equipment", equipmentSchema);

export default Equipment;
