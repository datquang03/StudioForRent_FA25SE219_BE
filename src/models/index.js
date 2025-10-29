/**
 * MODELS INDEX
 * Centralized export cho tất cả models (theo PostgreSQL schema)
 */

// === USER MANAGEMENT ===
export { default as User } from './User/user.model.js';
export { default as CustomerProfile } from './User/customerProfile.model.js';
export { default as StaffProfile } from './User/staffProfile.model.js';

// === STUDIO & RESOURCES ===
export { default as Studio } from './Studio/studio.model.js';
export { default as Equipment } from './Equipment/equipment.model.js';
export { default as Service } from './Service/service.model.js';

// === SCHEDULING & BOOKING ===
export { default as Schedule } from './Schedule/schedule.model.js';
export { default as Booking } from './Booking/booking.model.js';
export { default as BookingDetail } from './Booking/bookingDetail.model.js';

// === AI SET DESIGN ===
export { default as SetDesign } from './SetDesign/setDesign.model.js';

// === FINANCIAL ===
export { default as Payment } from './Payment/payment.model.js';
export { default as Promotion } from './Promotion/promotion.model.js';
export { default as Refund } from './Refund/refund.model.js';

// === POLICIES ===
export { default as CancellationPolicy } from './Policy/cancellationPolicy.model.js';

// === COMMUNICATION ===
export { default as Message } from './Message/message.model.js';
export { default as Notification } from './Notification/notification.model.js';

// === FEEDBACK & REPORTING ===
export { default as Review } from './Review/review.model.js';
export { default as Report } from './Report/report.model.js';

// === OPTIONAL (Giữ lại - không có trong PostgreSQL) ===
export { default as Analytics } from './Analytics/analytics.model.js';
export { default as Package } from './Package/package.model.js';
