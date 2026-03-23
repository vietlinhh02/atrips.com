/**
 * Story Routes
 * Defines routes for story, comment, and like endpoints
 */

import { Router } from 'express';
import storyController from './storyController.js';
import {
  authenticate,
  optionalAuth,
} from '../../../../shared/middleware/authenticate.js';

const router = Router();

// Public listing with optional auth
router.get('/', optionalAuth, storyController.listPublished);

// User's own stories (must come before /:slug)
router.get('/my', authenticate, storyController.listMyStories);

// Public story detail by slug
router.get('/:slug', optionalAuth, storyController.getBySlug);

// Story CRUD (authenticated)
router.post('/', authenticate, storyController.createStory);
router.patch('/:id', authenticate, storyController.updateStory);
router.delete('/:id', authenticate, storyController.deleteStory);

// Likes
router.post('/:id/like', authenticate, storyController.toggleLike);

// Comments
router.get('/:id/comments', storyController.getComments);
router.post(
  '/:id/comments',
  authenticate,
  storyController.addComment
);
router.delete(
  '/comments/:commentId',
  authenticate,
  storyController.deleteComment
);

export default router;
