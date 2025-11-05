// #region Imports
import Equipment from '../models/Equipment/equipment.model.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { EQUIPMENT_STATUS } from '../utils/constants.js';
// #endregion

// #region Helper Functions
/**
 * Escape special regex characters to prevent regex injection
 */
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Calculate equipment status based on quantities
 * Business logic: Status được xác định dựa trên số lượng các loại equipment
 */
const calculateEquipmentStatus = (equipment) => {
  // Nếu có equipment đang được sử dụng → in_use
  if (equipment.inUseQty > 0) {
    return EQUIPMENT_STATUS.IN_USE;
  }
  
  // Nếu TẤT CẢ đang maintenance → maintenance
  if (equipment.maintenanceQty === equipment.totalQty && equipment.totalQty > 0) {
    return EQUIPMENT_STATUS.MAINTENANCE;
  }
  
  // Còn lại → available (có thể mixed available + maintenance)
  return EQUIPMENT_STATUS.AVAILABLE;
};
// #endregion

// #region Get Equipment
/**
 * Lấy danh sách equipment với pagination, filtering và sorting
 */
export const getAllEquipment = async ({ page = 1, limit = 10, status, search, sortBy = 'createdAt', sortOrder = 'desc' }) => {
  const query = {};

  // Filter by status
  if (status && Object.values(EQUIPMENT_STATUS).includes(status)) {
    query.status = status;
  }

  // Search by name or description (escape regex để tránh injection)
  if (search) {
    const escapedSearch = escapeRegex(search);
    query.$or = [
      { name: { $regex: escapedSearch, $options: 'i' } },
      { description: { $regex: escapedSearch, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  const [equipment, total] = await Promise.all([
    Equipment.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('-__v'),
    Equipment.countDocuments(query),
  ]);

  return {
    equipment,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Lấy equipment theo ID
 */
export const getEquipmentById = async (equipmentId) => {
  const equipment = await Equipment.findById(equipmentId).select('-__v');

  if (!equipment) {
    throw new NotFoundError('Equipment không tồn tại!');
  }

  return equipment;
};

/**
 * Lấy danh sách equipment available (cho customer xem khi booking)
 */
export const getAvailableEquipment = async () => {
  const equipment = await Equipment.find({
    status: EQUIPMENT_STATUS.AVAILABLE,
    availableQty: { $gt: 0 },
  })
    .select('name description pricePerHour availableQty image')
    .sort({ name: 1 });

  return equipment;
};
// #endregion

// #region Create Equipment
/**
 * Tạo equipment mới
 */
export const createEquipment = async (equipmentData) => {
  const { name, description, pricePerHour, totalQty, image } = equipmentData;

  // Validate required fields
  if (!name || pricePerHour === undefined || totalQty === undefined) {
    throw new ValidationError('Vui lòng điền đầy đủ thông tin bắt buộc (name, pricePerHour, totalQty)!');
  }

  // Validate numbers
  if (pricePerHour < 0) {
    throw new ValidationError('Giá thuê phải >= 0!');
  }

  if (totalQty < 0) {
    throw new ValidationError('Số lượng phải >= 0!');
  }

  // Check duplicate name (escape regex để tránh injection)
  const escapedName = escapeRegex(name);
  const existingEquipment = await Equipment.findOne({ name: { $regex: `^${escapedName}$`, $options: 'i' } });
  if (existingEquipment) {
    throw new ValidationError('Tên equipment đã tồn tại!');
  }

  // Create equipment với availableQty = totalQty, inUseQty = 0, maintenanceQty = 0
  const equipment = new Equipment({
    name,
    description,
    pricePerHour,
    totalQty,
    availableQty: totalQty,   // Mặc định available = total
    inUseQty: 0,              // Chưa ai dùng
    maintenanceQty: 0,        // Không có maintenance
    image,
  });

  // Calculate và set status dựa trên quantities (Service layer logic)
  equipment.status = calculateEquipmentStatus(equipment);

  await equipment.save();

  return equipment;
};
// #endregion

// #region Update Equipment
/**
 * Cập nhật thông tin equipment
 */
export const updateEquipment = async (equipmentId, updateData) => {
  const equipment = await Equipment.findById(equipmentId);

  if (!equipment) {
    throw new NotFoundError('Equipment không tồn tại!');
  }

  const { name, description, pricePerHour, totalQty, image } = updateData;

  // Validate if updating name - check duplicate (escape regex để tránh injection)
  if (name && name !== equipment.name) {
    const escapedName = escapeRegex(name);
    const existingEquipment = await Equipment.findOne({
      name: { $regex: `^${escapedName}$`, $options: 'i' },
      _id: { $ne: equipmentId },
    });
    if (existingEquipment) {
      throw new ValidationError('Tên equipment đã tồn tại!');
    }
  }

  // Validate numbers
  if (pricePerHour !== undefined && pricePerHour < 0) {
    throw new ValidationError('Giá thuê phải >= 0!');
  }

  // Handle totalQty update
  if (totalQty !== undefined) {
    if (totalQty < 0) {
      throw new ValidationError('Số lượng phải >= 0!');
    }

    // Validate: totalQty phải >= inUseQty + maintenanceQty
    const requiredQty = equipment.inUseQty + equipment.maintenanceQty;
    
    if (totalQty < requiredQty) {
      throw new ValidationError(
        `Không thể giảm số lượng xuống ${totalQty} vì hiện có ${equipment.inUseQty} đang được sử dụng và ${equipment.maintenanceQty} đang bảo trì!`
      );
    }

    // Update totalQty và recalculate availableQty
    equipment.totalQty = totalQty;
    equipment.availableQty = totalQty - equipment.inUseQty - equipment.maintenanceQty;
  }

  // Update other fields
  if (name) equipment.name = name;
  if (description !== undefined) equipment.description = description;
  if (pricePerHour !== undefined) equipment.pricePerHour = pricePerHour;
  if (image !== undefined) equipment.image = image;

  // Calculate và set status dựa trên quantities (Service layer logic)
  equipment.status = calculateEquipmentStatus(equipment);

  await equipment.save();

  return equipment;
};
// #endregion

// #region Delete Equipment
/**
 * Xóa equipment: chỉ hard delete nếu chưa được sử dụng (inUseQty = 0).
 * Nếu equipment đang được sử dụng, không thể xóa.
 */
export const deleteEquipment = async (equipmentId) => {
  const equipment = await Equipment.findById(equipmentId);

  if (!equipment) {
    throw new NotFoundError('Equipment không tồn tại!');
  }

  // Check nếu đang được sử dụng (có booking thực sự) → KHÔNG CHO XÓA
  if (equipment.inUseQty > 0) {
    throw new ValidationError(
      `Không thể xóa equipment đang được sử dụng (${equipment.inUseQty}/${equipment.totalQty} units đang trong booking)!`
    );
  }

  // Hard delete nếu không có booking nào sử dụng
  await equipment.deleteOne();

  return {
    message: 'Xóa equipment thành công!',
  };
};
// #endregion

// #region Helper Functions
/**
 * Kiểm tra số lượng equipment available
 * Dùng khi tạo booking
 */
export const checkEquipmentAvailability = async (equipmentId, requiredQty) => {
  const equipment = await Equipment.findById(equipmentId);

  if (!equipment) {
    throw new NotFoundError('Equipment không tồn tại!');
  }

  if (equipment.status !== EQUIPMENT_STATUS.AVAILABLE) {
    throw new ValidationError(`Equipment "${equipment.name}" hiện không khả dụng!`);
  }

  if (equipment.availableQty < requiredQty) {
    throw new ValidationError(
      `Equipment "${equipment.name}" chỉ còn ${equipment.availableQty}/${equipment.totalQty} có sẵn!`
    );
  }

  return true;
};

/**
 * Reserve equipment (giảm availableQty, tăng inUseQty khi tạo booking)
 */
export const reserveEquipment = async (equipmentId, quantity) => {
  const equipment = await Equipment.findById(equipmentId);

  if (!equipment) {
    throw new NotFoundError('Equipment không tồn tại!');
  }

  if (equipment.availableQty < quantity) {
    throw new ValidationError(`Không đủ số lượng equipment "${equipment.name}"!`);
  }

  // Update 2 fields
  equipment.availableQty -= quantity;
  equipment.inUseQty += quantity;
  
  // Calculate và set status dựa trên quantities (Service layer logic)
  equipment.status = calculateEquipmentStatus(equipment);
  
  await equipment.save();

  return equipment;
};

/**
 * Release equipment (tăng availableQty, giảm inUseQty khi hủy booking hoặc hoàn thành)
 */
export const releaseEquipment = async (equipmentId, quantity) => {
  const equipment = await Equipment.findById(equipmentId);

  if (!equipment) {
    throw new NotFoundError('Equipment không tồn tại!');
  }

  if (equipment.inUseQty < quantity) {
    throw new ValidationError(
      `Không thể release ${quantity} equipment vì chỉ có ${equipment.inUseQty} đang được sử dụng!`
    );
  }

  // Update 2 fields
  equipment.availableQty += quantity;
  equipment.inUseQty -= quantity;
  
  // Calculate và set status dựa trên quantities (Service layer logic)
  equipment.status = calculateEquipmentStatus(equipment);
  
  await equipment.save();

  return equipment;
};

/**
 * Set số lượng equipment đang bảo trì
 * Staff dùng function này để set bao nhiêu unit đang maintenance
 */
export const setMaintenanceQuantity = async (equipmentId, newMaintenanceQty) => {
  const equipment = await Equipment.findById(equipmentId);

  if (!equipment) {
    throw new NotFoundError('Equipment không tồn tại!');
  }

  // Note: Validation đã được thực hiện ở middleware validateMaintenanceQuantity

  // Calculate số lượng cần điều chỉnh
  const currentMaintenance = equipment.maintenanceQty;
  const diff = newMaintenanceQty - currentMaintenance;

  if (diff > 0) {
    // Tăng maintenance → Lấy từ available
    if (equipment.availableQty < diff) {
      throw new ValidationError(
        `Không đủ equipment available! Chỉ có ${equipment.availableQty} khả dụng, cần ${diff} để set maintenance.`
      );
    }
    
    equipment.availableQty -= diff;
    equipment.maintenanceQty += diff;
  } else if (diff < 0) {
    // Giảm maintenance → Trả về available
    const decreaseAmount = Math.abs(diff);
    equipment.maintenanceQty -= decreaseAmount;
    equipment.availableQty += decreaseAmount;
  }
  // diff = 0 → Không thay đổi gì

  // Calculate và set status dựa trên quantities (Service layer logic)
  equipment.status = calculateEquipmentStatus(equipment);

  await equipment.save();

  return equipment;
};
// #endregion
