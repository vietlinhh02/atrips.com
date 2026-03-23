/**
 * Chat Repository
 * Database operations for chat messages and rooms with caching
 */

import prisma from '../../../../config/database.js';
import cacheService from '../../../../shared/services/CacheService.js';

// Cache TTL settings (in seconds)
const CACHE_TTL = {
  RECENT_CHATS: 600,     // 10 minutes
  CHAT_ROOM: 600,        // 10 minutes
  UNREAD_COUNT: 300,     // 5 minutes
};

// Cache key prefixes
const CACHE_KEYS = {
  RECENT_CHATS: (userId, limit) => `chats:recent:${userId}:${limit}`,
  CHAT_ROOM: (tripId) => `chat_room:${tripId}`,
  UNREAD_COUNT: (userId) => `chats:unread:${userId}`,
};

class ChatRepository {
  /**
   * Get recent chats for user (cached)
   */
  async getRecentChats(userId, limit = 5) {
    const cacheKey = CACHE_KEYS.RECENT_CHATS(userId, limit);

    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Get trips where user is owner or member
    const trips = await prisma.trips.findMany({
      where: {
        OR: [
          { ownerId: userId },
          {
            trip_members: {
              some: { userId },
            },
          },
        ],
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        trip_chat_rooms: {
          select: {
            id: true,
            chat_messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                content: true,
                createdAt: true,
                userId: true,
                User: {
                  select: {
                    id: true,
                    name: true,
                    displayName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    // Format response
    const chats = trips
      .filter(trip => trip.trip_chat_rooms)
      .map(trip => ({
        id: trip.trip_chat_rooms.id,
        tripId: trip.id,
        tripTitle: trip.title,
        lastMessage: trip.trip_chat_rooms.chat_messages[0] || null,
      }));

    const result = {
      chats,
      total: chats.length,
    };

    // Cache the result
    await cacheService.set(cacheKey, result, CACHE_TTL.RECENT_CHATS);

    return result;
  }

  /**
   * Get unread message count for user (cached)
   */
  async getUnreadCount(userId) {
    const cacheKey = CACHE_KEYS.UNREAD_COUNT(userId);

    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // For now, return 0 as we don't have read status tracking
    // In a real implementation, you'd track last read timestamp per chat room
    const result = { count: 0 };

    // Cache the result
    await cacheService.set(cacheKey, result, CACHE_TTL.UNREAD_COUNT);

    return result;
  }

  /**
   * Get chat room by trip ID (cached)
   */
  async getChatRoomByTripId(tripId) {
    const cacheKey = CACHE_KEYS.CHAT_ROOM(tripId);

    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await prisma.trip_chat_rooms.findUnique({
      where: { tripId },
      include: {
        chat_messages: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            User: {
              select: {
                id: true,
                name: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (result) {
      await cacheService.set(cacheKey, result, CACHE_TTL.CHAT_ROOM);
    }

    return result;
  }

  /**
   * Create chat message
   */
  async createMessage(chatRoomId, userId, content, messageType = 'text', metadata = null) {
    const message = await prisma.chat_messages.create({
      data: {
        chatRoomId,
        userId,
        content,
        messageType,
        metadata,
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        trip_chat_rooms: {
          select: {
            tripId: true,
          },
        },
      },
    });

    // Invalidate relevant caches
    await this.invalidateChatCaches(userId, message.trip_chat_rooms?.tripId);

    return message;
  }

  /**
   * Create chat room for trip
   */
  async createChatRoom(tripId) {
    return prisma.trip_chat_rooms.create({
      data: {
        tripId,
      },
    });
  }

  /**
   * Invalidate chat caches
   */
  async invalidateChatCaches(userId, tripId = null) {
    const keysToDelete = [];

    // Invalidate recent chats for user (all limits)
    for (const limit of [5, 10, 20]) {
      keysToDelete.push(CACHE_KEYS.RECENT_CHATS(userId, limit));
    }

    // Invalidate unread count
    keysToDelete.push(CACHE_KEYS.UNREAD_COUNT(userId));

    // Invalidate chat room if tripId provided
    if (tripId) {
      keysToDelete.push(CACHE_KEYS.CHAT_ROOM(tripId));
    }

    await Promise.all(keysToDelete.map(key => cacheService.del(key)));
  }

  /**
   * Invalidate chat room cache by trip ID
   */
  async invalidateChatRoom(tripId) {
    await cacheService.del(CACHE_KEYS.CHAT_ROOM(tripId));
  }
}

export default new ChatRepository();
