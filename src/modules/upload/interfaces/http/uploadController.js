import UploadFileUseCase from '../../application/useCases/UploadFileUseCase.js';
import FileUploadRepository from '../../infrastructure/repositories/FileUploadRepository.js';
import R2StorageService from '../../../image/infrastructure/services/R2StorageService.js';
import config from '../../../../config/index.js';

export async function uploadFiles(req, res) {
  const userId = req.user.id;
  const { conversationId, category } = req.body;

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files provided' });
  }

  if (conversationId) {
    const existing =
      await FileUploadRepository.findByConversationId(conversationId);
    const total = existing.length + req.files.length;
    if (total > config.upload.maxFilesPerConversation) {
      return res.status(429).json({
        error: `Maximum ${config.upload.maxFilesPerConversation} files per conversation`,
      });
    }
  }

  const uploads = await Promise.all(
    req.files.map((file) =>
      UploadFileUseCase.execute({
        userId,
        conversationId,
        file,
        category,
      })
    )
  );

  return res.status(201).json({ uploads });
}

export async function getFileStatus(req, res) {
  const record = await FileUploadRepository.findById(req.params.id);
  if (!record) {
    return res.status(404).json({ error: 'File not found' });
  }
  if (record.userId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return res.json(record);
}

export async function getConversationFiles(req, res) {
  const files = await FileUploadRepository.findByConversationId(
    req.params.conversationId
  );
  const userFiles = files.filter(f => f.userId === req.user.id);
  return res.json({ files: userFiles });
}

export async function serveFile(req, res) {
  const record = await FileUploadRepository.findById(req.params.id);
  if (!record || record.status === 'DELETED' || !record.r2Key) {
    return res.status(404).json({ error: 'File not found' });
  }

  const buffer = await R2StorageService.download(record.r2Key);
  res.setHeader('Content-Type', record.mimeType);
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Cache-Control', 'private, max-age=86400');
  return res.send(buffer);
}

export async function deleteFile(req, res) {
  const record = await FileUploadRepository.findById(req.params.id);
  if (!record) {
    return res.status(404).json({ error: 'File not found' });
  }
  if (record.userId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  await FileUploadRepository.softDelete(req.params.id);
  return res.json({ success: true });
}
