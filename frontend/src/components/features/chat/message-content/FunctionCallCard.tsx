'use client';

import { memo, useState, useEffect, useRef } from 'react';
import {
  MapPin,
  MagnifyingGlass,
  Spinner,
  Buildings,
  ForkKnife,
  Bed,
  Ticket,
  Car,
  Globe,
  Article,
  CheckCircle,
  XCircle,
} from '@phosphor-icons/react';
import { type FunctionCall } from './types';

const FUNCTION_ICON_MAP: Record<string, typeof Buildings> = {
  search_places: MagnifyingGlass,
  get_directions: Car,
  search_hotels: Bed,
  search_restaurants: ForkKnife,
  search_attractions: Ticket,
  get_location: MapPin,
  exa_search: Globe,
  web_search: Globe,
  read_website: Article,
};

function getFunctionIconName(name: string): typeof Buildings {
  if (
    name.includes('search') &&
    (name.includes('web') || name.includes('exa'))
  ) {
    return Globe;
  }
  if (FUNCTION_ICON_MAP[name]) return FUNCTION_ICON_MAP[name];
  if (name.includes('search')) return MagnifyingGlass;
  return Buildings;
}

function formatToolName(name: string): string {
  if (name === 'exa_search' || name === 'web_search')
    return 'Tìm kiếm thông tin (Exa)';
  if (name === 'search_places') return 'Tìm kiếm địa điểm';
  if (name === 'get_directions') return 'Tìm đường đi';
  if (name === 'search_hotels') return 'Tìm khách sạn';
  if (name === 'search_restaurants') return 'Tìm nhà hàng';

  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function countResults(result: unknown): number | null {
  if (result == null) return null;
  if (Array.isArray(result)) return result.length;
  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    for (const key of ['results', 'items', 'data', 'places', 'hotels']) {
      if (Array.isArray(obj[key])) {
        return (obj[key] as unknown[]).length;
      }
    }
  }
  return null;
}

type ToolStatus = 'loading' | 'success' | 'error';

interface FunctionCallCardProps {
  functionCall: FunctionCall;
  isLoading?: boolean;
  toolResult?: unknown;
  hasError?: boolean;
}

const FunctionCallCard = memo(
  ({
    functionCall,
    isLoading = true,
    toolResult,
    hasError = false,
  }: FunctionCallCardProps) => {
    const displayName = formatToolName(functionCall.name);
    const IconComponent = getFunctionIconName(functionCall.name);
    const mountTimeRef = useRef(Date.now());
    const [elapsedMs, setElapsedMs] = useState<number | null>(null);

    const status: ToolStatus = hasError
      ? 'error'
      : toolResult !== undefined && !isLoading
        ? 'success'
        : 'loading';

    useEffect(() => {
      if (status !== 'loading') {
        setElapsedMs(Date.now() - mountTimeRef.current);
      }
    }, [status]);

    const resultCount = countResults(toolResult);
    const elapsedLabel =
      elapsedMs !== null ? `${(elapsedMs / 1000).toFixed(1)}s` : null;

    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--neutral-15)] px-2.5 py-1 text-sm border border-[var(--neutral-30)] transition-colors">
        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--primary-surface)] text-[var(--primary-main)] flex-shrink-0">
          <IconComponent size={10} weight="bold" />
        </div>

        <span className="text-[11px] font-medium text-[var(--neutral-80)] whitespace-nowrap">
          {displayName}
        </span>

        {status === 'loading' && (
          <Spinner
            size={12}
            className="animate-spin text-[var(--primary-main)] flex-shrink-0"
          />
        )}
        {status === 'success' && (
          <CheckCircle
            size={12}
            weight="fill"
            className="text-green-500 flex-shrink-0"
          />
        )}
        {status === 'error' && (
          <XCircle
            size={12}
            weight="fill"
            className="text-red-500 flex-shrink-0"
          />
        )}

        {status === 'success' && resultCount !== null && (
          <span className="text-[10px] text-[var(--neutral-50)] whitespace-nowrap">
            {resultCount} kết quả
          </span>
        )}

        {elapsedLabel && (
          <span className="text-[10px] text-[var(--neutral-40)] whitespace-nowrap">
            {elapsedLabel}
          </span>
        )}
      </div>
    );
  },
);

FunctionCallCard.displayName = 'FunctionCallCard';

export default FunctionCallCard;
