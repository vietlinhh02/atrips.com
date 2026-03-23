/**
 * Story Controller
 * Handles HTTP requests for story, comment, and like endpoints
 */

import {
  sendSuccess,
  sendCreated,
  sendNoContent,
  sendPaginated,
} from '../../../../shared/utils/response.js';
import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import storyRepository from '../../infrastructure/repositories/StoryRepository.js';

/**
 * @route GET /api/stories
 * @desc List published stories (paginated)
 * @access Public
 */
export const listPublished = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, tag } = req.query;

  const result = await storyRepository.findPublished({
    page: parseInt(page),
    limit: parseInt(limit),
    tag,
  });

  return sendPaginated(
    res,
    result.stories,
    result.pagination
  );
});

/**
 * @route GET /api/stories/my
 * @desc List user's own stories (paginated)
 * @access Private
 */
export const listMyStories = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;

  const result = await storyRepository.findByUserId(req.user.id, {
    page: parseInt(page),
    limit: parseInt(limit),
    status,
  });

  return sendPaginated(
    res,
    result.stories,
    result.pagination
  );
});

/**
 * @route GET /api/stories/:slug
 * @desc Get story by slug (increments view count)
 * @access Public
 */
export const getBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const story = await storyRepository.findBySlug(slug);

  if (!story) {
    throw AppError.notFound('Story not found');
  }

  const isOwner = req.user && story.userId === req.user.id;
  if (story.status !== 'PUBLISHED' && !isOwner) {
    throw AppError.notFound('Story not found');
  }

  storyRepository.incrementViews(story.id);

  return sendSuccess(res, { story });
});

/**
 * @route POST /api/stories
 * @desc Create a new story
 * @access Private
 */
export const createStory = asyncHandler(async (req, res) => {
  const {
    title,
    content,
    excerpt,
    coverImage,
    metaTitle,
    metaDescription,
    status,
    tags,
  } = req.body;

  if (!title || !title.trim()) {
    throw AppError.badRequest('Title is required');
  }

  if (!content || !content.trim()) {
    throw AppError.badRequest('Content is required');
  }

  const story = await storyRepository.create(req.user.id, {
    title: title.trim(),
    content: content.trim(),
    excerpt,
    coverImage,
    metaTitle,
    metaDescription,
    status,
    tags,
  });

  return sendCreated(
    res,
    { story },
    'Story created successfully'
  );
});

/**
 * @route PATCH /api/stories/:id
 * @desc Update a story
 * @access Private
 */
export const updateStory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    title,
    content,
    excerpt,
    coverImage,
    metaTitle,
    metaDescription,
    status,
    tags,
  } = req.body;

  if (title !== undefined && !title.trim()) {
    throw AppError.badRequest('Title cannot be empty');
  }

  if (content !== undefined && !content.trim()) {
    throw AppError.badRequest('Content cannot be empty');
  }

  const story = await storyRepository.update(id, req.user.id, {
    title: title !== undefined ? title.trim() : undefined,
    content: content !== undefined ? content.trim() : undefined,
    excerpt,
    coverImage,
    metaTitle,
    metaDescription,
    status,
    tags,
  });

  return sendSuccess(
    res,
    { story },
    'Story updated successfully'
  );
});

/**
 * @route DELETE /api/stories/:id
 * @desc Archive a story (soft delete)
 * @access Private
 */
export const deleteStory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  await storyRepository.delete(id, req.user.id);

  return sendNoContent(res);
});

/**
 * @route POST /api/stories/:id/like
 * @desc Toggle like on a story
 * @access Private
 */
export const toggleLike = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const story = await storyRepository.findById(id);
  if (!story) {
    throw AppError.notFound('Story not found');
  }

  const result = await storyRepository.toggleLike(id, req.user.id);

  return sendSuccess(res, result);
});

/**
 * @route GET /api/stories/:id/comments
 * @desc Get paginated comments for a story
 * @access Public
 */
export const getComments = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const result = await storyRepository.getComments(id, {
    page: parseInt(page),
    limit: parseInt(limit),
  });

  return sendPaginated(
    res,
    result.comments,
    result.pagination
  );
});

/**
 * @route POST /api/stories/:id/comments
 * @desc Add a comment to a story
 * @access Private
 */
export const addComment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content, parentId } = req.body;

  if (!content || !content.trim()) {
    throw AppError.badRequest('Comment content is required');
  }

  const comment = await storyRepository.addComment(
    id,
    req.user.id,
    {
      content: content.trim(),
      parentId,
    }
  );

  return sendCreated(
    res,
    { comment },
    'Comment added successfully'
  );
});

/**
 * @route DELETE /api/stories/comments/:commentId
 * @desc Delete a comment
 * @access Private
 */
export const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  await storyRepository.deleteComment(commentId, req.user.id);

  return sendNoContent(res);
});

export default {
  listPublished,
  listMyStories,
  getBySlug,
  createStory,
  updateStory,
  deleteStory,
  toggleLike,
  getComments,
  addComment,
  deleteComment,
};
