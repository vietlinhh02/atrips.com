'use client';

import { memo, useState, useCallback, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CaretDown } from '@phosphor-icons/react';
import { sanitizeUrl } from '@/src/lib/sanitize';
import { type SourceItem } from '../types';

/** Render inline citation badge [n] */
function CitationBadge({ num, url }: { num: number; url?: string }) {
  const badge = (
    <span className="mx-[1px] inline-flex h-[16px] min-w-[16px] cursor-pointer items-center justify-center rounded-full bg-[var(--primary-main)]/10 px-[4px] align-super text-[9px] font-bold leading-none text-[var(--primary-main)] transition-colors hover:bg-[var(--primary-main)]/20">
      {num}
    </span>
  );
  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="no-underline">
        {badge}
      </a>
    );
  }
  return badge;
}

/**
 * Process text node children to find [n] citation patterns and replace with CitationBadge.
 * sources is a deduplicated array so [1] maps to sources[0], etc.
 */
function renderWithCitations(children: ReactNode, sources?: SourceItem[]): ReactNode {
  if (!sources || sources.length === 0) return children;

  if (typeof children === 'string') {
    // Split on citation pattern [1], [2], etc.
    const parts = children.split(/(\[\d+\])/g);
    if (parts.length === 1) return children; // no citations found

    return parts.map((part, i) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (match) {
        const num = parseInt(match[1], 10);
        const source = sources[num - 1];
        return <CitationBadge key={i} num={num} url={source?.url} />;
      }
      return part;
    });
  }

  // If children is an array, process each child
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      if (typeof child === 'string') {
        const result = renderWithCitations(child, sources);
        return typeof result === 'string' ? result : <span key={i}>{result}</span>;
      }
      return child;
    });
  }

  return children;
}

interface MarkdownContentProps {
  content: string;
  sources?: SourceItem[];
}

function CollapsibleTable({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return (
    <div className="my-2 rounded-lg border border-[var(--neutral-30)] overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between bg-[var(--neutral-20)] px-3 py-2 text-[13px] font-semibold text-[var(--neutral-90)] hover:bg-[var(--neutral-30)] transition-colors"
      >
        <span>View Table</span>
        <CaretDown
          size={16}
          weight="bold"
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            {children}
          </table>
        </div>
      )}
    </div>
  );
}

const MarkdownContent = memo(({ content, sources }: MarkdownContentProps) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      disallowedElements={['script', 'iframe', 'object', 'embed', 'style']}
      unwrapDisallowed={true}
      components={{
        // Headings
        h1: ({ children }) => (
          <h1 className="mb-3 mt-4 text-[18px] font-bold text-[var(--neutral-100)]">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-2 mt-3 text-[16px] font-semibold text-[var(--neutral-100)]">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-2 mt-3 text-[15px] font-semibold text-[var(--neutral-90)]">
            {children}
          </h3>
        ),
        // Paragraph
        p: ({ children }) => (
          <p className="mb-2 text-[14px] leading-[1.6] text-[var(--neutral-80)]">
            {renderWithCitations(children, sources)}
          </p>
        ),
        // Lists
        ul: ({ children }) => (
          <ul className="mb-2 ml-4 list-disc space-y-1 text-[14px] text-[var(--neutral-80)]">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2 ml-4 list-decimal space-y-1 text-[14px] text-[var(--neutral-80)]">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="leading-[1.6]">{renderWithCitations(children, sources)}</li>
        ),
        // Links
        a: ({ href, children }) => {
          const safeHref = href ? sanitizeUrl(href) : '#';
          return (
            <a
              href={safeHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--primary-main)] underline hover:text-[var(--primary-dark)]"
            >
              {children}
            </a>
          );
        },
        // Bold and italic
        strong: ({ children }) => (
          <strong className="font-semibold text-[var(--neutral-100)]">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic">{children}</em>
        ),
        // Code
        code: ({ children, className }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="rounded bg-[var(--neutral-20)] px-1.5 py-0.5 font-mono text-[13px] text-[var(--neutral-90)]">
                {children}
              </code>
            );
          }
          return (
            <code className="block overflow-x-auto rounded-lg bg-[var(--neutral-100)] p-3 font-mono text-[13px] text-white">
              {children}
            </code>
          );
        },
        // Pre for code blocks
        pre: ({ children }) => (
          <pre className="my-2 overflow-x-auto rounded-lg bg-[var(--neutral-100)] p-3">
            {children}
          </pre>
        ),
        // Blockquote
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-4 border-[var(--primary-main)] bg-[var(--neutral-10)] py-2 pl-4 text-[14px] italic text-[var(--neutral-70)]">
            {children}
          </blockquote>
        ),
        // Horizontal rule
        hr: () => <hr className="my-4 border-[var(--neutral-30)]" />,
        // Table - collapsible toggle
        table: ({ children }) => <CollapsibleTable>{children}</CollapsibleTable>,
        thead: ({ children }) => (
          <thead className="bg-[var(--neutral-20)]">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="border border-[var(--neutral-30)] px-3 py-2 text-left text-[13px] font-semibold text-[var(--neutral-90)]">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-[var(--neutral-30)] px-3 py-2 text-[13px] text-[var(--neutral-80)]">
            {children}
          </td>
        ),
        // Images - render with proper styling
        // Using span wrapper to avoid hydration errors (figure cannot be inside p)
        img: ({ src, alt }) => {
          // src can be string or Blob, only process strings
          const safeSrc = typeof src === 'string' ? sanitizeUrl(src) : '';
          if (!safeSrc || safeSrc === 'about:blank') {
            return null;
          }
          return (
            <span className="block my-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={safeSrc}
                alt={alt || ''}
                loading="lazy"
                className="max-w-full h-auto rounded-lg shadow-md border border-[var(--neutral-30)]"
                onError={(e) => {
                  // Hide broken images
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              {alt && (
                <span className="block mt-1.5 text-center text-[12px] text-[var(--neutral-50)] italic">
                  {alt}
                </span>
              )}
            </span>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
});

MarkdownContent.displayName = 'MarkdownContent';

export default MarkdownContent;
