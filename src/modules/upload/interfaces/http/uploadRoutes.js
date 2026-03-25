import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import config from '../../../../config/index.js';
import { authenticate } from '../../../../shared/middleware/authenticate.js';
import {
  uploadFiles,
  getFileStatus,
  getConversationFiles,
  serveFile,
  deleteFile,
} from './uploadController.js';

const router = Router();

const allowedTypes = [
  ...config.upload.allowedImageTypes,
  ...config.upload.allowedDocTypes,
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxFileSize,
    files: config.upload.maxFilesPerRequest,
  },
  fileFilter(req, file, cb) {
    cb(null, allowedTypes.includes(file.mimetype));
  },
});

const uploadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.id || 'anonymous',
  message: { error: 'Upload rate limit exceeded. Try again in a minute.' },
  validate: { ipv6SubnetOrKeyGenerator: false, keyGeneratorIpFallback: false },
});

router.post(
  '/',
  authenticate,
  uploadRateLimit,
  upload.array('files', config.upload.maxFilesPerRequest),
  uploadFiles
);
router.get(
  '/conversation/:conversationId',
  authenticate,
  getConversationFiles
);
router.get('/:id/file', authenticate, serveFile);
router.get('/:id', authenticate, getFileStatus);
router.delete('/:id', authenticate, deleteFile);

export default router;
