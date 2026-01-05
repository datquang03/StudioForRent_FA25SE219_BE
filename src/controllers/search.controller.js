// #region Imports
import asyncHandler from 'express-async-handler';
import { globalSearch, getSearchSuggestions } from '../services/search.service.js';
import { ValidationError } from '../utils/errors.js';
// #endregion

// #region Global Search Controller
/**
 * POST /api/search
 * Global search across multiple entities
 */
export const globalSearchController = asyncHandler(async (req, res) => {
  const { keyword, entities, limit } = req.body;

  // Validate keyword
  if (!keyword || typeof keyword !== 'string') {
    throw new ValidationError('Từ khóa tìm kiếm là bắt buộc');
  }

  const trimmedKeyword = keyword.trim();
  if (trimmedKeyword.length < 2) {
    throw new ValidationError('Từ khóa tìm kiếm phải có ít nhất 2 ký tự');
  }

  // Validate entities if provided
  if (entities && !Array.isArray(entities)) {
    throw new ValidationError('Entities phải là một mảng');
  }

  // Execute search
  const result = await globalSearch({
    keyword: trimmedKeyword,
    entities,
    limit
  });

  res.status(200).json({
    success: true,
    message: 'Tìm kiếm thành công',
    data: result.results,
    totalResults: result.totalResults,
    searchedEntities: result.searchedEntities,
    keyword: result.keyword
  });
});
// #endregion

// #region Search Suggestions Controller
/**
 * GET /api/search/suggestions
 * Get search suggestions/autocomplete
 */
export const searchSuggestionsController = asyncHandler(async (req, res) => {
  const { keyword, limit } = req.query;

  // Validate keyword
  if (!keyword || typeof keyword !== 'string') {
    throw new ValidationError('Từ khóa tìm kiếm là bắt buộc');
  }

  const trimmedKeyword = keyword.trim();
  if (trimmedKeyword.length < 1) {
    throw new ValidationError('Từ khóa tìm kiếm không được để trống');
  }

  // Get suggestions
  const result = await getSearchSuggestions(trimmedKeyword, parseInt(limit) || 10);

  res.status(200).json({
    success: true,
    data: result
  });
});
// #endregion
