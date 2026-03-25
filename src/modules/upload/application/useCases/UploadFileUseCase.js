import { v4 as uuidv4 } from 'uuid';
import config from '../../../../config/index.js';
import R2StorageService from '../../../image/infrastructure/services/R2StorageService.js';
import FileUploadRepository from '../../infrastructure/repositories/FileUploadRepository.js';
import FileProcessQueueService from '../../infrastructure/services/FileProcessQueueService.js';

const IMAGE_TYPES = new Set(config.upload.allowedImageTypes);

function classifyFile(mimeType) {
  return IMAGE_TYPES.has(mimeType) ? 'IMAGE' : 'DOCUMENT';
}

function inferCategory(fileType) {
  return fileType === 'IMAGE' ? 'INSPIRATION' : 'REFERENCE_DOC';
}

class UploadFileUseCase {
  async execute({ userId, conversationId, file, category }) {
    const fileType = classifyFile(file.mimetype);
    const resolvedCategory = category || inferCategory(fileType);
    const persist = fileType === 'IMAGE';

    const id = uuidv4();
    const ext = file.originalname.split('.').pop().toLowerCase();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const r2Key = `uploads/${year}/${month}/${id}.${ext}`;
    const r2Bucket = config.r2.bucketName;

    const record = await FileUploadRepository.create({
      id,
      userId,
      conversationId,
      fileName: file.originalname,
      fileType,
      mimeType: file.mimetype,
      fileSize: file.size,
      r2Key,
      r2Bucket,
      status: 'UPLOADING',
      category: resolvedCategory,
      persist,
    });

    await R2StorageService.upload(r2Key, file.buffer, file.mimetype);

    await FileProcessQueueService.addJob({
      fileUploadId: id,
      r2Key,
      r2Bucket,
      fileType,
      mimeType: file.mimetype,
      fileName: file.originalname,
    });

    await FileUploadRepository.updateStatus(id, 'PROCESSING');

    return record;
  }
}

export default new UploadFileUseCase();
