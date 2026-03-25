'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { SpinnerGap, X, ChatCircleDots } from '@phosphor-icons/react';

import ChatHeader from '@/src/components/features/chat/ChatHeader';
import ChatConversationPanel from '@/src/components/features/chat/conversation/ChatConversationPanel';
import ChatEmptyState from '@/src/components/features/chat/ChatEmptyState';
import ChatSkeleton from '@/src/components/features/chat/page/ChatSkeleton';
import ChatPanelToggle from '@/src/components/features/chat/page/ChatPanelToggle';
import TripPlanningSideCard from '@/src/components/features/chat/page/TripPlanningSideCard';

const MapboxMap = dynamic(
  () => import('@/src/components/features/chat/MapboxMap'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[var(--neutral-20)]">
        <SpinnerGap size={24} className="animate-spin text-[var(--neutral-50)]" />
      </div>
    ),
  }
);

const TripItineraryTimelineCard = dynamic(
  () => import('@/src/components/features/chat/page/TripItineraryTimelineCard'),
  { ssr: false }
);

const DestinationDetailCard = dynamic(
  () => import('@/src/components/features/chat/page/DestinationDetailCard'),
  { ssr: false }
);

const PlaceDetailPanel = dynamic(
  () => import('@/src/components/features/trip/PlaceDetailPanel'),
  { ssr: false }
);

import aiConversationService, { type ConversationMessage } from '@/src/services/aiConversationService';
import { type ChatMessage, type SourceItem } from '@/src/components/features/chat/types';
import useChatStore from '@/src/stores/chatStore';
import useSidebarStore from '@/src/stores/sidebarStore';
import { queryParamSchema } from '@/src/lib/validation/schemas';
import { sanitizeHtml } from '@/src/lib/sanitize';
import tripService from '@/src/services/tripService';
import type { ItineraryStructuredData } from '@/src/types/itinerary.types';

function formatBudget(amount: number, currency = 'VND'): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(amount);
}

function formatTripDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString('vi-VN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return isoDate;
  }
}

