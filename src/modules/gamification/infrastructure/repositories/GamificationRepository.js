/**
 * Gamification Repository
 * Database operations for badges, points, and leaderboards
 */

import prisma from '../../../../config/database.js';

const CRITERIA_HANDLERS = {
  async trip_count(userId) {
    return prisma.trips.count({
      where: { ownerId: userId, deletedAt: null },
    });
  },

  async review_count(userId) {
    return prisma.place_reviews.count({
      where: { userId },
    });
  },

  async points_total(userId) {
    const result = await prisma.points_ledger.aggregate({
      where: { userId },
      _sum: { points: true },
    });
    return result._sum.points ?? 0;
  },

  async photo_count(userId) {
    return prisma.photos.count({
      where: { userId },
    });
  },
};

class GamificationRepository {
  async getAllBadges() {
    return prisma.badges.findMany({
      where: { isActive: true },
      orderBy: [{ tier: 'asc' }, { points: 'asc' }],
    });
  }

  async getUserBadges(userId) {
    return prisma.user_badges.findMany({
      where: { userId },
      include: { badges: true },
      orderBy: { earnedAt: 'desc' },
    });
  }

  async awardBadge(userId, badgeId, context) {
    const existing = await prisma.user_badges.findUnique({
      where: { userId_badgeId: { userId, badgeId } },
    });

    if (existing) {
      return null;
    }

    const badge = await prisma.badges.findUnique({
      where: { id: badgeId },
    });

    if (!badge) {
      return null;
    }

    const result = await prisma.$transaction(async (tx) => {
      const userBadge = await tx.user_badges.create({
        data: {
          userId,
          badgeId,
          context: context ?? undefined,
        },
        include: { badges: true },
      });

      await tx.points_ledger.create({
        data: {
          userId,
          action: 'BADGE_EARNED',
          points: badge.points,
          description: `Earned badge: ${badge.name}`,
          entityType: 'badge',
          entityId: badgeId,
        },
      });

      return userBadge;
    });

    return result;
  }

  async addPoints(
    userId,
    action,
    points,
    description,
    entityType,
    entityId
  ) {
    return prisma.points_ledger.create({
      data: {
        userId,
        action,
        points,
        description: description ?? null,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
      },
    });
  }

  async getUserPoints(userId) {
    const result = await prisma.points_ledger.aggregate({
      where: { userId },
      _sum: { points: true },
    });
    return result._sum.points ?? 0;
  }

  async getPointsHistory(userId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      prisma.points_ledger.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.points_ledger.count({ where: { userId } }),
    ]);

    return {
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getLeaderboard(scope, period, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      prisma.leaderboard_entries.findMany({
        where: { scope, period },
        skip,
        take: limit,
        orderBy: { rank: 'asc' },
      }),
      prisma.leaderboard_entries.count({
        where: { scope, period },
      }),
    ]);

    const userIds = entries.map((e) => e.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        displayName: true,
        avatarUrl: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const enriched = entries.map((entry) => ({
      ...entry,
      user: userMap.get(entry.userId) ?? null,
    }));

    return {
      entries: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateLeaderboard(scope, period) {
    const aggregated = await prisma.points_ledger.groupBy({
      by: ['userId'],
      _sum: { points: true },
      orderBy: { _sum: { points: 'desc' } },
    });

    const ranked = aggregated.map((row, index) => ({
      scope,
      period,
      userId: row.userId,
      rank: index + 1,
      totalPoints: row._sum.points ?? 0,
    }));

    await prisma.$transaction(async (tx) => {
      await tx.leaderboard_entries.deleteMany({
        where: { scope, period },
      });

      if (ranked.length > 0) {
        await tx.leaderboard_entries.createMany({
          data: ranked,
        });
      }
    });

    return ranked.length;
  }

  async checkAndAwardBadges(userId) {
    const badges = await prisma.badges.findMany({
      where: { isActive: true },
    });

    const earnedBadgeIds = new Set(
      (
        await prisma.user_badges.findMany({
          where: { userId },
          select: { badgeId: true },
        })
      ).map((ub) => ub.badgeId)
    );

    const awarded = [];

    for (const badge of badges) {
      if (earnedBadgeIds.has(badge.id)) {
        continue;
      }

      const criteria = badge.criteria;
      if (!criteria || !criteria.type || !criteria.threshold) {
        continue;
      }

      const handler = CRITERIA_HANDLERS[criteria.type];
      if (!handler) {
        continue;
      }

      const value = await handler(userId);

      if (value >= criteria.threshold) {
        const result = await this.awardBadge(userId, badge.id, {
          criteriaType: criteria.type,
          valueAtAward: value,
          threshold: criteria.threshold,
        });
        if (result) {
          awarded.push(result);
        }
      }
    }

    return awarded;
  }
}

export default new GamificationRepository();
