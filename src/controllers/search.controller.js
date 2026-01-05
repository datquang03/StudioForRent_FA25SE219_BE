// #region Imports
import asyncHandler from 'express-async-handler';
import { globalSearch, getSearchSuggestions } from '../services/search.service.js';
import { ValidationError } from '../utils/errors.js';
import { createResponse } from '../utils/helpers.js';
// #endregion

// #region Global Search Controller
/**
 * POST /api/search
 * Global search across multiple entities
 */
export const globalSearchController = asyncHandler(async (req, res) => {
  const { keyword, entities, limit } = req.body;

  // Validate entities if provided (keyword validation moved to service layer)
  if (entities && !Array.isArray(entities)) {
    throw new ValidationError('Entities phải là một mảng');
  }

  // Execute search (service handles keyword validation)
  const result = await globalSearch({
    keyword,
    entities,
    limit
  });

  res.status(200).json(
    createResponse(true, 'Tìm kiếm thành công', {
      data: result.results,
      totalResults: result.totalResults,
      searchedEntities: result.searchedEntities,
      keyword: result.keyword
    })
  );
});
// #endregion

// #region Search Suggestions Controller
/**
 * GET /api/search/suggestions
 * Get search suggestions/autocomplete
 */
export const searchSuggestionsController = asyncHandler(async (req, res) => {
  const { keyword, limit } = req.query;

  // Get suggestions (service handles keyword validation)
  const result = await getSearchSuggestions(keyword, parseInt(limit) || 10);

  res.status(200).json(
    createResponse(true, 'Lấy gợi ý thành công', result)
  );
});
// #endregion
