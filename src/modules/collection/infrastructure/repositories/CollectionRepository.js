/**
 * Collection Repository
 * Database operations for collections and saved places
 */

import prisma from '../../../../config/database.js';
import { AppError } from '../../../../shared/errors/AppError.js';

class CollectionRepository {
  async findByUserId(userId, { page = 1, limit = 10 } = {}) {
    const skip = (page - 1) * limit;

    const [collections, total] = await Promise.all([
      prisma.collections.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: {
            select: { saved_places: true },
          },
        },
      }),
      prisma.collections.count({ where: { userId } }),
    ]);

    return {
      collections,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id) {
    const collection = await prisma.collections.findUnique({
      where: { id },
      include: {
        saved_places: {
          orderBy: { savedAt: 'desc' },
          include: {
            cached_places: {
              select: {
                id: true,
                externalId: true,
                provider: true,
                name: true,
                type: true,
                address: true,
                city: true,
                country: true,
                latitude: true,
                longitude: true,
                rating: true,
                ratingCount: true,
                priceLevel: true,
                photos: true,
                categories: true,
              },
            },
          },
        },
        _count: {
          select: { saved_places: true },
        },
      },
    });

    return collection;
  }

  async create(userId, { name, description, coverImage, isPublic }) {
    const collection = await prisma.collections.create({
      data: {
        userId,
        name,
        description: description || null,
        coverImage: coverImage || null,
        isPublic: isPublic ?? false,
      },
    });

    return collection;
  }

  async update(id, userId, { name, description, coverImage, isPublic }) {
    await this.#verifyOwnership(id, userId);

    const data = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (coverImage !== undefined) data.coverImage = coverImage;
    if (isPublic !== undefined) data.isPublic = isPublic;

    const collection = await prisma.collections.update({
      where: { id },
      data,
    });

    return collection;
  }

  async delete(id, userId) {
    await this.#verifyOwnership(id, userId);

    await prisma.collections.delete({
      where: { id },
    });
  }

  async addPlace(collectionId, userId, placeId, notes) {
    await this.#verifyOwnership(collectionId, userId);

    const place = await prisma.cached_places.findUnique({
      where: { id: placeId },
      select: { id: true },
    });

    if (!place) {
      throw AppError.notFound('Place not found');
    }

    const savedPlace = await prisma.saved_places.create({
      data: {
        collectionId,
        userId,
        placeId,
        notes: notes || null,
      },
      include: {
        cached_places: {
          select: {
            id: true,
            externalId: true,
            provider: true,
            name: true,
            type: true,
            address: true,
            city: true,
            country: true,
            latitude: true,
            longitude: true,
            rating: true,
            photos: true,
          },
        },
      },
    });

    return savedPlace;
  }

  async removePlace(collectionId, placeId, userId) {
    await this.#verifyOwnership(collectionId, userId);

    const savedPlace = await prisma.saved_places.findUnique({
      where: {
        collectionId_placeId: {
          collectionId,
          placeId,
        },
      },
    });

    if (!savedPlace) {
      throw AppError.notFound('Place not found in this collection');
    }

    await prisma.saved_places.delete({
      where: {
        collectionId_placeId: {
          collectionId,
          placeId,
        },
      },
    });
  }

  async findPublicCollections({ page = 1, limit = 10 } = {}) {
    const skip = (page - 1) * limit;

    const [collections, total] = await Promise.all([
      prisma.collections.findMany({
        where: { isPublic: true },
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          User: {
            select: {
              id: true,
              name: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: { saved_places: true },
          },
        },
      }),
      prisma.collections.count({ where: { isPublic: true } }),
    ]);

    return {
      collections,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSavedPlacesByUser(userId, { page = 1, limit = 10 } = {}) {
    const skip = (page - 1) * limit;

    const [savedPlaces, total] = await Promise.all([
      prisma.saved_places.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { savedAt: 'desc' },
        include: {
          cached_places: {
            select: {
              id: true,
              externalId: true,
              provider: true,
              name: true,
              type: true,
              address: true,
              city: true,
              country: true,
              latitude: true,
              longitude: true,
              rating: true,
              ratingCount: true,
              priceLevel: true,
              photos: true,
              categories: true,
            },
          },
          collections: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.saved_places.count({ where: { userId } }),
    ]);

    return {
      savedPlaces,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async #verifyOwnership(collectionId, userId) {
    const collection = await prisma.collections.findUnique({
      where: { id: collectionId },
      select: { userId: true },
    });

    if (!collection) {
      throw AppError.notFound('Collection not found');
    }

    if (collection.userId !== userId) {
      throw AppError.forbidden(
        'You do not have permission to modify this collection'
      );
    }
  }
}

export default new CollectionRepository();
