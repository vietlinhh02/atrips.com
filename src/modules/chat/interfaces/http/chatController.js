/**
 * Chat Controller
 * Handles HTTP requests for chat endpoints
 */

import { sendSuccess } from '../../../../shared/utils/response.js';
import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import chatRepository from '../../infrastructure/repositories/ChatRepository.js';

/**
 * @route GET /api/chats/recent
 * @desc Get recent chat conversations
 * @access Private
 */
export const getRecentChats = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 5;
  const result = await chatRepository.getRecentChats(req.user.id, limit);

  return sendSuccess(res, result);
});

/**
 * @route GET /api/chats/unread-count
 * @desc Get unread message count
 * @access Private
 */
export const getUnreadCount = asyncHandler(async (req, res) => {
  const result = await chatRepository.getUnreadCount(req.user.id);

  return sendSuccess(res, result);
});

/**
 * @route GET /api/chats/:tripId
 * @desc Get chat room for a trip
 * @access Private
 */
export const getChatRoom = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const chatRoom = await chatRepository.getChatRoomByTripId(tripId);

  return sendSuccess(res, { chatRoom });
});

export default {
  getRecentChats,
  getUnreadCount,
  getChatRoom,
};
