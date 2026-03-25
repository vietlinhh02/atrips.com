'use client';

import { useState, useCallback, useRef } from 'react';
import { CloudArrowUp } from '@phosphor-icons/react';

import useChatStore from '@/src/stores/chatStore';

interface FileDropZoneProps {
  className?: string;
}

export default function FileDropZone({ className }: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addAttachment = useChatStore((s) => s.addAttachment);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        addAttachment(file);
      }
    },
    [addAttachment]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
        e.target.value = '';
      }
    },
    [handleFiles]
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[10px] border-2 border-dashed px-4 py-5 transition-colors ${
        isDragOver
          ? 'border-[var(--primary-main)] bg-[var(--primary-surface)]'
          : 'border-[var(--neutral-30)] bg-[var(--neutral-20)] hover:border-[var(--neutral-50)]'
      } ${className ?? ''}`}
    >
      <CloudArrowUp
        size={28}
        weight="duotone"
        className={
          isDragOver
            ? 'text-[var(--primary-main)]'
            : 'text-[var(--neutral-50)]'
        }
      />
      <span className="text-[13px] font-medium text-[var(--neutral-60)]">
        {isDragOver ? 'Drop files here' : 'Drop files or click to browse'}
      </span>
      <span className="text-[11px] text-[var(--neutral-50)]">
        JPEG, PNG, WebP, PDF, DOCX, XLSX, CSV (max 10MB)
      </span>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,application/pdf,.docx,.xlsx,.csv"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
