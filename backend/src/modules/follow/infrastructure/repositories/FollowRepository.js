/**
 * Follow Repository
 * Database operations for user-follows-user relationships
 */

import prisma from '../../../../config/database.js';

const USER_SELECT = {
  id: true,
  name: true,
  displayName: true,
  avatarUrl: true,
};

class FollowRepository {
  async follow(followerId, followingId) {
    await prisma.user_follows.upsert({
      where: {
        followerId_followingId: { followerId, followingId },
      },
      create: { followerId, followingId },
      update: {},
    });
  }

  async unfollow(followerId, followingId) {
    await prisma.user_follows.deleteMany({
      where: { followerId, followingId },
    });
  }

  async isFollowing(followerId, followingId) {
    const row = await prisma.user_follows.findUnique({
      where: {
        followerId_followingId: { followerId, followingId },
      },
      select: { id: true },
    });
    return row !== null;
  }

  async getFollowers(userId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prisma.user_follows.findMany({
        where: { followingId: userId },
        skip,
        take: limit,
        orderBy: { followedAt: 'desc' },
        select: {
          followedAt: true,
          follower: { select: USER_SELECT },
        },
      }),
      prisma.user_follows.count({
        where: { followingId: userId },
      }),
    ]);

    return {
      users: rows.map((r) => ({
        ...r.follower,
        followedAt: r.followedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getFollowing(userId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prisma.user_follows.findMany({
        where: { followerId: userId },
        skip,
        take: limit,
        orderBy: { followedAt: 'desc' },
        select: {
          followedAt: true,
          following: { select: USER_SELECT },
        },
      }),
      prisma.user_follows.count({
        where: { followerId: userId },
      }),
    ]);

    return {
      users: rows.map((r) => ({
        ...r.following,
        followedAt: r.followedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getFollowCounts(userId) {
    const [followersCount, followingCount] = await Promise.all([
      prisma.user_follows.count({
        where: { followingId: userId },
      }),
      prisma.user_follows.count({
        where: { followerId: userId },
      }),
    ]);

    return { followersCount, followingCount };
  }
}

export default new FollowRepository();
