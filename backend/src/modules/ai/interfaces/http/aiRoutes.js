/**
 * AI Routes
 * Defines routes for AI chat, conversation, and tool endpoints
 */

import { Router } from 'express';
import aiController from './aiController.js';
import { authenticate, optionalAuth } from '../../../../shared/middleware/authenticate.js';

const router = Router();

// ============================================
// Public endpoints (no auth required)
// ============================================

// AI provider status
router.get('/provider/status', aiController.getProviderStatus);

// Test tool calling (debug endpoint)
router.post('/test-tools', aiController.testTools);

// Available tools
router.get('/tools', aiController.getTools);

// ============================================
// Optional auth endpoints (support guest mode)
// ============================================

// Chat with AI
router.post('/chat', optionalAuth, aiController.chat);

// Chat streaming (SSE)
router.get('/chat/stream', optionalAuth, aiController.chatStream);

// Create conversation (can be anonymous)
router.post('/conversations', optionalAuth, aiController.createConversation);

// Get AI quota
router.get('/quota', optionalAuth, aiController.getQuota);

// Execute tool
router.post('/tools/:name/execute', optionalAuth, aiController.executeTool);

// Get recommendations
router.post('/recommend', optionalAuth, aiController.getRecommendations);

// Estimate budget
router.post('/estimate-budget', optionalAuth, aiController.estimateBudget);

// ============================================
// Protected endpoints (require authentication)
// ============================================

// List user's conversations
router.get('/conversations', authenticate, aiController.getConversations);

// Get single conversation
router.get('/conversations/:id', authenticate, aiController.getConversation);

// Update conversation (e.g. rename title)
router.patch('/conversations/:id', authenticate, aiController.updateConversation);

// Delete conversation
router.delete('/conversations/:id', authenticate, aiController.deleteConversation);

// List AI drafts
router.get('/drafts', authenticate, aiController.listDrafts);

// Get single draft
router.get('/drafts/:id', authenticate, aiController.getDraft);

// Clear AI cache (admin only)
router.delete('/cache', authenticate, aiController.clearCache);

// View AI flow logs
router.get('/logs', authenticate, aiController.getLogs);

export default router;
