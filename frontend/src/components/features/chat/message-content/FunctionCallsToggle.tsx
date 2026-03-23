'use client';

import { memo, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Spinner,
  CaretDown,
  MapPin,
  MagnifyingGlass,
  Buildings,
  ForkKnife,
  Bed,
  Ticket,
  Car,
  Globe,
  Article,
  CheckCircle,
} from '@phosphor-icons/react';

interface FunctionCallItem {
  name: string;
  arguments: Record<string, unknown>;
}

interface ToolResultItem {
  name: string;
  result: unknown;
}

function getFunctionIcon(name: string) {
  if (
    name.includes('search') &&
    (name.includes('web') || name.includes('exa'))
  ) {
    return Globe;
  }
  switch (name) {
    case 'search_places':
      return MagnifyingGlass;
    case 'get_directions':
      return Car;
    case 'search_hotels':
    case 'Tìm khách sạn':
      return Bed;
    case 'search_restaurants':
    case 'Tìm nhà hàng':
      return ForkKnife;
    case 'search_attractions':
    case 'Tìm điểm tham quan':
      return Ticket;
    case 'get_location':
      return MapPin;
    case 'exa_search':
    case 'web_search':
      return Globe;
    case 'read_website':
      return Article;
    case 'Tìm hoạt động':
      return MapPin;
    case 'Tìm phương tiện':
      return Car;
    case 'Tìm giải trí đêm':
      return Ticket;
    case 'Tạo lịch trình':
      return Article;
    default:
      if (name.includes('search')) return MagnifyingGlass;
      return Buildings;
  }
}

// Vietnamese pipeline tool names are already display-ready
const VIETNAMESE_TOOL_NAMES = new Set([
  'Tìm điểm tham quan',
  'Tìm nhà hàng',
  'Tìm khách sạn',
  'Tìm hoạt động',
  'Tìm phương tiện',
  'Tìm giải trí đêm',
  'Tạo lịch trình',
]);

function formatToolName(name: string): string {
  if (VIETNAMESE_TOOL_NAMES.has(name)) return name;
  if (name === 'exa_search' || name === 'web_search')
    return 'Tìm kiếm thông tin (Exa)';
  if (name === 'search_places') return 'Tìm kiếm địa điểm';
  if (name === 'get_directions') return 'Tìm đường đi';
  if (name === 'search_hotels') return 'Tìm khách sạn';
  if (name === 'search_restaurants') return 'Tìm nhà hàng';
  if (name === 'create_trip_plan') return 'Tạo lịch trình';
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

interface FunctionCallsToggleProps {
  functionCalls: FunctionCallItem[];
  toolResults?: ToolResultItem[];
  isStreaming?: boolean;
}

const FunctionCallsToggle = memo(
  ({
    functionCalls,
    toolResults,
    isStreaming = false,
  }: FunctionCallsToggleProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

    const completedNames = useMemo(() => {
      if (!toolResults) return new Set<string>();
      return new Set(toolResults.map((tr) => tr.name));
    }, [toolResults]);

    if (!functionCalls || functionCalls.length === 0) {
      return null;
    }

    const totalCount = functionCalls.length;
    const completedCount = toolResults?.length ?? 0;
    const allDone = !isStreaming && completedCount >= totalCount;
    const progressPct =
      totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const grouped = functionCalls.reduce<
      Record<
        string,
        { count: number; icon: typeof Buildings; completed: number }
      >
    >((acc, fc) => {
      const name = formatToolName(fc.name);
      if (!acc[name]) {
        acc[name] = { count: 0, icon: getFunctionIcon(fc.name), completed: 0 };
      }
      acc[name].count++;
      if (completedNames.has(fc.name)) {
        acc[name].completed++;
      }
      return acc;
    }, {});

    const entries = Object.entries(grouped);

    return (
      <div className="relative">
        <button
          type="button"
          onClick={toggle}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--neutral-15)] px-2.5 py-1 text-sm border border-[var(--neutral-30)] hover:bg-[var(--neutral-20)] transition-colors"
        >
          {!allDone && (
            <Spinner
              size={12}
              className="animate-spin text-[var(--primary-main)] flex-shrink-0"
            />
          )}
          {allDone && (
            <CheckCircle
              size={12}
              weight="fill"
              className="text-green-500 flex-shrink-0"
            />
          )}
          <span className="text-[11px] font-medium text-[var(--neutral-80)]">
            {allDone
              ? `Đã sử dụng ${totalCount} công cụ`
              : `${completedCount}/${totalCount} công cụ hoàn tất`}
          </span>
          <CaretDown
            size={12}
            weight="bold"
            className={`text-[var(--neutral-50)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {!allDone && (
          <div className="absolute left-2.5 right-2.5 bottom-0 h-[2px] rounded-full bg-[var(--neutral-30)] overflow-hidden">
            <motion.div
              className="h-full bg-[var(--primary-main)] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        )}

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="absolute left-0 top-full mt-1.5 z-10 overflow-hidden rounded-lg border border-[var(--neutral-30)] bg-[var(--neutral-10)] backdrop-blur-sm shadow-md min-w-[200px] origin-top"
            >
              <div className="flex flex-col gap-0.5 px-3 py-2">
                {entries.map(
                  ([name, { count, icon: Icon, completed }], idx) => {
                    const isDone = completed >= count;
                    return (
                      <motion.div
                        key={name}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04, duration: 0.2 }}
                        className="flex items-center gap-1.5 py-0.5 text-[11px] text-[var(--neutral-70)]"
                      >
                        <span className="text-[var(--neutral-40)] w-3 text-right shrink-0">
                          {idx + 1}.
                        </span>
                        <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--primary-surface)] text-[var(--primary-main)] shrink-0">
                          <Icon size={9} weight="bold" />
                        </div>
                        <span className="font-medium whitespace-nowrap">
                          {name}
                        </span>
                        {count > 1 && (
                          <span className="text-[var(--neutral-50)]">
                            x{count}
                          </span>
                        )}
                        {isDone ? (
                          <CheckCircle
                            size={10}
                            weight="fill"
                            className="text-green-500 shrink-0 ml-auto"
                          />
                        ) : (
                          <Spinner
                            size={10}
                            className="animate-spin text-[var(--primary-main)] shrink-0 ml-auto"
                          />
                        )}
                      </motion.div>
                    );
                  },
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);

FunctionCallsToggle.displayName = 'FunctionCallsToggle';

export default FunctionCallsToggle;
