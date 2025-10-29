import mongoose from "mongoose";

/**
 * BOOKING DETAIL MODEL
 * Chi tiết thiết bị và dịch vụ cho booking - VỚI QUANTITY & SUBTOTAL
 * Theo PostgreSQL schema: booking_equipments và booking_extra_services
 */
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
    // Equipment với quantity và subtotal
    equipments: [{
      equipmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Equipment",
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
        min: 1,
      },
      subtotal: {
        type: Number,
        required: true,
        min: 0,
      },
    }],
    // Services với subtotal
    services: [{
      serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
        required: true,
      },
      subtotal: {
        type: Number,
        required: true,
        min: 0,
      },
    }],
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
