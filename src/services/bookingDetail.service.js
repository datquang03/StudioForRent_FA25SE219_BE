// #region Imports
import BookingDetail from '../models/Booking/bookingDetail.model.js';
import { Equipment, Service } from '../models/index.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { reserveEquipment, releaseEquipment } from './equipment.service.js';
// #endregion

/**
 * Create booking detail items for a booking
 * detailsArray: [{ detailType, equipmentId?, extraServiceId?, quantity }]
 * Returns { details: [BookingDetail], total }
 */
export const createBookingDetails = async (bookingId, detailsArray, session = null) => {
  if (!bookingId) throw new ValidationError('Missing bookingId');
  if (!Array.isArray(detailsArray) || detailsArray.length === 0) {
    throw new ValidationError('detailsArray must be a non-empty array');
  }

  const created = [];
  const reserved = [];
  let total = 0;

  try {
    for (const item of detailsArray) {
      const { detailType, equipmentId, extraServiceId, quantity = 1 } = item;

      if (!detailType) throw new ValidationError('detailType is required');
      if (quantity <= 0) throw new ValidationError('quantity must be >= 1');

      if (detailType === 'equipment') {
        if (!equipmentId) throw new ValidationError('equipmentId is required for equipment detail');

        const equipment = await Equipment.findById(equipmentId);
        if (!equipment) throw new NotFoundError('Equipment not found');

        // Reserve equipment (atomic)
        await reserveEquipment(equipmentId, quantity, session);
        reserved.push({ equipmentId, quantity });

        const pricePerUnit = equipment.pricePerHour || 0;
        const subtotal = pricePerUnit * quantity;

        const [detail] = await BookingDetail.create([
          {
            bookingId,
            detailType,
            equipmentId,
            description: equipment.name,
            quantity,
            pricePerUnit,
            subtotal,
          }
        ], { session });

        created.push(detail);
        total += subtotal;
      } else if (detailType === 'extra_service') {
        if (!extraServiceId) throw new ValidationError('extraServiceId is required for extra_service detail');

        const svc = await Service.findById(extraServiceId);
        if (!svc) throw new NotFoundError('Service not found');

        // Service must be available/active
        if (!svc.isAvailable) {
          throw new ValidationError(`Service "${svc.name}" is not available`);
        }

        const pricePerUnit = svc.pricePerUse || 0;
        const subtotal = pricePerUnit * quantity;

        const [detail] = await BookingDetail.create([
          {
            bookingId,
            detailType,
            extraServiceId,
            description: svc.name,
            quantity,
            pricePerUnit,
            subtotal,
          }
        ], { session });

        created.push(detail);
        total += subtotal;
      } else {
        throw new ValidationError('Invalid detailType');
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
          // eslint-disable-next-line no-console
          console.error('Failed to release equipment during rollback', releaseErr);
        }
      }
    } catch (rollbackErr) {
      // eslint-disable-next-line no-console
      console.error('Rollback failed', rollbackErr);
    }

    throw err;
  }
};

export default {
  createBookingDetails,
};

/**
 * Remove booking details by IDs for a booking and release equipment
 * detailIds: array of BookingDetail _id
 * Returns { removedTotal }
 */
export const removeBookingDetails = async (bookingId, detailIds, session = null) => {
  if (!bookingId) throw new ValidationError('Missing bookingId');
  if (!Array.isArray(detailIds) || detailIds.length === 0) {
    throw new ValidationError('detailIds must be a non-empty array');
  }

  const query = BookingDetail.find({ bookingId, _id: { $in: detailIds } });
  if (session) query.session(session);
  const toRemove = await query.lean();
  if (!toRemove || toRemove.length === 0) return { removedTotal: 0 };

  let removedTotal = 0;

  for (const d of toRemove) {
    // If equipment, release reserved units
    if (d.detailType === 'equipment' && d.equipmentId) {
      try {
        await releaseEquipment(d.equipmentId, d.quantity, session);
      } catch (err) {
        // log and continue
        // eslint-disable-next-line no-console
        console.error('Failed to release equipment during removeBookingDetails', err);
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
};

