/**
 * Upload Service
 * Handles file uploads to Cloudinary and backend file management
 */

import api from '../lib/api';
import type { FileUploadRecord, UploadResponse } from '../types/upload.types';

interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  error?: {
    message: string;
  };
}

class UploadService {
  private cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  private uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  /**
   * Upload avatar image to Cloudinary
   * @param file - Image file from input
   * @returns URL of uploaded image
   */
  async uploadAvatar(file: File): Promise<string> {
    // Validate environment variables
    if (!this.cloudName || !this.uploadPreset) {
      throw new Error(
        'Cloudinary configuration missing. Please set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET in .env.local'
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image (PNG, JPG, GIF, WEBP)');
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error('Image size must not exceed 10MB');
    }

    try {
      // Resize image before upload to optimize
      const resizedFile = await this.resizeImage(file, 800, 800);

      // Prepare form data
      const formData = new FormData();
      formData.append('file', resizedFile);
      formData.append('upload_preset', this.uploadPreset);
      formData.append('folder', 'atrips/avatars');
      // Note: transformation must be configured in Upload Preset on Cloudinary dashboard
      // Cannot pass transformation parameter with unsigned upload

      // Upload to Cloudinary
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Upload failed');
      }

      const data: CloudinaryUploadResponse = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      return data.secure_url;
    } catch (error) {
      console.error('Upload error:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to upload image');
    }
  }

  /**
   * Upload cover image to Cloudinary
   * @param file - Image file from input
   * @returns URL of uploaded image
   */
  async uploadCoverImage(file: File): Promise<string> {
    if (!this.cloudName || !this.uploadPreset) {
      throw new Error(
        'Cloudinary configuration missing. Please set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET in .env.local'
      );
    }

    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image (PNG, JPG, GIF, WEBP)');
    }

    try {
      const resizedFile = await this.resizeImage(file, 1920, 1200);

      const formData = new FormData();
      formData.append('file', resizedFile);
      formData.append('upload_preset', this.uploadPreset);
      formData.append('folder', 'atrips/covers');

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Upload failed');
      }

      const data: CloudinaryUploadResponse = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      return data.secure_url;
    } catch (error) {
      console.error('Cover image upload error:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to upload cover image');
    }
  }

  /**
   * Resize and optimize image before upload
   * Uses canvas to reduce file size and dimensions
   */
  private async resizeImage(
    file: File,
    maxWidth: number,
    maxHeight: number
  ): Promise<File> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;

        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions while maintaining aspect ratio
          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to create blob'));
                return;
              }
              resolve(
                new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                })
              );
            },
            'image/jpeg',
            0.9 // Quality 90%
          );
        };

        img.onerror = () => reject(new Error('Failed to load image'));
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
    });
  }

  /**
   * Generate preview URL from file
   */
  getPreviewUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

const uploadService = new UploadService();
export default uploadService;

// --- Backend file upload utilities ---

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_DOC_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function isAllowedFileType(mimeType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(mimeType) || ALLOWED_DOC_TYPES.includes(mimeType);
}

export function isImageType(mimeType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(mimeType);
}

export function validateFile(file: File): string | null {
  if (!isAllowedFileType(file.type)) {
    return 'File type not supported. Use JPEG, PNG, WebP, PDF, DOCX, XLSX, or CSV.';
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'File too large. Maximum size is 10MB.';
  }
  return null;
}

export async function uploadChatFile(
  file: File,
  conversationId: string,
  category?: string
): Promise<FileUploadRecord> {
  const formData = new FormData();
  formData.append('files', file);
  formData.append('conversationId', conversationId);
  if (category) formData.append('category', category);

  const response = await api.post<UploadResponse>('/uploads', formData, {
    headers: { 'Content-Type': undefined },
  });
  return response.data.uploads[0];
}

export async function getFileStatus(id: string): Promise<FileUploadRecord> {
  const response = await api.get<FileUploadRecord>(`/uploads/${id}`);
  return response.data;
}

export async function getConversationFiles(
  conversationId: string
): Promise<FileUploadRecord[]> {
  const response = await api.get<{ files: FileUploadRecord[] }>(
    `/uploads/conversation/${conversationId}`
  );
  return response.data.files;
}

export async function deleteUploadedFile(id: string): Promise<void> {
  await api.delete(`/uploads/${id}`);
}

export async function pollUntilReady(
  id: string,
  intervalMs = 1500,
  maxAttempts = 20
): Promise<FileUploadRecord> {
  for (let i = 0; i < maxAttempts; i++) {
    const record = await getFileStatus(id);
    if (record.status === 'READY' || record.status === 'FAILED') {
      return record;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('File processing timed out');
}
