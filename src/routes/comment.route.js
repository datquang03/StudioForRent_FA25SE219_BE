import express from 'express';
import { likeCommentController, unlikeCommentController } from '../controllers/setDesign.controller.js';
import { protect } from '../middlewares/auth.js';
import { sanitizeInput } from '../middlewares/validate.js';
import { generalLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// Apply middleware to all routes
router.use(sanitizeInput);
router.use(generalLimiter);
router.use(protect); // All comment routes require authentication

// Like/Unlike comment
router.post('/:commentId/like', likeCommentController);
router.delete('/:commentId/like', unlikeCommentController);

export default router;
