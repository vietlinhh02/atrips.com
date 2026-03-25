'use client';

import {
  X,
  CircleNotch,
  CheckCircle,
  WarningCircle,
  FileDoc,
  FileXls,
  FileCsv,
  FilePdf,
  File as FileIcon,
} from '@phosphor-icons/react';

import type { PendingAttachment } from '@/src/types/upload.types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDocIcon(mimeType: string) {
  if (mimeType === 'application/pdf') return FilePdf;
  if (mimeType.includes('wordprocessingml')) return FileDoc;
  if (mimeType.includes('spreadsheetml')) return FileXls;
  if (mimeType === 'text/csv') return FileCsv;
  return FileIcon;
}

function StatusIndicator({ status }: { status: PendingAttachment['status'] }) {
  switch (status) {
    case 'UPLOADING':
    case 'PROCESSING':
      return (
        <CircleNotch
          size={14}
          weight="bold"
          className="animate-spin text-[var(--primary-main)]"
        />
      );
    case 'READY':
      return (
        <CheckCircle
          size={14}
          weight="fill"
          className="text-green-500"
        />
      );
    case 'FAILED':
      return (
        <WarningCircle
          size={14}
          weight="fill"
          className="text-red-500"
        />
      );
  }
}

interface FileAttachmentPreviewProps {
  attachments: PendingAttachment[];
  onRemove: (id: string) => void;
}

export default function FileAttachmentPreview({
  attachments,
  onRemove,
}: FileAttachmentPreviewProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 px-1">
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="group relative flex shrink-0 items-center gap-2 rounded-[8px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-2.5 py-1.5 shadow-sm"
        >
          {/* Thumbnail or doc icon */}
          {attachment.fileType === 'IMAGE' && attachment.previewUrl ? (
            <img
              src={attachment.previewUrl}
              alt={attachment.fileName}
              className="h-8 w-8 rounded-[4px] object-cover"
            />
          ) : (
            (() => {
              const DocIcon = getDocIcon(attachment.file.type);
              return (
                <DocIcon
                  size={20}
                  weight="duotone"
                  className="text-[var(--neutral-60)]"
                />
              );
            })()
          )}

          {/* File info */}
          <div className="flex flex-col min-w-0">
            <span className="max-w-[120px] truncate text-[12px] font-medium text-[var(--neutral-80)]">
              {attachment.fileName}
            </span>
            <span className="text-[11px] text-[var(--neutral-50)]">
              {formatFileSize(attachment.file.size)}
            </span>
          </div>

          {/* Status */}
          <StatusIndicator status={attachment.status} />

          {/* Error tooltip */}
          {attachment.error && (
            <span className="text-[11px] text-red-500">
              {attachment.error}
            </span>
          )}

          {/* Remove button */}
          <button
            type="button"
            onClick={() => onRemove(attachment.id)}
            className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[var(--neutral-50)] transition-colors hover:bg-[var(--neutral-30)] hover:text-[var(--neutral-80)]"
            aria-label={`Remove ${attachment.fileName}`}
          >
            <X size={12} weight="bold" />
          </button>
        </div>
      ))}
    </div>
  );
}
