// #region Model Exports
/**
 * MODELS INDEX
 * Centralized export cho tất cả models (theo PostgreSQL schema)
 */

// User Management
export { default as User } from './User/user.model.js';
export { default as CustomerProfile } from './User/customerProfile.model.js';
export { default as StaffProfile } from './User/staffProfile.model.js';

// Studio & Resources
export { default as Studio } from './Studio/studio.model.js';
export { default as Equipment } from './Equipment/equipment.model.js';
export { default as Service } from './Service/service.model.js';

// Scheduling & Booking
export { default as Schedule } from './Schedule/schedule.model.js';
export { default as Booking } from './Booking/booking.model.js';
export { default as BookingDetail } from './Booking/bookingDetail.model.js';

// AI Set Design
export { default as SetDesign } from './SetDesign/setDesign.model.js';

// Financial
export { default as Payment } from './Payment/payment.model.js';
export { default as Promotion } from './Promotion/promotion.model.js';

// Policies
export { default as RoomPolicy } from './Policy/roomPolicy.model.js';

// Communication
export { default as Message } from './Message/message.model.js';
export { default as Notification } from './Notification/notification.model.js';

// Feedback & Reporting
export { default as Review } from './Review/review.model.js';
export { default as Report } from './Report/report.model.js';

// #endregion
