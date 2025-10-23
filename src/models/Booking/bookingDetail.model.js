import mongoose from "mongoose";

const bookingDetailSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    studioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Studio",
      required: true,
    },
    equipmentIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Equipment",
      default: [],
    },
    serviceIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Service",
      default: [],
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
bookingDetailSchema.index({ bookingId: 1 });
bookingDetailSchema.index({ studioId: 1 });

const BookingDetail = mongoose.model("BookingDetail", bookingDetailSchema);

export default BookingDetail;
