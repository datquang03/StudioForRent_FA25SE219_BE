import mongoose from "mongoose";

const packageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    price: {
      type: Number,
      required: true,
    },
    items: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    studioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Studio",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

const Package = mongoose.model("Package", packageSchema);

export default Package;
