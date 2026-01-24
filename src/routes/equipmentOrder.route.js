import express from 'express';
import {
  createOrder,
  getMyOrders,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  createPayment,
  handlePaymentWebhook,
  getPaymentStatus,
  getOrderPayments,
  refundDeposit,
} from '../controllers/equipmentOrder.controller.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = express.Router();

// Public routes
/**
 * @route   POST /api/equipment-orders/payment/webhook
 * @desc    Handle PayOS webhook for equipment payment
 * @access  Public (PayOS webhook)
 */
router.post('/payment/webhook', handlePaymentWebhook);

// Customer routes
/**
 * @route   POST /api/equipment-orders
 * @desc    Create a new equipment order
 * @access  Customer
 */
router.post('/', protect, authorize(['customer']), createOrder);

/**
 * @route   GET /api/equipment-orders/my-orders
 * @desc    Get all orders for current customer
 * @access  Customer
 */
router.get('/my-orders', protect, authorize(['customer']), getMyOrders);

// Staff/Admin routes
/**
 * @route   GET /api/equipment-orders/all
 * @desc    Get all equipment orders (Staff/Admin)
 * @access  Staff, Admin
 */
router.get('/all', protect, authorize(['staff', 'admin']), getAllOrders);

/**
 * @route   POST /api/equipment-orders/:id/payment
 * @desc    Create payment for equipment order (Full payment only)
 * @access  Customer
 */
router.post('/:id/payment', protect, authorize(['customer', 'staff', 'admin']), createPayment);

/**
 * @route   POST /api/equipment-orders/:id/cancel
 * @desc    Cancel equipment order
 * @access  Customer
 */
router.post('/:id/cancel', protect, authorize(['customer']), cancelOrder);

/**
 * @route   PATCH /api/equipment-orders/:id/status
 * @desc    Update equipment order status
 * @access  Staff, Admin
 */
router.patch('/:id/status', protect, authorize(['staff', 'admin']), updateOrderStatus);

/**
 * @route   POST /api/equipment-orders/:id/refund-deposit
 * @desc    Refund equipment deposit
 * @access  Staff, Admin
 */
router.post('/:id/refund-deposit', protect, authorize(['staff', 'admin']), refundDeposit);

/**
 * @route   GET /api/equipment-orders/:id/payments
 * @desc    Get all payments for an order
 * @access  Customer (own orders), Staff, Admin
 */
router.get('/:id/payments', protect, authorize(['customer', 'staff', 'admin']), getOrderPayments);

/**
 * @route   GET /api/equipment-orders/:id
 * @desc    Get equipment order by ID
 * @access  Customer (own orders), Staff, Admin
 */
router.get('/:id', protect, authorize(['customer', 'staff', 'admin']), getOrderById);

/**
 * @route   GET /api/equipment-orders/payment/:paymentId
 * @desc    Get payment status
 * @access  Customer (own payments), Staff, Admin
 */
router.get('/payment/:paymentId', protect, authorize(['customer', 'staff', 'admin']), getPaymentStatus);

export default router;
