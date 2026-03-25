'use client';

import {
  Image as ImageIcon,
  FileDoc,
  FileXls,
  FileCsv,
  FilePdf,
  File as FileIcon,
  CircleNotch,
  CheckCircle,
  WarningCircle,
} from '@phosphor-icons/react';

import type { FileUploadRecord } from '@/src/types/upload.types';

function getFileIcon(record: FileUploadRecord) {
  if (record.fileType === 'IMAGE') return ImageIcon;
  if (record.mimeType === 'application/pdf') return FilePdf;
  if (record.mimeType.includes('wordprocessingml')) return FileDoc;
  if (record.mimeType.includes('spreadsheetml')) return FileXls;
  if (record.mimeType === 'text/csv') return FileCsv;
  return FileIcon;
}

function StatusBadge({ status }: { status: FileUploadRecord['status'] }) {
  switch (status) {
    case 'READY':
      return (
        <span className="flex items-center gap-1 text-[11px] text-green-600">
          <CheckCircle size={12} weight="fill" />
          Ready
        </span>
      );
    case 'PROCESSING':
    case 'UPLOADING':
      return (
        <span className="flex items-center gap-1 text-[11px] text-[var(--primary-main)]">
          <CircleNotch size={12} weight="bold" className="animate-spin" />
          Processing
        </span>
      );
    case 'FAILED':
      return (
        <span className="flex items-center gap-1 text-[11px] text-red-500">
          <WarningCircle size={12} weight="fill" />
          Failed
        </span>
      );
    default:
      return null;
  }
}

interface ConversationFileListProps {
  files: FileUploadRecord[];
  className?: string;
}

export default function ConversationFileList({
  files,
  className,
}: ConversationFileListProps) {
  if (files.length === 0) return null;

  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <h4 className="text-[12px] font-medium text-[var(--neutral-60)] uppercase tracking-wider">
        Uploaded Files
      </h4>
      <div className="space-y-1">
        {files.map((file) => {
          const Icon = getFileIcon(file);
          return (
            <div
              key={file.id}
              className="flex items-center gap-2 rounded-[8px] px-2.5 py-2 bg-[var(--neutral-20)] hover:bg-[var(--neutral-30)] transition-colors"
            >
              <Icon
                size={18}
                weight="duotone"
                className="shrink-0 text-[var(--neutral-60)]"
              />
              <span className="flex-1 min-w-0 truncate text-[13px] text-[var(--neutral-80)]">
                {file.fileName}
              </span>
              <StatusBadge status={file.status} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
