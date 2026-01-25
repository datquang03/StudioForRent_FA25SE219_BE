// #region Imports
import BookingDetail from '../models/Booking/bookingDetail.model.js';
import { Equipment, Service } from '../models/index.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { reserveEquipment, releaseEquipment } from './equipment.service.js';
import logger from '../utils/logger.js';
// #endregion

/**
 * Create booking detail items for a booking
 * detailsArray: [{ detailType, equipmentId?, extraServiceId?, quantity }]
 * Returns { details: [BookingDetail], total }
 */
export const createBookingDetails = async (bookingId, detailsArray, session = null, durationHours = 1) => {
  try {
    if (!bookingId) {
      throw new ValidationError('ID booking là bắt buộc');
    }
    if (!Array.isArray(detailsArray) || detailsArray.length === 0) {
      throw new ValidationError('Danh sách chi tiết phải là mảng không rỗng');
    }

    const created = [];
    const reserved = [];
    let total = 0;

    try {
      // Validate durationHours
      const validDuration = (typeof durationHours === 'number' && durationHours > 0) ? durationHours : 1;
      if (validDuration !== durationHours) {
        logger.warn(`Invalid durationHours passed to createBookingDetails: ${durationHours}. Defaulting to 1.`);
      }

      for (const item of detailsArray) {
        const { detailType, equipmentId, extraServiceId, quantity = 1 } = item;

        if (!detailType) {
          throw new ValidationError('Loại chi tiết là bắt buộc');
        }
        if (isNaN(quantity) || quantity <= 0) {
          throw new ValidationError('Số lượng phải lớn hơn hoặc bằng 1');
        }

        if (detailType === 'equipment') {
          if (!equipmentId) {
            throw new ValidationError('ID thiết bị là bắt buộc cho chi tiết thiết bị');
          }

          const equipment = await Equipment.findById(equipmentId);
          if (!equipment) {
            throw new NotFoundError('Thiết bị không tồn tại');
          }

          // Check if equipment is available
          if (equipment.availableQty <= 0) {
            throw new ValidationError(`Thiết bị "${equipment.name}" không khả dụng`);
          }

          // Validate quantity against available stock
          if (quantity > equipment.availableQty) {
            throw new ValidationError(`Số lượng thiết bị yêu cầu (${quantity}) vượt quá số lượng khả dụng (${equipment.availableQty})`);
          }

        // Reserve equipment (atomic)
        await reserveEquipment(equipmentId, quantity, session);
        reserved.push({ equipmentId, quantity });

        const pricePerUnit = equipment.pricePerHour || 0;
        const subtotal = pricePerUnit * quantity;

        const [detail] = await BookingDetail.create(
          [
            {
              bookingId,
              detailType,
              equipmentId,
              description: equipment.name,
              quantity,
              pricePerUnit,
              subtotal,
            },
          ],
          { session },
        );

        created.push(detail);
        total += subtotal;
        } else if (detailType === 'extra_service') {
          if (!extraServiceId) {
            throw new ValidationError('ID dịch vụ là bắt buộc cho chi tiết dịch vụ');
          }

          const svc = await Service.findById(extraServiceId);
          if (!svc) {
            throw new NotFoundError('Dịch vụ không tồn tại');
          }

          // Service must be available/active
          if (!svc.isAvailable) {
            throw new ValidationError(`Dịch vụ "${svc.name}" không khả dụng`);
          }

        const pricePerUnit = svc.pricePerUse || 0;
        const subtotal = pricePerUnit * quantity;

        const [detail] = await BookingDetail.create(
          [
            {
              bookingId,
              detailType,
              extraServiceId,
              description: svc.name,
              quantity,
              pricePerUnit,
              subtotal,
            },
          ],
          { session },
        );

          created.push(detail);
          total += subtotal;
        } else {
          throw new ValidationError('Loại chi tiết không hợp lệ. Chọn từ: equipment, extra_service');
        }
      }

      return { details: created, total };
    } catch (err) {
    // Rollback: delete created details and release reserved equipment
    try {
      if (created.length > 0) {
          const ids = created.map((d) => d._id);
          if (session) {
            await BookingDetail.deleteMany({ _id: { $in: ids } }).session(session);
          } else {
            await BookingDetail.deleteMany({ _id: { $in: ids } });
          }
      }
      for (const r of reserved) {
        try {
          await releaseEquipment(r.equipmentId, r.quantity);
        } catch (releaseErr) {
          // log & continue
          logger.error('Failed to release equipment during rollback', releaseErr);
        }
      }
    } catch (rollbackErr) {
        logger.error('Rollback failed', rollbackErr);
      }

      throw err;
    }
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    logger.error('Error in createBookingDetails:', error);
    throw new Error(error.message || 'Lỗi khi tạo chi tiết booking');
  }
};

export const removeBookingDetails = async (bookingId, detailIds, session = null) => {
  try {
    if (!bookingId) {
      throw new ValidationError('ID booking là bắt buộc');
    }
    if (!Array.isArray(detailIds) || detailIds.length === 0) {
      throw new ValidationError('Danh sách ID chi tiết phải là mảng không rỗng');
    }

    const query = BookingDetail.find({ bookingId, _id: { $in: detailIds } });
    if (session) query.session(session);
    const toRemove = await query.lean();
    if (!toRemove || toRemove.length === 0) {
      return { removedTotal: 0 };
    }

  let removedTotal = 0;

  for (const d of toRemove) {
    // If equipment, release reserved units
    if (d.detailType === 'equipment' && d.equipmentId) {
      try {
        await releaseEquipment(d.equipmentId, d.quantity, session);
      } catch (err) {
        // log and continue
        logger.error('Failed to release equipment during removeBookingDetails', err);
      }
    }
    removedTotal += d.subtotal || 0;
  }

    // Delete the details
    if (session) {
      await BookingDetail.deleteMany({ bookingId, _id: { $in: detailIds } }).session(session);
    } else {
      await BookingDetail.deleteMany({ bookingId, _id: { $in: detailIds } });
    }

    return { removedTotal };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    logger.error('Error in removeBookingDetails:', error);
    throw new Error('Lỗi khi xóa chi tiết booking');
  }
};

export default {
  createBookingDetails,
  removeBookingDetails,
};