function normalizeName(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function coordKey(lat: unknown, lng: unknown): string {
  if (typeof lat !== 'number' || typeof lng !== 'number') return '';
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

function findFuzzyNameMatch(
  lookup: Map<string, string>,
  dayNumber: number,
  normalizedActivityName: string
): string | undefined {
  if (!normalizedActivityName) return undefined;

  const dayPrefix = `day:${dayNumber}:name:`;
  for (const [key, value] of lookup) {
    if (!key.startsWith(dayPrefix)) continue;
    const candidate = key.slice(dayPrefix.length);
    if (candidate.length < 3) continue;
    if (normalizedActivityName.includes(candidate) || candidate.includes(normalizedActivityName)) {
      return value;
    }
  }

  const globalPrefix = 'name:';
  for (const [key, value] of lookup) {
    if (!key.startsWith(globalPrefix) || key.startsWith(dayPrefix)) continue;
    const candidate = key.slice(globalPrefix.length);
    if (candidate.length < 3) continue;
    if (normalizedActivityName.includes(candidate) || candidate.includes(normalizedActivityName)) {
      return value;
    }
  }

  return undefined;
}

function buildImageLookup(messages: ChatMessage[]): Map<string, string> {
  const lookup = new Map<string, string>();

  const push = (key: string, imageUrl: string) => {
    if (!key || lookup.has(key)) return;
    lookup.set(key, imageUrl);
  };

  for (const message of messages) {
    if (!Array.isArray(message.toolResults)) continue;
    for (const tool of message.toolResults) {
      if (tool.name !== 'optimize_itinerary') continue;
      const result = tool.result as Record<string, unknown> | null | undefined;
      const itinerary =
        (result?.data as Record<string, unknown> | undefined)?.itinerary as Record<string, unknown> | undefined;
      const days = Array.isArray(itinerary?.days) ? itinerary.days as Array<Record<string, unknown>> : [];

      for (const day of days) {
        const dayNumber = typeof day.dayNumber === 'number' ? day.dayNumber : undefined;
        const places = Array.isArray(day.places) ? day.places as Array<Record<string, unknown>> : [];
        for (const place of places) {
          const photos = Array.isArray(place.photos) ? place.photos.filter(isHttpUrl) : [];
          const imageUrl =
            (isHttpUrl(place.image) ? place.image : undefined) ||
            (isHttpUrl(place.thumbnail) ? place.thumbnail : undefined) ||
            (isHttpUrl(place.imageUrl) ? place.imageUrl : undefined) ||
            (isHttpUrl(place.thumbnailUrl) ? place.thumbnailUrl : undefined) ||
            photos[0];
          if (!imageUrl) continue;

          const name = normalizeName(place.name || place.title || place.location);
          const lat =
            typeof place.latitude === 'number'
              ? place.latitude
              : (place.coordinates as Record<string, unknown> | undefined)?.lat;
          const lng =
            typeof place.longitude === 'number'
              ? place.longitude
              : (place.coordinates as Record<string, unknown> | undefined)?.lng;
          const point = coordKey(lat, lng);

          if (name) {
            push(`name:${name}`, imageUrl);
            if (dayNumber) push(`day:${dayNumber}:name:${name}`, imageUrl);
          }
          if (point) {
            push(`coord:${point}`, imageUrl);
            if (dayNumber) push(`day:${dayNumber}:coord:${point}`, imageUrl);
          }
        }
      }
    }
  }

  return lookup;
}

function enrichItineraryWithToolImages(
  itinerary: ItineraryStructuredData | null,
  messages: ChatMessage[]
): ItineraryStructuredData | null {
  if (!itinerary || !Array.isArray(itinerary.days) || itinerary.days.length === 0) return itinerary;
  const imageLookup = buildImageLookup(messages);
  if (imageLookup.size === 0) return itinerary;

  let changed = false;
  const days = itinerary.days.map((day, dayIndex) => {
    const dayNumber = typeof day.dayNumber === 'number' ? day.dayNumber : dayIndex + 1;
    const activities = (day.activities || []).map((activity) => {
      if (isHttpUrl(activity.image) || isHttpUrl(activity.thumbnail)) return activity;

      const name = normalizeName(activity.name || activity.title || activity.location);
      const lat = activity.coordinates?.lat;
      const lng = activity.coordinates?.lng;
      const point = coordKey(lat, lng);

      const matchedImage =
        (name ? imageLookup.get(`day:${dayNumber}:name:${name}`) : undefined) ||
        (point ? imageLookup.get(`day:${dayNumber}:coord:${point}`) : undefined) ||
        findFuzzyNameMatch(imageLookup, dayNumber, name) ||
        (name ? imageLookup.get(`name:${name}`) : undefined) ||
        (point ? imageLookup.get(`coord:${point}`) : undefined);

      if (!matchedImage) return activity;
      changed = true;
      return {
        ...activity,
        image: matchedImage,
      };
    });

    return {
      ...day,
      activities,
      schedule: activities,
    };
  });

  if (!changed) return itinerary;
  return {
    ...itinerary,
    days,
  };
}

export default function ChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const conversationId = Array.isArray(params.conversationId) ? params.conversationId[0] : params.conversationId;
  // Extract search param value once to avoid useSearchParams reference
  // changes triggering the loadConversation effect multiple times
  const initialQuery = useMemo(
    () => searchParams.get('q'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams.toString()]
  );

  const messages = useChatStore((state) => state.messages);
  const setMessages = useChatStore((state) => state.setMessages);
  const setError = useChatStore((state) => state.setError);
  const setConversationId = useChatStore((state) => state.setConversationId);
  const setCurrentItinerary = useChatStore((state) => state.setCurrentItinerary);
  const draftId = useChatStore((state) => state.draftId);
  const isDraftLoading = useChatStore((state) => state.isDraftLoading);
  const loadDraftFromId = useChatStore((state) => state.loadDraftFromId);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const setDraftId = useChatStore((state) => state.setDraftId);
  const isCollapsed = useSidebarStore((state) => state.isCollapsed);

  // Panel state machine
  const rightPanelMode = useChatStore((state) => state.rightPanelMode);
  const savedTrip = useChatStore((state) => state.savedTrip);
  const savedTripId = useChatStore((state) => state.savedTripId);
  const currentItinerary = useChatStore((state) => state.currentItinerary);
  const selectedDestination = useChatStore((state) => state.selectedDestination);
  const setSelectedDestination = useChatStore((state) => state.setSelectedDestination);
  const selectedPlace = useChatStore((state) => state.selectedPlace);
  const setSelectedPlace = useChatStore((state) => state.setSelectedPlace);
  const pendingDraftData = useChatStore((state) => state.pendingDraftData);
  const acceptPendingDraft = useChatStore((state) => state.acceptPendingDraft);
  const rejectPendingDraft = useChatStore((state) => state.rejectPendingDraft);
  const loadSavedTripById = useChatStore((state) => state.loadSavedTripById);

  const [title, setTitle] = useState('New Trip');
  const [isLoading, setIsLoading] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [activeMobileTab, setActiveMobileTab] = useState<'chat' | 'map'>('chat');
  const [isMobile, setIsMobile] = useState(false);
  const [isMobilePlanOpen, setIsMobilePlanOpen] = useState(false);

  // Ref to track if we've handled the initial message to prevent double sending
  const hasSentInitialRef = useRef(false);
  const constraintsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setIsMobilePlanOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (activeMobileTab === 'map') {
      setIsMobilePlanOpen(false);
    }
  }, [activeMobileTab]);

  // Trigger map resize when sidebar collapse state changes
  useEffect(() => {
    // Wait for sidebar transition to complete (300ms as per Sidebar.tsx)
    // Debounce the resize event to prevent excessive triggers
    const timer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('map-resize', { bubbles: true }));
    }, 320);
    return () => clearTimeout(timer);
  }, [isCollapsed]);

  useEffect(() => {
    if (!conversationId) return;

    const loadConversation = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setCurrentItinerary(null);
        setDraftId(null);
        setConversationId(conversationId);

        const data = await aiConversationService.getConversation(conversationId);
        if (data?.title) {
          setTitle(data.title);
        }

        // Restore draft if available
        try {
          console.log('Fetching drafts for conversation:', conversationId);
          // Try to get drafts from tripService specifically for this conversation
          const drafts = await tripService.listDrafts(conversationId);
          console.log('Drafts found:', drafts);

          if (drafts && drafts.length > 0) {
            // Sort by createdAt desc
            const sortedDrafts = [...drafts].sort((a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            if (sortedDrafts[0]) {
              console.log('Restoring draft ID:', sortedDrafts[0].id);
              setDraftId(sortedDrafts[0].id);
            }
          } else if (data.ai_itinerary_drafts && data.ai_itinerary_drafts.length > 0) {
            console.log('Falling back to conversation drafts');
            // Fallback to conversation data if listDrafts returns empty but convo has simple draft records
            const sortedDrafts = [...data.ai_itinerary_drafts].sort((a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            if (sortedDrafts[0]) {
              setDraftId(sortedDrafts[0].id);
            }
          }
        } catch (error) {
          console.error('Failed to load drafts for conversation:', error);

          // Fallback logic in catch block just in case
          if (data.ai_itinerary_drafts && data.ai_itinerary_drafts.length > 0) {
            const sortedDrafts = [...data.ai_itinerary_drafts].sort((a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            if (sortedDrafts[0]) {
              setDraftId(sortedDrafts[0].id);
            }
          }
        }

        let loadedMessages: Array<{ id: string; role: 'user' | 'assistant'; content: string; functionCalls?: Array<{ name: string; arguments: Record<string, unknown> }>; toolResults?: Array<{ name: string; result: unknown }>; sources?: SourceItem[] }> = [];
        if (Array.isArray(data?.ai_messages)) {
          loadedMessages = data.ai_messages
            .filter(
              (message): message is ConversationMessage & { role: 'user' | 'assistant' } =>
                message.role === 'user' || message.role === 'assistant'
            )
            .map((message) => {
              // Transform backend toolCalls format to frontend format
              let functionCalls: Array<{ name: string; arguments: Record<string, unknown> }> | undefined;
              let toolResults: Array<{ name: string; result: unknown }> | undefined;
              const sources: SourceItem[] = [];

              if (message.structuredData && typeof message.structuredData === 'object') {
                const structData = message.structuredData as Record<string, unknown>;
                const toolCalls = structData.toolCalls;
                if (Array.isArray(toolCalls)) {
                  // Check if this message contains create_trip_plan (pipeline result)
                  const hasCreateTripPlan = toolCalls.some(
                    (tc: Record<string, unknown>) => tc.name === 'create_trip_plan'
                  );

                  // Pipeline worker steps to synthesize when create_trip_plan is present
                  const pipelineSteps = [
                    'Tìm điểm tham quan',
                    'Tìm nhà hàng',
                    'Tìm khách sạn',
                    'Tìm hoạt động',
                    'Tìm phương tiện',
                    'Tạo lịch trình',
                  ];

                  // Build function calls: pipeline steps (if applicable) + persisted tools
                  const persistedFunctionCalls = toolCalls.map((tc: Record<string, unknown>) => ({
                    name: tc.name as string,
                    arguments: (tc.arguments as Record<string, unknown>) || {},
                  }));
                  const persistedToolResults = toolCalls.map((tc: Record<string, unknown>) => ({
                    name: tc.name as string,
                    result: tc.result,
                  }));

                  if (hasCreateTripPlan) {
                    // Prepend synthetic pipeline steps as completed items
                    const syntheticCalls = pipelineSteps.map((name) => ({
                      name,
                      arguments: {} as Record<string, unknown>,
                    }));
                    const syntheticResults = pipelineSteps.map((name) => ({
                      name,
                      result: { success: true } as unknown,
                    }));
                    // Filter out create_trip_plan from persisted (already represented by "Tạo lịch trình")
                    const filteredCalls = persistedFunctionCalls.filter(
                      (fc) => fc.name !== 'create_trip_plan'
                    );
                    const filteredResults = persistedToolResults.filter(
                      (tr) => tr.name !== 'create_trip_plan'
                    );
                    functionCalls = [...syntheticCalls, ...filteredCalls];
                    toolResults = [...syntheticResults, ...filteredResults];
                  } else {
                    functionCalls = persistedFunctionCalls;
                    toolResults = persistedToolResults;
                  }

                  // Extract source URLs from tool results
                  for (const tc of toolCalls) {
                    const tcTyped = tc as Record<string, unknown>;
                    const name = tcTyped.name as string;
                    const result = tcTyped.result as Record<string, unknown> | undefined;
                    if (!result) continue;

                    if ((name === 'web_search' || name === 'exa_search') && result.success && result.data) {
                      const resData = result.data as Record<string, unknown>;
                      const results = resData.results as Array<Record<string, unknown>> | undefined;
                      if (Array.isArray(results)) {
                        for (const item of results) {
                          if (item.url && typeof item.url === 'string') {
                            sources.push({
                              title: (item.title as string) || '',
                              url: item.url,
                              snippet: (item.content as string)?.slice(0, 150) || undefined,
                            });
                          }
                        }
                      }
                    }
                    if ((name === 'scrape_url' || name === 'read_website') && result.data) {
                      const resData = (result.data as Record<string, unknown>) || result;
                      if (resData.url && typeof resData.url === 'string') {
                        sources.push({
                          title: (resData.title as string) || '',
                          url: resData.url,
                          snippet: (resData.content as string)?.slice(0, 150) || undefined,
                        });
                      }
                    }
                  }
                }
              }

              // Also restore sources from message.sources (persisted by backend)
              if (sources.length === 0 && message.sources) {
                const backendSources = Array.isArray(message.sources)
                  ? message.sources as Array<Record<string, unknown>>
                  : [];
                for (const s of backendSources) {
                  if (s.url && typeof s.url === 'string') {
                    sources.push({
                      title: (s.title as string) || '',
                      url: s.url,
                      snippet: (s.snippet as string) || undefined,
                    });
                  }
                }
              }

              // Map file_uploads to message attachments
              const fileUploads = (message as Record<string, unknown>).file_uploads as Array<{
                id: string;
                fileName: string;
                fileType: 'IMAGE' | 'DOCUMENT';
                mimeType: string;
                publicUrl?: string;
                variants?: { thumb: string; card: string; hero: string; original: string };
              }> | undefined;

              const attachments = fileUploads && fileUploads.length > 0
                ? fileUploads.map((f) => ({
                    id: f.id,
                    fileName: f.fileName,
                    fileType: f.fileType,
                    mimeType: f.mimeType,
                    publicUrl: f.publicUrl,
                    variants: f.variants,
                  }))
                : undefined;

              return {
                id: message.id,
                role: message.role,
                content: message.content,
                functionCalls,
                toolResults,
                sources: sources.length > 0 ? sources : undefined,
                attachments,
              };
            });
          setMessages(loadedMessages);
        }

        // Check for initial message from query params
        const initialMessageRaw = initialQuery;
        if (initialMessageRaw && !hasSentInitialRef.current && loadedMessages.length === 0) {
          try {
            // Validate and sanitize query parameter to prevent XSS
            const validated = queryParamSchema.parse(initialMessageRaw);
            const sanitized = sanitizeHtml(validated);

            hasSentInitialRef.current = true;
            // Slight delay to ensure store is ready and UI transition is smooth
            setTimeout(() => {
              sendMessage(sanitized);
            }, 100);
          } catch (error) {
            console.error('Invalid query parameter:', error);
            // Don't send message if validation fails
          }
        }

      } catch (err) {
        console.error('Failed to load conversation', err);
        setError('Không thể tải cuộc hội thoại.');
      } finally {
        setIsLoading(false);
      }
    };

    loadConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    return () => {
      // Don't reset conversation here as it wipes state on refresh
      setConversationId(null);
      hasSentInitialRef.current = false;
    };
  }, [setConversationId]);

  // Restore savedTrip from persisted savedTripId on reload
  useEffect(() => {
    if (savedTripId && !savedTrip && rightPanelMode === 'timeline') {
      loadSavedTripById(savedTripId);
    }
  }, [savedTripId, savedTrip, rightPanelMode, loadSavedTripById]);

  // In timeline mode, ensure rich itinerary data is loaded from latest draft
  // so Overview tab can show summary/tips/budget breakdown after reload.
  useEffect(() => {
    if (rightPanelMode === 'timeline' && draftId && !currentItinerary && !isDraftLoading) {
      loadDraftFromId(draftId);
    }
  }, [rightPanelMode, draftId, currentItinerary, isDraftLoading, loadDraftFromId]);

  useEffect(() => {
    if (!currentItinerary || messages.length === 0) return;
    const enriched = enrichItineraryWithToolImages(currentItinerary, messages);
    if (enriched !== currentItinerary) {
      setCurrentItinerary(enriched);
    }
  }, [currentItinerary, messages, setCurrentItinerary]);

  const hasMobilePlanData =
    !isLoading &&
    messages.length > 0 &&
    (rightPanelMode === 'timeline' ? !!savedTrip : !!(draftId || currentItinerary));

  return (
    <>
      <ChatHeader title={title} />
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="relative h-full w-full overflow-hidden bg-[var(--neutral-10)]" ref={constraintsRef}>
              <motion.div
                className={`absolute inset-0 ${activeMobileTab === 'chat'
                  ? 'md:visible md:pointer-events-auto z-0'
                  : 'z-10'
                  }`}
                initial={false}
                animate={{
                  opacity: isMobile && activeMobileTab === 'chat' ? 0 : 1,
                  scale: isMobile && activeMobileTab === 'chat' ? 0.98 : 1,
                }}
                transition={{
                  type: "tween",
                  ease: [0.4, 0, 0.2, 1],
                  duration: 0.2,
                }}
                style={{
                  pointerEvents: isMobile && activeMobileTab === 'chat' ? 'none' : 'auto',
                  visibility: isMobile && activeMobileTab === 'chat' ? 'hidden' : 'visible',
                }}
              >
                <MapboxMap
                  onMarkerClick={(dest) => setSelectedDestination(dest)}
                  onActivitySelect={(activity) => {
                    const raw = activity as unknown as Record<string, unknown>;
                    setSelectedPlace({
                      placeId: activity.placeId ?? null,
                      activityData: {
                        name: activity.name || activity.title || '',
                        type: activity.type,
                        estimatedCost: activity.estimatedCost,
                        description: activity.description,
                        address: activity.address,
                        imageUrl:
                          (typeof raw.imageUrl === 'string' ? raw.imageUrl : undefined) ||
                          activity.image ||
                          activity.thumbnail,
                        photos: activity.photos,
                      },
                    });
                  }}
                />
              </motion.div>

              <motion.div
                className="relative flex h-full w-full items-start gap-3 xl:gap-2 p-0 md:p-6 pointer-events-none z-10"
                initial={false}
                animate={{
                  opacity: isMobile && activeMobileTab === 'map' ? 0 : 1,
                  y: isMobile && activeMobileTab === 'map' ? 20 : 0,
                  scale: isMobile && activeMobileTab === 'map' ? 0.96 : 1,
                }}
                transition={{
                  type: "tween",
                  ease: [0.4, 0, 0.2, 1],
                  duration: 0.2,
                }}
                style={{
                  visibility: isMobile && activeMobileTab === 'map' ? 'hidden' : 'visible',
                }}
              >
                <AnimatePresence mode="wait">
                  {isPanelOpen && (
                    isLoading ? (
                      <motion.div
                        key="loading"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        className="flex h-full w-full md:max-w-[480px] items-start justify-start pointer-events-auto"
                      >
                        <ChatSkeleton />
                      </motion.div>
                    ) : messages.length === 0 ? (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        className="h-full w-full md:max-w-[480px] pointer-events-auto"
                      >
                        <ChatEmptyState />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="conversation"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        className="h-full w-full md:max-w-[480px] pointer-events-auto"
                      >
                        <ChatConversationPanel
                          activeMobileTab={activeMobileTab}
                          onMobileTabChange={setActiveMobileTab}
                          showTripPlan={hasMobilePlanData && activeMobileTab === 'chat'}
                          onTripPlanOpen={() => setIsMobilePlanOpen(true)}
                        />
                      </motion.div>
                    )
                  )}
                </AnimatePresence>

                <div className="hidden lg:flex items-start pt-[72px] pointer-events-auto shrink-0">
                  <ChatPanelToggle
                    isPanelOpen={isPanelOpen}
                    onToggle={() => setIsPanelOpen(!isPanelOpen)}
                  />
                </div>

                {isPanelOpen && !isLoading && (selectedPlace || selectedDestination || (rightPanelMode === 'timeline' ? !!savedTrip : messages.length > 0)) && (
                  <AnimatePresence mode="wait">
                    {selectedPlace ? (
                      /* ── Place Detail Panel (from map marker) ── */
                      <motion.div
                        key="place-detail"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        className="hidden xl:flex h-full w-full max-w-[460px] pointer-events-auto"
                      >
                        <PlaceDetailPanel
                          placeId={selectedPlace.placeId}
                          activityData={selectedPlace.activityData}
                          onClose={() => setSelectedPlace(null)}
                        />
                      </motion.div>
                    ) : selectedDestination ? (
                      /* ── Destination Detail Panel ── */
                      <motion.div
                        key="destination"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        className="hidden xl:flex h-full w-full max-w-[460px] pointer-events-auto"
                      >
                        <DestinationDetailCard
                          title={selectedDestination.name}
                          type={selectedDestination.type}
                          address={selectedDestination.address}
                          city={selectedDestination.city}
                          summary={selectedDestination.description}
                          website={selectedDestination.website}
                          phone={selectedDestination.phone}
                          rating={selectedDestination.rating}
                          ratingCount={selectedDestination.ratingCount}
                          openingHours={selectedDestination.openingHours}
                          categories={selectedDestination.categories}
                          mainImageUrl={selectedDestination.imageUrl}
                          sideTopImageUrl={selectedDestination.sideImages?.[0]}
                          sideBottomImageUrl={selectedDestination.sideImages?.[1]}
                          travelAdvice={[]}
                          onClose={() => setSelectedDestination(null)}
                        />
                      </motion.div>
                    ) : rightPanelMode === 'timeline' && savedTrip ? (
                      /* ── Timeline Panel ── */
                      <motion.div
                        key="timeline"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        className="hidden xl:flex h-full w-full max-w-[444px] pointer-events-auto relative"
                      >
                        <TripItineraryTimelineCard
                          key={savedTrip.id}
                          tripId={savedTrip.id}
                          savedTrip={savedTrip}
                          itinerary={currentItinerary}
                          title={savedTrip.title}
                          locationLabel={currentItinerary?.destination}
                          dateRangeLabel={
                            savedTrip.startDate && savedTrip.endDate
                              ? `${formatTripDate(savedTrip.startDate)} – ${formatTripDate(savedTrip.endDate)}`
                              : undefined
                          }
                          travelersLabel={`${savedTrip.travelersCount} Traveler${savedTrip.travelersCount !== 1 ? 's' : ''}`}
                          budgetLabel={
                            savedTrip.budgetTotal
                              ? formatBudget(savedTrip.budgetTotal, savedTrip.budgetCurrency)
                              : undefined
                          }
                          tripCurrency={savedTrip.budgetCurrency}
                        />
                        {/* Pending draft banner */}
                        {pendingDraftData && (
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="absolute top-4 left-4 right-4 z-30 pointer-events-auto"
                          >
                            <div className="rounded-[12px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] shadow-lg p-4">
                              <p className="text-[14px] font-medium text-[var(--neutral-100)] mb-3">
                                AI created a new trip plan. Replace your current trip?
                              </p>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={acceptPendingDraft}
                                  className="flex-1 rounded-[8px] bg-[var(--primary-main)] py-2 text-[13px] font-medium text-white hover:bg-[var(--primary-main)]/90"
                                >
                                  Replace
                                </button>
                                <button
                                  type="button"
                                  onClick={rejectPendingDraft}
                                  className="flex-1 rounded-[8px] border border-[var(--neutral-30)] py-2 text-[13px] font-medium text-[var(--neutral-80)] hover:bg-[var(--neutral-10)]"
                                >
                                  Keep current
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    ) : (
                      /* ── Draft Panel ── */
                      <motion.div
                        key="draft"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        className="hidden xl:flex h-full w-full max-w-[444px] pointer-events-auto"
                      >
                        <TripPlanningSideCard />
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </motion.div>

              <AnimatePresence>
                {isMobilePlanOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 bg-black/45 md:hidden"
                    onClick={() => setIsMobilePlanOpen(false)}
                  >
                    <motion.div
                      initial={{ y: '100%' }}
                      animate={{ y: 0 }}
                      exit={{ y: '100%' }}
                      transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.25 }}
                      className="absolute inset-x-0 bottom-0 top-[8vh] rounded-t-[16px] bg-[var(--neutral-10)] overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between border-b border-[var(--neutral-30)] px-4 py-3">
                        <p className="text-[14px] font-semibold text-[var(--neutral-100)]">Trip Plan</p>
                        <button
                          type="button"
                          onClick={() => setIsMobilePlanOpen(false)}
                          className="rounded-full p-1.5 text-[var(--neutral-60)] hover:bg-[var(--neutral-20)]"
                          aria-label="Close trip plan"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <div className="h-[calc(100%-53px)] overflow-y-auto">
                        {rightPanelMode === 'timeline' && savedTrip ? (
                          <TripItineraryTimelineCard
                            key={`mobile-${savedTrip.id}`}
                            tripId={savedTrip.id}
                            savedTrip={savedTrip}
                            itinerary={currentItinerary}
                            title={savedTrip.title}
                            locationLabel={currentItinerary?.destination}
                            dateRangeLabel={
                              savedTrip.startDate && savedTrip.endDate
                                ? `${formatTripDate(savedTrip.startDate)} – ${formatTripDate(savedTrip.endDate)}`
                                : undefined
                            }
                            travelersLabel={`${savedTrip.travelersCount} Traveler${savedTrip.travelersCount !== 1 ? 's' : ''}`}
                            budgetLabel={
                              savedTrip.budgetTotal
                                ? formatBudget(savedTrip.budgetTotal, savedTrip.budgetCurrency)
                                : undefined
                            }
                            tripCurrency={savedTrip.budgetCurrency}
                            className="!max-w-none !h-full !rounded-none !border-0 !shadow-none !bg-[var(--neutral-10)]"
                          />
                        ) : (
                          <TripPlanningSideCard className="!max-w-none !h-full !rounded-none !border-0 !shadow-none !bg-[var(--neutral-10)]" />
                        )}
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mobile: back to chat button when viewing map */}
              {isMobile && activeMobileTab === 'map' && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  onClick={() => setActiveMobileTab('chat')}
                  className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full bg-[var(--neutral-100)] px-5 py-3 text-[13px] font-medium text-white shadow-[0_8px_30px_rgba(0,0,0,0.2)] active:scale-95 transition-transform"
                >
                  <ChatCircleDots size={18} weight="fill" />
                  Back to Chat
                </motion.button>
              )}
        </div>
      </div>
    </>
  );
}
