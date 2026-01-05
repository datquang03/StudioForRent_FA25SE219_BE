// #region Imports
import express from 'express';
import {
  globalSearchController,
  searchSuggestionsController
} from '../controllers/search.controller.js';
import { sanitizeInput } from '../middlewares/validate.js';
import { searchLimiter } from '../middlewares/rateLimiter.js';
// #endregion

const router = express.Router();

// Apply sanitization and rate limiting to all routes
router.use(sanitizeInput);
router.use(searchLimiter);

// #region Search Routes

/**
 * POST /api/search
 * Global search across multiple entities
 * Body: { keyword: string, entities?: string[], limit?: number }
 * Public route
 */
router.post('/', globalSearchController);

/**
 * GET /api/search/suggestions
 * Get search suggestions/autocomplete
 * Query: ?keyword=string&limit=number
 * Public route
 */
router.get('/suggestions', searchSuggestionsController);

// #endregion

export default router;
