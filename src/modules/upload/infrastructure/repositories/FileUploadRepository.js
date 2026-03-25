import prisma from '../../../../config/database.js';

class FileUploadRepository {
  async create(data) {
    return prisma.file_uploads.create({ data });
  }

  async findById(id) {
    return prisma.file_uploads.findUnique({ where: { id } });
  }

  async findByConversationId(conversationId) {
    return prisma.file_uploads.findMany({
      where: { conversationId, status: { not: 'DELETED' } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findReadyByIds(ids) {
    return prisma.file_uploads.findMany({
      where: { id: { in: ids }, status: 'READY' },
    });
  }

  async updateStatus(id, status, extra = {}) {
    return prisma.file_uploads.update({
      where: { id },
      data: { status, ...extra },
    });
  }

  async linkToMessage(id, messageId) {
    return prisma.file_uploads.update({
      where: { id },
      data: { messageId },
    });
  }

  async linkToTrip(ids, tripId) {
    return prisma.file_uploads.updateMany({
      where: { id: { in: ids } },
      data: { tripId },
    });
  }

  async findForCleanup(olderThanDays = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    return prisma.file_uploads.findMany({
      where: {
        persist: false,
        status: { not: 'DELETED' },
        createdAt: { lt: cutoff },
      },
    });
  }

  async softDelete(id) {
    return prisma.file_uploads.update({
      where: { id },
      data: { status: 'DELETED' },
    });
  }
}

export default new FileUploadRepository();
