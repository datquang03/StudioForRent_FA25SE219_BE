// #region Imports
import Studio from '../models/Studio/studio.model.js';
import Equipment from '../models/Equipment/equipment.model.js';
import Service from '../models/Service/service.model.js';
import Promotion from '../models/Promotion/promotion.model.js';
import SetDesign from '../models/SetDesign/setDesign.model.js';
import { escapeRegex } from '../utils/helpers.js';
import { STUDIO_STATUS, EQUIPMENT_STATUS, SERVICE_STATUS } from '../utils/constants.js';
// #endregion

// #region Constants
const VALID_ENTITIES = ['studios', 'equipment', 'services', 'promotions', 'setDesigns'];
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;
// #endregion

// #region Global Search
/**
 * Global search across multiple entities
 * @param {Object} options - Search options
 * @param {string} options.keyword - Search keyword (required, min 2 chars)
 * @param {string[]} options.entities - Array of entity names to search (default: all)
 * @param {number} options.limit - Max results per entity (default: 5, max: 20)
 * @returns {Promise<Object>} Search results grouped by entity
 */
export const globalSearch = async ({ keyword, entities = VALID_ENTITIES, limit = DEFAULT_LIMIT }) => {
  // Sanitize keyword (prevent ReDoS)
  const safeKeyword = keyword && keyword.length > 100 ? keyword.substring(0, 100) : keyword;
  const escapedKeyword = escapeRegex(safeKeyword.trim());
  
  // Sanitize limit
  const safeLimit = Math.min(Math.max(parseInt(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  
  // Filter valid entities
  const validEntities = entities.filter(e => VALID_ENTITIES.includes(e));
  
  // Build search promises for each entity
  const searchPromises = [];
  const entityMap = {};

  if (validEntities.includes('studios')) {
    const promise = searchStudios(escapedKeyword, safeLimit);
    searchPromises.push(promise);
    entityMap.studios = searchPromises.length - 1;
  }

  if (validEntities.includes('equipment')) {
    const promise = searchEquipment(escapedKeyword, safeLimit);
    searchPromises.push(promise);
    entityMap.equipment = searchPromises.length - 1;
  }

  if (validEntities.includes('services')) {
    const promise = searchServices(escapedKeyword, safeLimit);
    searchPromises.push(promise);
    entityMap.services = searchPromises.length - 1;
  }

  if (validEntities.includes('promotions')) {
    const promise = searchPromotions(escapedKeyword, safeLimit);
    searchPromises.push(promise);
    entityMap.promotions = searchPromises.length - 1;
  }

  if (validEntities.includes('setDesigns')) {
    const promise = searchSetDesigns(escapedKeyword, safeLimit);
    searchPromises.push(promise);
    entityMap.setDesigns = searchPromises.length - 1;
  }

  // Execute all searches in parallel
  const results = await Promise.all(searchPromises);

  // Build response object
  const response = {};
  let totalResults = 0;

  for (const [entity, index] of Object.entries(entityMap)) {
    response[entity] = results[index];
    totalResults += results[index].length;
  }

  // Fill empty arrays for non-searched entities
  for (const entity of VALID_ENTITIES) {
    if (!response[entity]) {
      response[entity] = [];
    }
  }

  return {
    results: response,
    totalResults,
    searchedEntities: validEntities,
    keyword: safeKeyword
  };
};
// #endregion

// #region Search Suggestions
/**
 * Get search suggestions/autocomplete
 * @param {string} keyword - Search keyword
 * @param {number} limit - Max suggestions (default: 10)
 * @returns {Promise<Object>} Suggestions array
 */
export const getSearchSuggestions = async (keyword, limit = 10) => {
  // Sanitize
  const safeKeyword = keyword && keyword.length > 50 ? keyword.substring(0, 50) : keyword;
  const escapedKeyword = escapeRegex(safeKeyword.trim());
  const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 20);
  
  // Search in parallel across main entities
  const [studios, equipment, services, setDesigns] = await Promise.all([
    Studio.find({
      status: STUDIO_STATUS.ACTIVE,
      name: { $regex: escapedKeyword, $options: 'i' }
    })
      .select('name')
      .limit(safeLimit)
      .lean(),
    Equipment.find({
      isDeleted: false,
      status: EQUIPMENT_STATUS.AVAILABLE,
      name: { $regex: escapedKeyword, $options: 'i' }
    })
      .select('name')
      .limit(safeLimit)
      .lean(),
    Service.find({
      status: SERVICE_STATUS.ACTIVE,
      name: { $regex: escapedKeyword, $options: 'i' }
    })
      .select('name')
      .limit(safeLimit)
      .lean(),
    SetDesign.find({
      isActive: true,
      name: { $regex: escapedKeyword, $options: 'i' }
    })
      .select('name')
      .limit(safeLimit)
      .lean()
  ]);

  // Combine and format suggestions
  const suggestions = [
    ...studios.map(s => ({ text: s.name, type: 'studio', id: s._id })),
    ...equipment.map(e => ({ text: e.name, type: 'equipment', id: e._id })),
    ...services.map(s => ({ text: s.name, type: 'service', id: s._id })),
    ...setDesigns.map(d => ({ text: d.name, type: 'setDesign', id: d._id }))
  ];

  // Sort by relevance (exact match first, then starts with, then contains)
  const lowerKeyword = safeKeyword.toLowerCase();
  suggestions.sort((a, b) => {
    const aLower = a.text.toLowerCase();
    const bLower = b.text.toLowerCase();
    
    // Exact match first
    if (aLower === lowerKeyword && bLower !== lowerKeyword) return -1;
    if (bLower === lowerKeyword && aLower !== lowerKeyword) return 1;
    
    // Starts with second
    if (aLower.startsWith(lowerKeyword) && !bLower.startsWith(lowerKeyword)) return -1;
    if (bLower.startsWith(lowerKeyword) && !aLower.startsWith(lowerKeyword)) return 1;
    
    // Alphabetical
    return aLower.localeCompare(bLower);
  });

  return {
    suggestions: suggestions.slice(0, safeLimit),
    total: suggestions.length
  };
};
// #endregion

// #region Entity-Specific Search Functions
/**
 * Search studios
 */
const searchStudios = async (escapedKeyword, limit) => {
  return Studio.find({
    status: STUDIO_STATUS.ACTIVE,
    $or: [
      { name: { $regex: escapedKeyword, $options: 'i' } },
      { description: { $regex: escapedKeyword, $options: 'i' } },
      { location: { $regex: escapedKeyword, $options: 'i' } }
    ]
  })
    .select('name description location basePricePerHour capacity images')
    .limit(limit)
    .lean();
};

/**
 * Search equipment
 */
const searchEquipment = async (escapedKeyword, limit) => {
  return Equipment.find({
    isDeleted: false,
    status: { $ne: 'maintenance' },
    $or: [
      { name: { $regex: escapedKeyword, $options: 'i' } },
      { description: { $regex: escapedKeyword, $options: 'i' } }
    ]
  })
    .select('name description pricePerHour availableQty image')
    .limit(limit)
    .lean();
};

/**
 * Search services
 */
const searchServices = async (escapedKeyword, limit) => {
  return Service.find({
    status: SERVICE_STATUS.ACTIVE,
    $or: [
      { name: { $regex: escapedKeyword, $options: 'i' } },
      { description: { $regex: escapedKeyword, $options: 'i' } }
    ]
  })
    .select('name description pricePerUse')
    .limit(limit)
    .lean();
};

/**
 * Search promotions
 */
const searchPromotions = async (escapedKeyword, limit) => {
  const now = new Date();
  
  return Promotion.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
    $or: [
      { name: { $regex: escapedKeyword, $options: 'i' } },
      { code: { $regex: escapedKeyword, $options: 'i' } },
      { description: { $regex: escapedKeyword, $options: 'i' } }
    ]
  })
    .select('name code description discountType discountValue minOrderValue endDate')
    .limit(limit)
    .lean();
};

/**
 * Search set designs
 */
const searchSetDesigns = async (escapedKeyword, limit) => {
  return SetDesign.find({
    isActive: true,
    $or: [
      { name: { $regex: escapedKeyword, $options: 'i' } },
      { description: { $regex: escapedKeyword, $options: 'i' } },
      { category: { $regex: escapedKeyword, $options: 'i' } }
    ]
  })
    .select('name description category price images')
    .limit(limit)
    .lean();
};
// #endregion
