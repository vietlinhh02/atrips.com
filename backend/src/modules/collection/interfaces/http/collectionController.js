/**
 * Collection Controller
 * Handles HTTP requests for collection and saved places endpoints
 */

import {
  sendSuccess,
  sendCreated,
  sendNoContent,
  sendPaginated,
} from '../../../../shared/utils/response.js';
import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import collectionRepository from '../../infrastructure/repositories/CollectionRepository.js';

/**
 * @route GET /api/collections
 * @desc List user's collections (paginated)
 * @access Private
 */
export const listCollections = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const result = await collectionRepository.findByUserId(req.user.id, {
    page: parseInt(page),
    limit: parseInt(limit),
  });

  return sendPaginated(
    res,
    result.collections,
    result.pagination
  );
});

/**
 * @route GET /api/collections/public
 * @desc List public collections (paginated)
 * @access Private
 */
export const listPublicCollections = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const result = await collectionRepository.findPublicCollections({
    page: parseInt(page),
    limit: parseInt(limit),
  });

  return sendPaginated(
    res,
    result.collections,
    result.pagination
  );
});

/**
 * @route GET /api/collections/saved-places
 * @desc List all saved places for user across collections (paginated)
 * @access Private
 */
export const listSavedPlaces = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const result = await collectionRepository.getSavedPlacesByUser(
    req.user.id,
    {
      page: parseInt(page),
      limit: parseInt(limit),
    }
  );

  return sendPaginated(
    res,
    result.savedPlaces,
    result.pagination
  );
});

/**
 * @route GET /api/collections/:id
 * @desc Get collection with places
 * @access Private
 */
export const getCollection = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const collection = await collectionRepository.findById(id);

  if (!collection) {
    throw AppError.notFound('Collection not found');
  }

  const isOwner = collection.userId === req.user.id;
  if (!isOwner && !collection.isPublic) {
    throw AppError.forbidden(
      'You do not have permission to view this collection'
    );
  }

  return sendSuccess(res, { collection });
});

/**
 * @route POST /api/collections
 * @desc Create a new collection
 * @access Private
 */
export const createCollection = asyncHandler(async (req, res) => {
  const { name, description, coverImage, isPublic } = req.body;

  if (!name || !name.trim()) {
    throw AppError.badRequest('Collection name is required');
  }

  const collection = await collectionRepository.create(req.user.id, {
    name: name.trim(),
    description,
    coverImage,
    isPublic,
  });

  return sendCreated(
    res,
    { collection },
    'Collection created successfully'
  );
});

/**
 * @route PATCH /api/collections/:id
 * @desc Update a collection
 * @access Private
 */
export const updateCollection = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, coverImage, isPublic } = req.body;

  if (name !== undefined && !name.trim()) {
    throw AppError.badRequest('Collection name cannot be empty');
  }

  const collection = await collectionRepository.update(
    id,
    req.user.id,
    {
      name: name !== undefined ? name.trim() : undefined,
      description,
      coverImage,
      isPublic,
    }
  );

  return sendSuccess(
    res,
    { collection },
    'Collection updated successfully'
  );
});

/**
 * @route DELETE /api/collections/:id
 * @desc Delete a collection
 * @access Private
 */
export const deleteCollection = asyncHandler(async (req, res) => {
  const { id } = req.params;

  await collectionRepository.delete(id, req.user.id);

  return sendNoContent(res);
});

/**
 * @route POST /api/collections/:id/places
 * @desc Add a place to a collection
 * @access Private
 */
export const addPlace = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { placeId, notes } = req.body;

  if (!placeId) {
    throw AppError.badRequest('placeId is required');
  }

  const savedPlace = await collectionRepository.addPlace(
    id,
    req.user.id,
    placeId,
    notes
  );

  return sendCreated(
    res,
    { savedPlace },
    'Place added to collection'
  );
});

/**
 * @route DELETE /api/collections/:id/places/:placeId
 * @desc Remove a place from a collection
 * @access Private
 */
export const removePlace = asyncHandler(async (req, res) => {
  const { id, placeId } = req.params;

  await collectionRepository.removePlace(id, placeId, req.user.id);

  return sendNoContent(res);
});

export default {
  listCollections,
  listPublicCollections,
  listSavedPlaces,
  getCollection,
  createCollection,
  updateCollection,
  deleteCollection,
  addPlace,
  removePlace,
};
