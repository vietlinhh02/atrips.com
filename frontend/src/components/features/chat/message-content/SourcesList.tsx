'use client';

import { memo, useState, useRef, useEffect, useMemo } from 'react';
import { Globe, CaretDown, CaretUp, Link as LinkIcon } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { type SourceItem } from '../types';

interface SourcesListProps {
  sources: SourceItem[];
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).origin;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return '';
  }
}

interface IndexedSource extends SourceItem {
  /** Original 1-based index matching AI citation [n] */
  originalIndex: number;
}

/**
 * Deduplicate sources by domain, keeping the FIRST occurrence's original index.
 * This ensures [n] badges in the panel match [n] citations in the text.
 */
function dedupeByDomain(sources: SourceItem[]): IndexedSource[] {
  const seen = new Set<string>();
  const result: IndexedSource[] = [];
  for (let i = 0; i < sources.length; i++) {
    const domain = getDomain(sources[i].url);
    if (seen.has(domain)) continue;
    seen.add(domain);
    result.push({ ...sources[i], originalIndex: i + 1 });
  }
  return result;
}

const SourcesList = memo(({ sources }: SourcesListProps) => {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const uniqueSources = useMemo(() => dedupeByDomain(sources), [sources]);

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!uniqueSources || uniqueSources.length === 0) return null;

  const visibleSources = expanded ? uniqueSources : uniqueSources.slice(0, 4);
  const hasMore = uniqueSources.length > 4;

  return (
    <div className="relative mt-2 inline-block" ref={panelRef}>
      {/* Collapsed: favicon row */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full border border-[var(--neutral-30)] bg-[var(--neutral-10)]/60 px-3 py-1.5 transition-colors hover:bg-[var(--neutral-20)]/80 backdrop-blur-sm"
      >
        <div className="flex -space-x-1.5">
          {uniqueSources.slice(0, 4).map((source) => (
            <img
              key={source.originalIndex}
              src={getFaviconUrl(source.url)}
              alt=""
              width={16}
              height={16}
              className="h-4 w-4 rounded-full border border-white bg-white object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ))}
        </div>
        <span className="text-[11px] font-medium text-[var(--neutral-60)]">
          {uniqueSources.length} nguồn
        </span>
        {open ? <CaretUp size={10} className="text-[var(--neutral-50)]" /> : <CaretDown size={10} className="text-[var(--neutral-50)]" />}
      </button>

      {/* Expanded panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 z-20 mb-1.5 w-[340px] rounded-[12px] border border-[var(--neutral-20)] bg-white/95 p-2.5 shadow-xl backdrop-blur-md"
          >
            <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-medium text-[var(--neutral-50)]">
              <LinkIcon size={12} weight="bold" />
              <span>Nguồn tham khảo</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {visibleSources.map((source) => (
                <a
                  key={source.originalIndex}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2 rounded-[6px] px-2 py-1.5 transition-colors hover:bg-[var(--neutral-10)]"
                >
                  <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary-main)]/10 text-[9px] font-bold text-[var(--primary-main)]">
                    {source.originalIndex}
                  </span>
                  <img
                    src={getFaviconUrl(source.url)}
                    alt=""
                    width={14}
                    height={14}
                    className="h-3.5 w-3.5 flex-shrink-0 rounded-sm object-contain"
                    onError={(e) => {
                      const el = e.target as HTMLImageElement;
                      el.style.display = 'none';
                      el.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                  <Globe size={14} className="hidden flex-shrink-0 text-[var(--neutral-50)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-[var(--neutral-80)] group-hover:text-[var(--primary-main)]">
                      {source.title || getDomain(source.url)}
                    </p>
                    <p className="truncate text-[10px] text-[var(--neutral-40)]">
                      {getDomain(source.url)}
                    </p>
                  </div>
                </a>
              ))}
            </div>
            {hasMore && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-1 flex w-full items-center justify-center gap-1 rounded-[6px] py-1 text-[11px] text-[var(--neutral-50)] transition-colors hover:bg-[var(--neutral-10)] hover:text-[var(--primary-main)]"
              >
                {expanded ? (
                  <>Thu gọn <CaretUp size={10} /></>
                ) : (
                  <>Xem thêm {uniqueSources.length - 4} nguồn <CaretDown size={10} /></>
                )}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

SourcesList.displayName = 'SourcesList';

export default SourcesList;
