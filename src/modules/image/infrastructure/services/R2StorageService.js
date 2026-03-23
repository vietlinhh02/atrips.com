/**
 * R2 Storage Service
 * S3-compatible client for Cloudflare R2 object storage
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import config from '../../../../config/index.js';
import { logger } from '../../../../shared/services/LoggerService.js';

class R2StorageService {
  constructor() {
    this.client = null;
    this.isReady = false;
  }

  /**
   * Initialize the R2 client. Returns true if configured, false otherwise.
   */
  init() {
    const { accountId, accessKeyId, secretAccessKey } = config.r2;

    if (!accountId || !accessKeyId || !secretAccessKey) {
      logger.warn('[R2] Missing R2 credentials — image pipeline disabled');
      return false;
    }

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.isReady = true;
    logger.info('[R2] Storage service initialized');
    return true;
  }

  /**
   * Upload a buffer to R2
   * @param {string} key - Object key (path)
   * @param {Buffer} buffer - File content
   * @param {string} contentType - MIME type
   * @returns {Promise<{key: string, bucket: string}>}
   */
  async upload(key, buffer, contentType) {
    if (!this.isReady) throw new Error('R2 not initialized');

    const bucketName = config.r2.bucketName;

    await this.client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    return { key, bucket: bucketName };
  }

  /**
   * Delete an object from R2
   */
  async delete(key) {
    if (!this.isReady) throw new Error('R2 not initialized');

    await this.client.send(new DeleteObjectCommand({
      Bucket: config.r2.bucketName,
      Key: key,
    }));
  }

  /**
   * Get the public URL for a key
   */
  getPublicUrl(key) {
    const publicUrl = config.r2.publicUrl;
    if (!publicUrl) return null;
    return `${publicUrl.replace(/\/$/, '')}/${key}`;
  }

  /**
   * Generate variant URLs using Cloudflare Image Resizing
   * Cloudflare Workers routes handle /cdn-cgi/image/ transformations
   */
  getVariantUrls(baseKey) {
    const publicUrl = config.r2.publicUrl;
    if (!publicUrl) return null;

    const base = publicUrl.replace(/\/$/, '');
    const originalUrl = `${base}/${baseKey}`;

    return {
      thumb: `${base}/cdn-cgi/image/width=200,height=150,fit=cover/${baseKey}`,
      card: `${base}/cdn-cgi/image/width=400,height=300,fit=cover/${baseKey}`,
      hero: `${base}/cdn-cgi/image/width=800,height=600,fit=cover/${baseKey}`,
      original: originalUrl,
    };
  }

  /**
   * Instance wrapper for key generation
   */
  buildKey(provider, assetId, ext = 'jpg') {
    return R2StorageService.buildKey(provider, assetId, ext);
  }

  /**
   * Generate R2 key for an image
   * Pattern: images/{provider}/{YYYY}/{MM}/{assetId}.{ext}
   */
  static buildKey(provider, assetId, ext = 'jpg') {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const providerSlug = provider.toLowerCase().replace(/_/g, '-');
    return `images/${providerSlug}/${yyyy}/${mm}/${assetId}.${ext}`;
  }
}

export default new R2StorageService();
