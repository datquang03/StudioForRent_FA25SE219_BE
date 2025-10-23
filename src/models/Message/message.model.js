import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderCustomerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    senderAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
    },
    receiverCustomerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    receiverAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
    },
    content: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Validation để đảm bảo chỉ có một loại sender và một loại receiver
messageSchema.pre("save", function (next) {
  const hasSenderCustomer = !!this.senderCustomerId;
  const hasSenderAccount = !!this.senderAccountId;
  const hasReceiverCustomer = !!this.receiverCustomerId;
  const hasReceiverAccount = !!this.receiverAccountId;

  if (
    (hasSenderCustomer && hasSenderAccount) ||
    (!hasSenderCustomer && !hasSenderAccount)
  ) {
    return next(new Error("Must have exactly one sender type"));
  }

  if (
    (hasReceiverCustomer && hasReceiverAccount) ||
    (!hasReceiverCustomer && !hasReceiverAccount)
  ) {
    return next(new Error("Must have exactly one receiver type"));
  }

  next();
});

// Indexes
messageSchema.index({ createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
