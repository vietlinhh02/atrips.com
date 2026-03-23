'use client';

import { memo, useMemo } from 'react';
import FunctionCallsToggle from './FunctionCallsToggle';
import MarkdownContent from './MarkdownContent';
import { type FunctionCall } from './types';
import { type SourceItem } from '../types';

// Parse content to extract function calls
function parseFunctionCalls(content: string): {
  textContent: string;
  functionCalls: FunctionCall[];
} {
  const functionCalls: FunctionCall[] = [];
  let textContent = content;

  // Match JSON function call patterns
  const functionCallRegex = /\{"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*(\{[^}]+\})\}/g;

  let match;
  while ((match = functionCallRegex.exec(content)) !== null) {
    try {
      const functionCall: FunctionCall = {
        name: match[1],
        arguments: JSON.parse(match[2]),
      };
      functionCalls.push(functionCall);
      // Remove the function call from text content
      textContent = textContent.replace(match[0], '');
    } catch {
      // If parsing fails, keep it in text content
    }
  }

  // Strip <suggestions>...</suggestions> tags (handled separately as clickable chips)
  textContent = textContent.replace(/<suggestions>[\s\S]*?<\/suggestions>/g, '');

  return { textContent: textContent.trim(), functionCalls };
}

interface MessageContentProps {
  content: string;
  isStreaming?: boolean;
  sources?: SourceItem[];
}

export const MessageContent = memo(({ content, isStreaming, sources }: MessageContentProps) => {
  const { textContent, functionCalls } = useMemo(() => parseFunctionCalls(content), [content]);

  return (
    <div className="space-y-1">
      {/* Render function call cards */}
      {functionCalls.length > 0 && (
        <FunctionCallsToggle functionCalls={functionCalls} isStreaming={isStreaming} />
      )}

      {/* Render markdown text content */}
      {textContent && <MarkdownContent content={textContent} sources={sources} />}

      {/* Streaming indicator */}
      {isStreaming && <span className="ml-1 inline-block animate-typing-cursor text-[var(--primary-main)]">▊</span>}
    </div>
  );
});

MessageContent.displayName = 'MessageContent';

export default MessageContent;
