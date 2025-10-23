import mongoose from "mongoose";

const policySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["cancellation", "refund", "additional_services"],
      required: true,
      unique: true,
    },
    description: {
      type: String,
      required: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
  }
);

const Policy = mongoose.model("Policy", policySchema);

export default Policy;
