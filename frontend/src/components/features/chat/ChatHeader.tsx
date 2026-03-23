'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bag,
  Bell,
  CalendarBlank,
  CaretDown,
  CurrencyDollar,
  List,
  MapPin,
  UserPlus,
  UsersThree,
  X,
  Check,
  PencilSimple,
} from '@phosphor-icons/react';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';

import useSidebarStore from '@/src/stores/sidebarStore';
import useTripContextStore from '@/src/stores/tripContextStore';
import useChatStore from '@/src/stores/chatStore';
import NovuInbox from '@/src/components/features/notification/NovuInbox';

interface ChatHeaderProps {
  title?: string;
  onContextChange?: (contextMessage: string) => void;
}

export default function ChatHeader({ title = 'New Trip', onContextChange }: ChatHeaderProps) {
  const router = useRouter();
  const { toggleCollapse } = useSidebarStore();
  const { context, setDestination, setDates, setTravelers, setBudget } = useTripContextStore();
  const { sendMessage, isSubmitting, currentItinerary } = useChatStore();

  // Edit states
  const [editingField, setEditingField] = useState<'destination' | 'dates' | 'travelers' | 'budget' | null>(null);
  const [tempValue, setTempValue] = useState<string>('');
  const [tempStartDate, setTempStartDate] = useState<string>('');
  const [tempEndDate, setTempEndDate] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing
  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingField]);

  // Load context from currentItinerary when it changes
  // Clear context if conversation is reset/null or itinerary is cleared
  const conversationId = useChatStore((state) => state.conversationId);
  useEffect(() => {
    if (!conversationId && !currentItinerary) {
      // Reset context values to defaults
      useTripContextStore.getState().setDestination(null);
      useTripContextStore.getState().setDates(null, null);
      useTripContextStore.getState().setTravelers(1);
      useTripContextStore.getState().setBudget(null);
    }
  }, [conversationId, currentItinerary]);

  // Format date for display
  const formatDateDisplay = (dateStr: string | null): string => {
    if (!dateStr) return '';
    try {
      return format(parseISO(dateStr), 'dd/MM', { locale: vi });
    } catch {
      return dateStr;
    }
  };

  // Get display values
  const destinationDisplay = context.destination || 'Where';
  const datesDisplay = context.startDate && context.endDate
    ? `${formatDateDisplay(context.startDate)} - ${formatDateDisplay(context.endDate)}`
    : context.startDate
      ? formatDateDisplay(context.startDate)
      : 'When';
  const travelersDisplay = `${context.travelers} Traveler${context.travelers > 1 ? 's' : ''}`;
  const budgetDisplay = context.budget && !isNaN(context.budget)
    ? `${new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(context.budget)} ${context.currency}`
    : 'Budget';

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!editingField) return;

    let contextChanged = false;
    let changeMessage = '';

    switch (editingField) {
      case 'destination':
        if (tempValue && tempValue !== context.destination) {
          setDestination(tempValue);
          contextChanged = true;
          changeMessage = `Tôi muốn thay đổi điểm đến thành ${tempValue}. Hãy cập nhật lịch trình phù hợp.`;
        }
        break;
      case 'dates':
        if (tempStartDate && tempStartDate !== context.startDate) {
          setDates(tempStartDate, tempEndDate || null);
          contextChanged = true;
          const dateInfo = tempEndDate
            ? `từ ${tempStartDate} đến ${tempEndDate}`
            : `bắt đầu từ ${tempStartDate}`;
          changeMessage = `Tôi muốn thay đổi thời gian ${dateInfo}. Hãy cập nhật lịch trình phù hợp.`;
        }
        break;
      case 'travelers':
        const newTravelers = parseInt(tempValue) || 1;
        if (newTravelers !== context.travelers) {
          setTravelers(newTravelers);
          contextChanged = true;
          changeMessage = `Số người đi thay đổi thành ${newTravelers} người. Hãy điều chỉnh lịch trình cho phù hợp.`;
        }
        break;
      case 'budget':
        const newBudget = parseInt(tempValue.replace(/[,.]/g, '')) || null;
        if (newBudget !== context.budget) {
          setBudget(newBudget);
          contextChanged = true;
          if (newBudget) {
            changeMessage = `Ngân sách của tôi là ${new Intl.NumberFormat('vi-VN').format(newBudget)} VND. Hãy điều chỉnh lịch trình cho phù hợp với ngân sách này.`;
          }
        }
        break;
    }

    setEditingField(null);
    setTempValue('');
    setTempStartDate('');
    setTempEndDate('');

    // Send context update to AI with the new context
    if (contextChanged && changeMessage && !isSubmitting) {
      // Get the latest context after update
      const latestContext = useTripContextStore.getState().context;
      const aiContext = {
        destination: latestContext.destination,
        startDate: latestContext.startDate,
        endDate: latestContext.endDate,
        travelers: latestContext.travelers,
        budget: latestContext.budget,
        currency: latestContext.currency,
      };

      if (onContextChange) {
        onContextChange(changeMessage);
      } else {
        // Directly send message to AI with context
        await sendMessage(changeMessage, aiContext);
      }
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingField(null);
    setTempValue('');
    setTempStartDate('');
    setTempEndDate('');
  };

  // Start editing a field
  const startEditing = (field: typeof editingField) => {
    setEditingField(field);
    switch (field) {
      case 'destination':
        setTempValue(context.destination || '');
        break;
      case 'dates':
        setTempStartDate(context.startDate || '');
        setTempEndDate(context.endDate || '');
        break;
      case 'travelers':
        setTempValue(context.travelers.toString());
        break;
      case 'budget':
        setTempValue(context.budget?.toString() || '');
        break;
    }
  };

  // Render filter pill
  const renderFilterPill = (
    icon: typeof MapPin,
    label: string,
    field: 'destination' | 'dates' | 'travelers' | 'budget',
    hasValue: boolean
  ) => {
    const Icon = icon;
    const isEditing = editingField === field;

    if (isEditing) {
      return (
        <div className="flex items-center gap-2 rounded-[4px] bg-[var(--neutral-10)] border-2 border-[var(--primary-main)] px-3 py-1 min-w-[120px]">
          {field === 'dates' ? (
            <div className="flex items-center gap-1">
              <input
                ref={inputRef}
                type="date"
                value={tempStartDate}
                onChange={(e) => setTempStartDate(e.target.value)}
                className="w-[110px] text-[14px] outline-none bg-transparent"
              />
              <span className="text-[var(--neutral-60)]">-</span>
              <input
                type="date"
                value={tempEndDate}
                onChange={(e) => setTempEndDate(e.target.value)}
                className="w-[110px] text-[14px] outline-none bg-transparent"
              />
            </div>
          ) : field === 'travelers' ? (
            <input
              ref={inputRef}
              type="number"
              min="1"
              max="50"
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              className="w-[60px] text-[14px] outline-none bg-transparent"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
            />
          ) : field === 'budget' ? (
            <input
              ref={inputRef}
              type="text"
              placeholder="5,000,000"
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              className="w-[100px] text-[14px] outline-none bg-transparent"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
            />
          ) : (
            <input
              ref={inputRef}
              type="text"
              placeholder="Nhập điểm đến..."
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              className="w-[120px] text-[14px] outline-none bg-transparent"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
            />
          )}
          <button
            onClick={handleSaveEdit}
            className="p-1 hover:bg-green-100 rounded text-green-600"
            title="Save"
          >
            <Check size={14} weight="bold" />
          </button>
          <button
            onClick={handleCancelEdit}
            className="p-1 hover:bg-red-100 rounded text-red-500"
            title="Cancel"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
      );
    }

    return (
      <button
        onClick={() => startEditing(field)}
        className={`group flex items-center gap-2 rounded-[4px] px-3 py-1.5 text-[14px] transition-colors
          ${hasValue
            ? 'bg-[var(--primary-light)] text-[var(--primary-main)] hover:bg-[var(--primary-main)] hover:text-white'
            : 'bg-[var(--neutral-30)] text-[var(--neutral-60)] hover:bg-[var(--neutral-40)]'
          }`}
        title={`Click to edit ${field}`}
      >
        <Icon size={16} weight="regular" />
        <span className="whitespace-nowrap">{label}</span>
        <PencilSimple
          size={12}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </button>
    );
  };

  return (
    <header className="bg-[var(--neutral-10)] border-b border-[var(--neutral-30)] w-full grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 md:px-6 py-1.5">
      {/* Left Section */}
      <div className="flex items-center gap-3 justify-start">
        <button
          className="md:hidden p-2 text-[var(--neutral-70)] -ml-2"
          onClick={toggleCollapse}
          aria-label="Toggle sidebar"
        >
          <List size={24} />
        </button>

        {/* Mobile Logo */}
        <div className="flex md:hidden items-center">
          <h1 className="text-xl font-normal text-[#073e71] font-logo cursor-pointer hover:opacity-80 transition-opacity">
            A
          </h1>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <h1 className="text-[18px] font-medium text-[var(--neutral-100)] leading-[1.2]">
            {context.destination || title}
          </h1>
          <CaretDown size={16} className="text-[var(--neutral-100)]" />
        </div>

        {/* Mobile Title (Simplified) */}
        <div className="flex md:hidden items-center gap-1">
          <span className="text-[16px] font-medium text-[var(--neutral-100)] truncate max-w-[150px]">
            {context.destination || title}
          </span>
          <CaretDown size={14} className="text-[var(--neutral-100)]" />
        </div>
      </div>

      {/* Center Section - Filters (Desktop Only) */}
      <div className="hidden lg:flex items-center justify-center">
        <div className="flex items-center gap-2 rounded-[10px] border border-[var(--neutral-30)] px-2 py-1.5">
          {renderFilterPill(MapPin, destinationDisplay, 'destination', !!context.destination)}
          {renderFilterPill(CalendarBlank, datesDisplay, 'dates', !!context.startDate)}
          {renderFilterPill(UsersThree, travelersDisplay, 'travelers', context.travelers > 1)}
          {renderFilterPill(CurrencyDollar, budgetDisplay, 'budget', !!context.budget && !isNaN(context.budget))}
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3 justify-end justify-self-end">
        {/* Novu popup on desktop */}
        <div className="relative z-[60] hidden md:block">
          <NovuInbox />
        </div>
        {/* Navigate to /notifications on mobile */}
        <button
          className="md:hidden bg-[var(--neutral-10)] border border-[var(--neutral-30)] rounded-[10px] w-8 h-8 flex items-center justify-center shadow-[6px_6px_32px_0px_rgba(0,0,0,0.06)] hover:bg-[var(--neutral-20)] transition-colors shrink-0"
          onClick={() => router.push('/notifications')}
          aria-label="Notifications"
        >
          <Bell size={16} weight="regular" />
        </button>

        <div className="hidden sm:flex items-center gap-2">
          <button className="border border-[var(--neutral-40)] rounded-[4px] px-3 py-1.5 items-center gap-1 hover:bg-[var(--neutral-20)] transition-colors text-[14px] flex">
            <UserPlus size={16} weight="regular" />
            <span className="text-[var(--neutral-100)] font-normal leading-[1.5]">Invite</span>
          </button>
          <button className="bg-[var(--primary-main)] rounded-[4px] px-3 py-1.5 flex items-center gap-1 hover:bg-[var(--primary-hover)] transition-colors text-[14px]">
            <Bag size={16} weight="regular" className="text-white" />
            <span className="text-white font-normal leading-[1.5]">Create a Trip</span>
          </button>
        </div>
      </div>
    </header>
  );
}
