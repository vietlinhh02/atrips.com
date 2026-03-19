/**
 * Activity Vote Repository
 * Handles database operations for activity votes
 */

import prisma from '../../../../config/database.js';

const VALID_VOTE_TYPES = ['UP', 'DOWN'];

class ActivityVoteRepository {
  async getVotesByActivity(activityId) {
    return prisma.activity_votes.findMany({
      where: { activityId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getVoteSummary(activityId, userId = null) {
    const votes = await prisma.activity_votes.findMany({
      where: { activityId },
    });

    const upVotes = votes.filter(v => v.vote === 'UP').length;
    const downVotes = votes.filter(v => v.vote === 'DOWN').length;

    let userVote = null;
    if (userId) {
      const found = votes.find(v => v.userId === userId);
      userVote = found ? found.vote : null;
    }

    return {
      activityId,
      upVotes,
      downVotes,
      total: upVotes + downVotes,
      userVote,
    };
  }

  async getVoteSummariesForTrip(tripId, userId = null) {
    const activities = await prisma.activities.findMany({
      where: {
        itinerary_days: { tripId },
        deletedAt: null,
      },
      select: {
        id: true,
        activity_votes: true,
      },
    });

    return activities.map(activity => {
      const votes = activity.activity_votes;
      const upVotes = votes.filter(v => v.vote === 'UP').length;
      const downVotes = votes.filter(v => v.vote === 'DOWN').length;

      let userVote = null;
      if (userId) {
        const found = votes.find(v => v.userId === userId);
        userVote = found ? found.vote : null;
      }

      return {
        activityId: activity.id,
        upVotes,
        downVotes,
        total: upVotes + downVotes,
        userVote,
      };
    });
  }

  async upsertVote(activityId, userId, vote) {
    return prisma.activity_votes.upsert({
      where: {
        activityId_userId: { activityId, userId },
      },
      create: { activityId, userId, vote },
      update: { vote },
    });
  }

  async removeVote(activityId, userId) {
    return prisma.activity_votes.delete({
      where: {
        activityId_userId: { activityId, userId },
      },
    });
  }

  async getUserVote(activityId, userId) {
    return prisma.activity_votes.findUnique({
      where: {
        activityId_userId: { activityId, userId },
      },
    });
  }
}

export { VALID_VOTE_TYPES };
export default new ActivityVoteRepository();
