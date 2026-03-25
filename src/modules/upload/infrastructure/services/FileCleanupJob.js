import r2StorageService from '../../../image/infrastructure/services/R2StorageService.js';
import FileUploadRepository from '../repositories/FileUploadRepository.js';
import { logger } from '../../../../shared/services/LoggerService.js';

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function runCleanup() {
  logger.info('[FileCleanup] Starting cleanup of expired files...');

  const expiredFiles = await FileUploadRepository.findForCleanup(7);

  let deleted = 0;
  for (const file of expiredFiles) {
    try {
      if (file.r2Key) {
        await r2StorageService.delete(file.r2Key);
      }
      await FileUploadRepository.softDelete(file.id);
      deleted++;
    } catch (err) {
      logger.error(
        `[FileCleanup] Failed to clean up file ${file.id}: ${err.message}`
      );
    }
  }

  logger.info(
    `[FileCleanup] Cleaned up ${deleted}/${expiredFiles.length} expired files`
  );
}

export function startCleanupScheduler() {
  setTimeout(() => {
    runCleanup().catch((err) => {
      logger.error(`[FileCleanup] Cleanup run failed: ${err.message}`);
    });
    setInterval(
      () =>
        runCleanup().catch((err) => {
          logger.error(`[FileCleanup] Cleanup run failed: ${err.message}`);
        }),
      CLEANUP_INTERVAL_MS
    );
  }, 60 * 1000);

  logger.info('[FileCleanup] Cleanup scheduler started (runs every 24h)');
}
