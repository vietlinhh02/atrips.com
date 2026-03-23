/**
 * Story Repository
 * Database operations for stories, comments, likes, and tags
 */

import prisma from '../../../../config/database.js';
import { AppError } from '../../../../shared/errors/AppError.js';

const USER_SELECT = {
  id: true,
  name: true,
  displayName: true,
  avatarUrl: true,
};

function generateSlug(title) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

class StoryRepository {
  async findPublished({ page = 1, limit = 10, tag } = {}) {
    const skip = (page - 1) * limit;

    const where = { status: 'PUBLISHED' };
    if (tag) {
      where.story_tags = {
        some: { tags: { name: tag } },
      };
    }

    const [stories, total] = await Promise.all([
      prisma.stories.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishedAt: 'desc' },
        include: {
          User: { select: USER_SELECT },
          _count: {
            select: {
              story_comments: true,
              story_likes: true,
            },
          },
          story_tags: {
            include: { tags: true },
          },
        },
      }),
      prisma.stories.count({ where }),
    ]);

    return {
      stories,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByUserId(userId, { page = 1, limit = 10, status } = {}) {
    const skip = (page - 1) * limit;

    const where = { userId };
    if (status) {
      where.status = status;
    }

    const [stories, total] = await Promise.all([
      prisma.stories.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: {
            select: {
              story_comments: true,
              story_likes: true,
            },
          },
          story_tags: {
            include: { tags: true },
          },
        },
      }),
      prisma.stories.count({ where }),
    ]);

    return {
      stories,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findBySlug(slug) {
    const story = await prisma.stories.findUnique({
      where: { slug },
      include: {
        User: { select: USER_SELECT },
        story_comments: {
          where: { status: 'PUBLISHED', parentId: null },
          orderBy: { createdAt: 'desc' },
          include: {
            User: { select: USER_SELECT },
            other_story_comments: {
              where: { status: 'PUBLISHED' },
              orderBy: { createdAt: 'asc' },
              include: {
                User: { select: USER_SELECT },
              },
            },
          },
        },
        story_tags: {
          include: { tags: true },
        },
        _count: {
          select: {
            story_likes: true,
            story_comments: true,
          },
        },
      },
    });

    return story;
  }

  async findById(id) {
    const story = await prisma.stories.findUnique({
      where: { id },
      include: {
        User: { select: USER_SELECT },
        story_comments: {
          where: { status: 'PUBLISHED', parentId: null },
          orderBy: { createdAt: 'desc' },
          include: {
            User: { select: USER_SELECT },
            other_story_comments: {
              where: { status: 'PUBLISHED' },
              orderBy: { createdAt: 'asc' },
              include: {
                User: { select: USER_SELECT },
              },
            },
          },
        },
        story_tags: {
          include: { tags: true },
        },
        _count: {
          select: {
            story_likes: true,
            story_comments: true,
          },
        },
      },
    });

    return story;
  }

  async create(userId, data) {
    const {
      title,
      content,
      excerpt,
      coverImage,
      metaTitle,
      metaDescription,
      status,
      tags,
    } = data;

    const slug = generateSlug(title);

    const storyData = {
      userId,
      title,
      slug,
      content,
      excerpt: excerpt || null,
      coverImage: coverImage || null,
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null,
      status: status || 'DRAFT',
    };

    if (storyData.status === 'PUBLISHED') {
      storyData.publishedAt = new Date();
    }

    if (tags && tags.length > 0) {
      storyData.story_tags = {
        create: tags.map((tagId) => ({ tagId })),
      };
    }

    const story = await prisma.stories.create({
      data: storyData,
      include: {
        User: { select: USER_SELECT },
        story_tags: {
          include: { tags: true },
        },
        _count: {
          select: {
            story_comments: true,
            story_likes: true,
          },
        },
      },
    });

    return story;
  }

  async update(id, userId, data) {
    await this.#verifyOwnership(id, userId);

    const { tags, ...fields } = data;

    const updateData = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }

    if (
      updateData.status === 'PUBLISHED'
    ) {
      const existing = await prisma.stories.findUnique({
        where: { id },
        select: { publishedAt: true },
      });
      if (!existing.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    if (tags !== undefined) {
      await prisma.story_tags.deleteMany({ where: { storyId: id } });
      if (tags.length > 0) {
        await prisma.story_tags.createMany({
          data: tags.map((tagId) => ({ storyId: id, tagId })),
        });
      }
    }

    const story = await prisma.stories.update({
      where: { id },
      data: updateData,
      include: {
        User: { select: USER_SELECT },
        story_tags: {
          include: { tags: true },
        },
        _count: {
          select: {
            story_comments: true,
            story_likes: true,
          },
        },
      },
    });

    return story;
  }

  async delete(id, userId) {
    await this.#verifyOwnership(id, userId);

    await prisma.stories.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }

  async incrementViews(id) {
    await prisma.stories.update({
      where: { id },
      data: { viewsCount: { increment: 1 } },
    });
  }

  async toggleLike(storyId, userId) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.story_likes.findUnique({
        where: { storyId_userId: { storyId, userId } },
      });

      if (existing) {
        await tx.story_likes.delete({
          where: { storyId_userId: { storyId, userId } },
        });
        await tx.stories.update({
          where: { id: storyId },
          data: { likesCount: { decrement: 1 } },
        });
        return { liked: false };
      }

      await tx.story_likes.create({
        data: { storyId, userId },
      });
      await tx.stories.update({
        where: { id: storyId },
        data: { likesCount: { increment: 1 } },
      });
      return { liked: true };
    });
  }

  async addComment(storyId, userId, { content, parentId }) {
    const story = await prisma.stories.findUnique({
      where: { id: storyId },
      select: { id: true, status: true },
    });

    if (!story) {
      throw AppError.notFound('Story not found');
    }

    if (story.status !== 'PUBLISHED') {
      throw AppError.badRequest(
        'Comments can only be added to published stories'
      );
    }

    if (parentId) {
      const parent = await prisma.story_comments.findUnique({
        where: { id: parentId },
        select: { id: true, storyId: true },
      });
      if (!parent || parent.storyId !== storyId) {
        throw AppError.badRequest('Invalid parent comment');
      }
    }

    const comment = await prisma.story_comments.create({
      data: {
        storyId,
        userId,
        content,
        parentId: parentId || null,
      },
      include: {
        User: { select: USER_SELECT },
      },
    });

    return comment;
  }

  async deleteComment(commentId, userId) {
    const comment = await prisma.story_comments.findUnique({
      where: { id: commentId },
      include: {
        stories: { select: { userId: true } },
      },
    });

    if (!comment) {
      throw AppError.notFound('Comment not found');
    }

    const isCommentOwner = comment.userId === userId;
    const isStoryOwner = comment.stories.userId === userId;

    if (!isCommentOwner && !isStoryOwner) {
      throw AppError.forbidden(
        'You do not have permission to delete this comment'
      );
    }

    await prisma.story_comments.delete({
      where: { id: commentId },
    });
  }

  async getComments(storyId, { page = 1, limit = 10 } = {}) {
    const skip = (page - 1) * limit;

    const where = {
      storyId,
      parentId: null,
      status: 'PUBLISHED',
    };

    const [comments, total] = await Promise.all([
      prisma.story_comments.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          User: { select: USER_SELECT },
          other_story_comments: {
            where: { status: 'PUBLISHED' },
            orderBy: { createdAt: 'asc' },
            include: {
              User: { select: USER_SELECT },
            },
          },
        },
      }),
      prisma.story_comments.count({ where }),
    ]);

    return {
      comments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async #verifyOwnership(storyId, userId) {
    const story = await prisma.stories.findUnique({
      where: { id: storyId },
      select: { userId: true },
    });

    if (!story) {
      throw AppError.notFound('Story not found');
    }

    if (story.userId !== userId) {
      throw AppError.forbidden(
        'You do not have permission to modify this story'
      );
    }
  }
}

export default new StoryRepository();
