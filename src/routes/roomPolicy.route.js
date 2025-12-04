import express from "express";
import RoomPolicyController from "../controllers/roomPolicy.controller.js";
import { protect, authorize } from "../middlewares/auth.js";
import { searchLimiter } from "../middlewares/rateLimiter.js";
import { USER_ROLES } from "../utils/constants.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Policy CRUD routes
// Read: Admin & Staff
router.get("/", authorize(USER_ROLES.ADMIN, USER_ROLES.STAFF), searchLimiter, RoomPolicyController.getAllPolicies);
router.get("/type/:type", authorize(USER_ROLES.ADMIN, USER_ROLES.STAFF), RoomPolicyController.getPoliciesByType);
router.get("/:policyId", authorize(USER_ROLES.ADMIN, USER_ROLES.STAFF), RoomPolicyController.getPolicyById);

// Write: Admin only
router.post("/", authorize(USER_ROLES.ADMIN), RoomPolicyController.createPolicy);
router.put("/:policyId", authorize(USER_ROLES.ADMIN), RoomPolicyController.updatePolicy);
router.delete("/:policyId", authorize(USER_ROLES.ADMIN), RoomPolicyController.deletePolicy);

// Calculation routes: Admin & Staff
router.post("/:policyId/calculate-refund", authorize(USER_ROLES.ADMIN, USER_ROLES.STAFF), RoomPolicyController.calculateRefund);
router.post("/:policyId/calculate-noshow", authorize(USER_ROLES.ADMIN, USER_ROLES.STAFF), RoomPolicyController.calculateNoShowCharge);

export default router;