import express from "express";
import RoomPolicyController from "../controllers/roomPolicy.controller.js";
import { protect, authorize } from "../middlewares/auth.js";
import { searchLimiter } from "../middlewares/rateLimiter.js";

const router = express.Router();

// All routes require authentication and admin authorization
router.use(protect);
router.use(authorize(['ADMIN']));

// Policy CRUD routes
router.get("/", searchLimiter, RoomPolicyController.getAllPolicies);
router.post("/", RoomPolicyController.createPolicy);
router.get("/type/:type", RoomPolicyController.getPoliciesByType);
router.get("/:policyId", RoomPolicyController.getPolicyById);
router.put("/:policyId", RoomPolicyController.updatePolicy);
router.delete("/:policyId", RoomPolicyController.deletePolicy);

// Calculation routes
router.post("/:policyId/calculate-refund", RoomPolicyController.calculateRefund);
router.post("/:policyId/calculate-noshow", RoomPolicyController.calculateNoShowCharge);

export default router;