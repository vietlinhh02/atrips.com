export interface FileUploadRecord {
  id: string;
  fileName: string;
  fileType: 'IMAGE' | 'DOCUMENT';
  mimeType: string;
  fileSize: number;
  status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED' | 'DELETED';
  category: 'INSPIRATION' | 'REFERENCE_DOC' | 'BOOKING';
  publicUrl?: string;
  variants?: {
    thumb: string;
    card: string;
    hero: string;
    original: string;
  };
  extractedText?: string;
  extractionMeta?: Record<string, unknown>;
  createdAt: string;
}

export interface PendingAttachment {
  id: string;
  file: File;
  fileName: string;
  fileType: 'IMAGE' | 'DOCUMENT';
  previewUrl?: string;
  progress: number;
  status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED';
  record?: FileUploadRecord;
  error?: string;
}

export interface UploadResponse {
  uploads: FileUploadRecord[];
}
