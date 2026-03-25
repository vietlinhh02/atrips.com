import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

import { type ChatMessage, type SourceItem } from '@/src/components/features/chat/types';
import aiConversationService, { type TripPlanningContext } from '@/src/services/aiConversationService';
import tripService, { type TripWithItinerary } from '@/src/services/tripService';
import {
  validateFile,
  isImageType,
  uploadChatFile,
  pollUntilReady,
  getConversationFiles,
} from '@/src/services/uploadService';
import useSidebarStore from '@/src/stores/sidebarStore';
import type { ItineraryStructuredData, SelectedDestination } from '@/src/types/itinerary.types';
import type { PendingAttachment, FileUploadRecord } from '@/src/types/upload.types';

interface ChatState {
  conversationId: string | null;
  messages: ChatMessage[];
  inputValue: string;
  error: string | null;
  isSubmitting: boolean;
  isMapLoading: boolean;
  currentItinerary: ItineraryStructuredData | null;
  draftId: string | null;
  isDraftLoading: boolean;
  suggestions: string[];
  // Panel state machine
  rightPanelMode: 'draft' | 'timeline';
  savedTrip: TripWithItinerary | null;
  savedTripId: string | null;
  isSavingDraft: boolean;
  selectedDestination: SelectedDestination | null;
  selectedDayNumber: number | null;
  pendingDraftData: { draftId: string; itinerary: ItineraryStructuredData } | null;
  // File attachments
  pendingAttachments: PendingAttachment[];
  conversationFiles: FileUploadRecord[];
  selectedPlace: {
    placeId: string | null;
    activityData: {
      name: string;
      type?: string;
      estimatedCost?: number;
      currency?: string;
      description?: string;
      address?: string;
      imageUrl?: string;
      photos?: string[];
    };
  } | null;
  // Actions
  setConversationId: (value: string | null) => void;
  setInputValue: (value: string) => void;
  setError: (error: string | null) => void;
  setIsSubmitting: (value: boolean) => void;
  setIsMapLoading: (value: boolean) => void;
  setMessages: (value: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  setCurrentItinerary: (data: ItineraryStructuredData | null) => void;
  setDraftId: (id: string | null) => void;
  setRightPanelMode: (mode: 'draft' | 'timeline') => void;
  setSavedTrip: (trip: TripWithItinerary | null) => void;
  setSelectedDestination: (dest: SelectedDestination | null) => void;
  setSelectedDayNumber: (day: number | null) => void;
  setSelectedPlace: (place: {
    placeId: string | null;
    activityData: {
      name: string;
      type?: string;
      estimatedCost?: number;
      currency?: string;
      description?: string;
      address?: string;
      imageUrl?: string;
      photos?: string[];
    };
  } | null) => void;
  saveDraft: (draftId: string) => Promise<void>;
  acceptPendingDraft: () => void;
  rejectPendingDraft: () => void;
  loadSavedTripById: (tripId: string) => Promise<void>;
  resetConversation: () => void;
  sendMessage: (message: string, context?: TripPlanningContext) => Promise<void>;
  retryMessage: (userMessageId: string) => Promise<void>;
  createConversation: (tripId?: string, title?: string) => Promise<string | null>;
  loadDraftFromId: (draftId: string) => Promise<void>;
  // File attachment actions
  addAttachment: (file: File) => Promise<void>;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  loadConversationFiles: (conversationId: string) => Promise<void>;
}

let activeController: AbortController | null = null;

type RawPlace = Record<string, unknown>;

/**
 * Parse a search_places tool result and return a SelectedDestination from the top place
 */
function parseSearchPlacesResult(rawResult: unknown): import('@/src/types/itinerary.types').SelectedDestination | null {
  const result = rawResult as { source?: string; places?: RawPlace[] };
  const topPlace = result?.places?.[0];
  if (!topPlace) return null;

  const categories = Array.isArray(topPlace.categories) ? (topPlace.categories as string[]) : [];

  return {
    name: (topPlace.name as string) || (topPlace.fullName as string) || '',
    type: topPlace.type as string | undefined,
    address: (topPlace.address as string) || (topPlace.fullName as string) || undefined,
    city: topPlace.city as string | undefined,
    description: categories.length > 0 ? categories.join(', ') : undefined,
    imageUrl: topPlace.imageUrl as string | undefined,
    thumbnailUrl: topPlace.thumbnailUrl as string | undefined,
    sideImages: topPlace.sideImages as string[] | undefined,
    coordinates: topPlace.coordinates as { lat: number; lng: number } | undefined,
    website: topPlace.website as string | undefined,
    phone: topPlace.phone as string | undefined,
    rating: typeof topPlace.rating === 'number' ? topPlace.rating : undefined,
    ratingCount: typeof topPlace.ratingCount === 'number' ? topPlace.ratingCount : undefined,
    priceLevel: topPlace.priceLevel as string | undefined,
    openingHours: topPlace.openingHours as string | null | undefined,
    categories,
  };
}

/**
 * Preload activity images from itinerary data into browser cache.
 * Called when a draft is created so images are ready when user clicks "Save Plan".
 */
function preloadItineraryImages(itinerary: ItineraryStructuredData): void {
  const urls: string[] = [];
  for (const day of itinerary.days || []) {
    for (const activity of day.activities || []) {
      const raw = activity as unknown as Record<string, unknown>;
      // Collect all possible image candidates
      const candidates = [
        activity.image,
        activity.thumbnail,
        raw.imageUrl,
        raw.thumbnailUrl,
      ];
      // googleMapsInfo photos
      const gmi = activity.googleMapsInfo;
      if (gmi && typeof gmi === 'object') {
        const photos = (gmi as Record<string, unknown>).photos;
        if (Array.isArray(photos)) candidates.push(...photos);
      }
      // activity.photos
      if (Array.isArray(raw.photos)) candidates.push(...raw.photos);

      for (const url of candidates) {
        if (typeof url === 'string' && url.startsWith('http')) {
          urls.push(url);
        }
      }
    }
  }
  // Deduplicate and preload
  const unique = [...new Set(urls)];
  for (const url of unique) {
    const img = new Image();
    img.src = url;
  }
}

/**
 * Extract source URLs from tool_result data (web_search, exa_search, scrape_url, etc.)
 */
function extractSourcesFromToolResult(name: string, result: unknown): SourceItem[] {
  const sources: SourceItem[] = [];
  if (!result || typeof result !== 'object') return sources;

  const res = result as Record<string, unknown>;

  // web_search / exa_search: result.data.results[]
  if ((name === 'web_search' || name === 'exa_search') && res.success && res.data) {
    const data = res.data as Record<string, unknown>;
    const results = data.results as Array<Record<string, unknown>> | undefined;
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

  // scrape_url / read_website: result.data.url or just result.url
  if (name === 'scrape_url' || name === 'read_website') {
    const data = (res.data as Record<string, unknown>) || res;
    if (data.url && typeof data.url === 'string') {
      sources.push({
        title: (data.title as string) || '',
        url: data.url,
        snippet: (data.content as string)?.slice(0, 150) || undefined,
      });
    }
  }

  return sources;
}

/**
 * Generate a conversation title from the user's first message.
 * Extracts destination names from travel-related patterns in
 * English and Vietnamese; falls back to truncation.
 */
function generateTitle(userMessage: string): string {
  const tripPatterns = [
    /(?:trip|travel|visit|go|fly|plan)\s+(?:to|for|in)\s+(.+?)(?:\s+for|\s+in|\s+from|\s+with|\.|,|$)/i,
    /(?:itinerary|plan|schedule)\s+(?:for|in)\s+(.+?)(?:\s+for|\s+in|\.|,|$)/i,
    /(?:du lịch|đi|thăm|khám phá|lên kế hoạch)\s+(.+?)(?:\s+trong|\s+vào|\s+với|\.|,|$)/i,
  ];

  for (const pattern of tripPatterns) {
    const match = userMessage.match(pattern);
    if (match?.[1]) {
      const dest = match[1].trim().replace(/^(a|the)\s+/i, '');
      if (dest.length > 2 && dest.length < 50) {
        const capitalized =
          dest.charAt(0).toUpperCase() + dest.slice(1);
        return `Trip to ${capitalized}`;
      }
    }
  }

  const cleaned = userMessage.replace(/\n/g, ' ').trim();
  return cleaned.length > 45
    ? cleaned.slice(0, 42) + '...'
    : cleaned;
}

const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversationId: null,
      messages: [],
      inputValue: '',
      error: null,
      isSubmitting: false,
      isMapLoading: true,
      currentItinerary: null,
      draftId: null,
      isDraftLoading: false,
      suggestions: [],
      rightPanelMode: 'draft',
      savedTrip: null,
      savedTripId: null,
      isSavingDraft: false,
      selectedDestination: null,
      selectedDayNumber: null,
      pendingDraftData: null,
      pendingAttachments: [],
      conversationFiles: [],
      selectedPlace: null,
      setConversationId: (value) => set({ conversationId: value }),
      setInputValue: (value) => set({ inputValue: value }),
      setError: (error) => set({ error }),
      setIsSubmitting: (value) => set({ isSubmitting: value }),
      setIsMapLoading: (value) => set({ isMapLoading: value }),
      setMessages: (value) =>
        set((state) => ({
          messages: typeof value === 'function' ? value(state.messages) : value,
        })),
      setCurrentItinerary: (data) => set({ currentItinerary: data }),
      setDraftId: (id) => set({ draftId: id }),
      setRightPanelMode: (mode) => set({ rightPanelMode: mode }),
      setSavedTrip: (trip) => set({ savedTrip: trip }),
      setSelectedDestination: (dest) => set({ selectedDestination: dest }),
      setSelectedDayNumber: (day) => set({ selectedDayNumber: day }),
      setSelectedPlace: (place) => set({ selectedPlace: place }),
      acceptPendingDraft: () => {
        const { pendingDraftData } = get();
        if (!pendingDraftData) return;
        set({
          draftId: pendingDraftData.draftId,
          currentItinerary: pendingDraftData.itinerary,
          rightPanelMode: 'draft',
          pendingDraftData: null,
        });
      },
      rejectPendingDraft: () => set({ pendingDraftData: null }),
      loadSavedTripById: async (tripId: string) => {
        try {
          const trip = await tripService.getTrip(tripId);
          set({ savedTrip: trip });
        } catch {
          set({ savedTripId: null, rightPanelMode: 'draft' });
        }
      },
      saveDraft: async (draftId: string) => {
        set({ isSavingDraft: true });
        try {
          const draft = await tripService.getDraft(draftId);
          const itinerary = tripService.draftToItinerary(draft);
          let trip: TripWithItinerary;
          if (draft.appliedToTripId) {
            trip = await tripService.getTrip(draft.appliedToTripId);
          } else {
            trip = await tripService.applyDraft(draftId, { createNew: true });
          }
          set({
            savedTrip: trip,
            savedTripId: trip.id,
            rightPanelMode: 'timeline',
            currentItinerary: itinerary,
            draftId: draft.id,
            isSavingDraft: false,
          });
        } catch {
          set({ isSavingDraft: false, error: 'Failed to save trip' });
        }
      },

      addAttachment: async (file: File) => {
        const validationError = validateFile(file);
        if (validationError) {
          set({ error: validationError });
          return;
        }

        const id = crypto.randomUUID();
        const fileType = isImageType(file.type) ? 'IMAGE' : 'DOCUMENT';
        const previewUrl = fileType === 'IMAGE'
          ? URL.createObjectURL(file)
          : undefined;

        const attachment: PendingAttachment = {
          id,
          file,
          fileName: file.name,
          fileType,
          previewUrl,
          progress: 0,
          status: 'UPLOADING',
        };

        set((state) => ({
          pendingAttachments: [...state.pendingAttachments, attachment],
        }));

        // Ensure a conversation exists before uploading
        let conversationId = get().conversationId;
        if (!conversationId) {
          conversationId = await get().createConversation();
          if (!conversationId) {
            set((state) => ({
              pendingAttachments: state.pendingAttachments.map((a) =>
                a.id === id
                  ? { ...a, status: 'FAILED' as const, error: 'Failed to create conversation' }
                  : a
              ),
            }));
            return;
          }
        }

        try {
          const record = await uploadChatFile(file, conversationId);
          set((state) => ({
            pendingAttachments: state.pendingAttachments.map((a) =>
              a.id === id
                ? { ...a, status: 'PROCESSING' as const, progress: 50, record }
                : a
            ),
          }));

          const finalRecord = await pollUntilReady(record.id);
          set((state) => ({
            pendingAttachments: state.pendingAttachments.map((a) =>
              a.id === id
                ? {
                    ...a,
                    status: finalRecord.status === 'READY' ? 'READY' as const : 'FAILED' as const,
                    progress: finalRecord.status === 'READY' ? 100 : 0,
                    record: finalRecord,
                    error: finalRecord.status === 'FAILED' ? 'File processing failed' : undefined,
                  }
                : a
            ),
          }));
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Upload failed';
          set((state) => ({
            pendingAttachments: state.pendingAttachments.map((a) =>
              a.id === id ? { ...a, status: 'FAILED' as const, error: errorMsg } : a
            ),
          }));
        }
      },

      removeAttachment: (id: string) => {
        set((state) => {
          const attachment = state.pendingAttachments.find((a) => a.id === id);
          if (attachment?.previewUrl) {
            URL.revokeObjectURL(attachment.previewUrl);
          }
          return {
            pendingAttachments: state.pendingAttachments.filter((a) => a.id !== id),
          };
        });
      },

      clearAttachments: () => {
        const { pendingAttachments } = get();
        for (const a of pendingAttachments) {
          if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
        }
        set({ pendingAttachments: [] });
      },

      loadConversationFiles: async (conversationId: string) => {
        try {
          const files = await getConversationFiles(conversationId);
          set({ conversationFiles: files });
        } catch {
          console.error('Failed to load conversation files');
        }
      },

      resetConversation: () =>
        set(() => {
          activeController?.abort();
          activeController = null;
          return {
            messages: [],
            inputValue: '',
            error: null,
            isSubmitting: false,
            isMapLoading: true,
            currentItinerary: null,
            draftId: null,
            isDraftLoading: false,
            suggestions: [],
            rightPanelMode: 'draft',
            savedTrip: null,
            savedTripId: null,
            isSavingDraft: false,
            selectedDestination: null,
            selectedDayNumber: null,
            pendingDraftData: null,
            pendingAttachments: [],
            conversationFiles: [],
          };
        }),

      /**
       * Load draft from backend by ID
       * Called when page loads with a draftId in session but no currentItinerary
       */
      loadDraftFromId: async (draftId: string) => {
        const state = get();
        // Skip only when already loading or exact same draft already loaded
        if (state.isDraftLoading) return;
        if (state.draftId === draftId && state.currentItinerary) return;

        set({ isDraftLoading: true, error: null });

        try {
          const draft = await tripService.getDraft(draftId);
          const itinerary = tripService.draftToItinerary(draft);
          preloadItineraryImages(itinerary);

          set({
            currentItinerary: itinerary,
            draftId: draft.id,
            isDraftLoading: false,
          });
        } catch (error) {
          console.error('Failed to load draft:', error);
          // Clear the invalid draftId
          set({
            draftId: null,
            isDraftLoading: false,
            error: 'Failed to load trip draft',
          });
        }
      },

      createConversation: async (tripId?: string, title?: string) => {
        try {
          set({ isSubmitting: true, error: null });

          // Always create server-side conversation - auth required
          const conversation = await aiConversationService.createConversation({ tripId, title });
          // Reset data related to previous conversation
          activeController?.abort();
          activeController = null;
          set({
            conversationId: conversation.id,
            messages: [],
            inputValue: '',
            isSubmitting: false,
            error: null,
            isMapLoading: true,
            currentItinerary: null,
            draftId: null,
            isDraftLoading: false,
            suggestions: [],
            rightPanelMode: 'draft',
            savedTrip: null,
            savedTripId: null,
            isSavingDraft: false,
            selectedDestination: null,
            selectedDayNumber: null,
            pendingDraftData: null,
            pendingAttachments: [],
            conversationFiles: [],
          });
          return conversation.id;
        } catch (error) {
          console.error('Failed to create conversation:', error);
          set({ error: 'Không thể tạo cuộc hội thoại mới', isSubmitting: false });
          return null;
        }
      },

      sendMessage: async (message: string, context?: TripPlanningContext) => {
        const trimmed = message.trim();
        const conversationId = get().conversationId;
        if (!trimmed || !conversationId || get().isSubmitting) return;

        // Collect ready file IDs from pending attachments
        const fileIds = get().pendingAttachments
          .filter((a) => a.status === 'READY' && a.record?.id)
          .map((a) => a.record!.id);

        // Detect first message to auto-generate conversation title
        const isFirstMessage = get().messages.length === 0;

        set({ error: null, isSubmitting: true, suggestions: [] });

        // Clear attachments after collecting fileIds
        get().clearAttachments();

        // Update conversation title with first message (fire-and-forget)
        if (isFirstMessage) {
          const title = generateTitle(trimmed);
          aiConversationService.updateConversation(conversationId, { title })
            .then(() => useSidebarStore.getState().fetchSidebarData())
            .catch(() => {});
        }

        // Generate clientMessageId for idempotency
        const clientMessageId = uuidv4();

        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content: trimmed,
          clientMessageId,
        };
        const assistantMessageId = `assistant-${Date.now() + 1}`;

        set((state) => ({
          messages: [
            ...state.messages,
            userMessage,
            { id: assistantMessageId, role: 'assistant', content: '', isStreaming: true },
          ],
        }));

        activeController?.abort();
        const controller = new AbortController();
        activeController = controller;

        try {
          await aiConversationService.streamChat(
            {
              message: trimmed,
              conversationId,
              clientMessageId,
              context,
              fileIds: fileIds.length > 0 ? fileIds : undefined,
            },
            {
              onChunk: (text) => {
                set((state) => ({
                  messages: state.messages.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: msg.content + text, isStreaming: true }
                      : msg
                  ),
                }));
              },
              onFunctionCall: (data) => {
                // Capture function call events from SSE stream
                const functionCall = data as { name: string; arguments: Record<string, unknown> };
                set((state) => ({
                  messages: state.messages.map((msg) =>
                    msg.id === assistantMessageId
                      ? {
                        ...msg,
                        functionCalls: [...(msg.functionCalls || []), functionCall],
                      }
                      : msg
                  ),
                }));
              },
              onFunctionResult: (data) => {
                const toolResult = data as { name: string; result: unknown };
                // Track tool result so FunctionCallsToggle shows completion
                set((state) => ({
                  messages: state.messages.map((msg) =>
                    msg.id === assistantMessageId
                      ? {
                        ...msg,
                        toolResults: [...(msg.toolResults || []), toolResult],
                      }
                      : msg
                  ),
                }));
                const newSources = extractSourcesFromToolResult(toolResult.name, toolResult.result);
                if (newSources.length > 0) {
                  set((state) => ({
                    messages: state.messages.map((msg) =>
                      msg.id === assistantMessageId
                        ? {
                          ...msg,
                          sources: [...(msg.sources || []), ...newSources],
                        }
                        : msg
                    ),
                  }));
                }
                // Show destination panel for search_places results
                if (toolResult.name === 'search_places') {
                  const dest = parseSearchPlacesResult(toolResult.result);
                  if (dest) set({ selectedDestination: dest });
                }
              },
              onDraftCreated: (data) => {
                // Preload images so they're cached before user clicks "Save Plan"
                preloadItineraryImages(data.itinerary);
                // If in timeline mode, queue as pending instead of overwriting
                if (get().rightPanelMode === 'timeline') {
                  set({ pendingDraftData: { draftId: data.draftId, itinerary: data.itinerary } });
                } else {
                  set({
                    draftId: data.draftId,
                    currentItinerary: data.itinerary,
                  });
                }
              },
              onSources: (sources) => {
                set((state) => ({
                  messages: state.messages.map((msg) =>
                    msg.id === assistantMessageId
                      ? {
                        ...msg,
                        sources: [
                          ...(msg.sources || []),
                          ...sources.map((s) => ({
                            title: s.title || '',
                            url: s.url,
                          })),
                        ],
                      }
                      : msg
                  ),
                }));
              },
              onSuggestions: (suggestions) => {
                set({ suggestions });
              },
              onDone: () => {
                set((state) => ({
                  messages: state.messages.map((msg) =>
                    msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg
                  ),
                  isSubmitting: false,
                  inputValue: '',
                }));
              },
              onError: (errorMessage) => {
                // Mark user message as having error for retry
                set((state) => ({
                  messages: state.messages.map((msg) => {
                    if (msg.id === assistantMessageId) {
                      return { ...msg, isStreaming: false, content: '', error: true };
                    }
                    if (msg.clientMessageId === clientMessageId) {
                      return { ...msg, error: true };
                    }
                    return msg;
                  }),
                  error: errorMessage,
                  isSubmitting: false,
                }));
              },
            },
            controller.signal
          );
        } catch {
          if (!controller.signal.aborted) {
            // Mark messages as having error
            set((state) => ({
              messages: state.messages.map((msg) => {
                if (msg.id === assistantMessageId) {
                  return { ...msg, isStreaming: false, content: '', error: true };
                }
                if (msg.clientMessageId === clientMessageId) {
                  return { ...msg, error: true };
                }
                return msg;
              }),
              error: 'Không thể gửi tin nhắn. Vui lòng thử lại.',
              isSubmitting: false,
            }));
          }
        }
      },

      retryMessage: async (userMessageId: string) => {
        const state = get();
        const conversationId = state.conversationId;
        if (!conversationId || state.isSubmitting) return;

        // Find the user message to retry
        const userMessage = state.messages.find((msg) => msg.id === userMessageId);
        if (!userMessage || userMessage.role !== 'user') return;

        // Generate NEW clientMessageId for the new message pair (don't reuse old one)
        const clientMessageId = uuidv4();

        set({ error: null, isSubmitting: true, suggestions: [] });

        // Create NEW user message (copy of original) and NEW assistant message
        const newUserMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content: userMessage.content,
          clientMessageId,
        };
        const assistantMessageId = `assistant-${Date.now() + 1}`;

        // Append new messages to the end (don't modify existing ones)
        set((state) => ({
          messages: [
            ...state.messages,
            newUserMessage,
            { id: assistantMessageId, role: 'assistant', content: '', isStreaming: true },
          ],
        }));

        activeController?.abort();
        const controller = new AbortController();
        activeController = controller;

        try {
          await aiConversationService.streamChat(
            { message: userMessage.content, conversationId, clientMessageId },
            {
              onChunk: (text) => {
                set((state) => ({
                  messages: state.messages.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: msg.content + text, isStreaming: true }
                      : msg
                  ),
                }));
              },
              onFunctionCall: (data) => {
                const functionCall = data as { name: string; arguments: Record<string, unknown> };
                set((state) => ({
                  messages: state.messages.map((msg) =>
                    msg.id === assistantMessageId
                      ? {
                        ...msg,
                        functionCalls: [...(msg.functionCalls || []), functionCall],
                      }
                      : msg
                  ),
                }));
              },
              onFunctionResult: (data) => {
                const toolResult = data as { name: string; result: unknown };
                // Track tool result so FunctionCallsToggle shows completion
                set((state) => ({
                  messages: state.messages.map((msg) =>
                    msg.id === assistantMessageId
                      ? {
                        ...msg,
                        toolResults: [...(msg.toolResults || []), toolResult],
                      }
                      : msg
                  ),
                }));
                const newSources = extractSourcesFromToolResult(toolResult.name, toolResult.result);
                if (newSources.length > 0) {
                  set((state) => ({
                    messages: state.messages.map((msg) =>
                      msg.id === assistantMessageId
                        ? {
                          ...msg,
                          sources: [...(msg.sources || []), ...newSources],
                        }
                        : msg
                    ),
                  }));
                }
                // Show destination panel for search_places results
                if (toolResult.name === 'search_places') {
                  const dest = parseSearchPlacesResult(toolResult.result);
                  if (dest) set({ selectedDestination: dest });
                }
              },
              onDraftCreated: (data) => {
                // Preload images so they're cached before user clicks "Save Plan"
                preloadItineraryImages(data.itinerary);
                // If in timeline mode, queue as pending instead of overwriting
                if (get().rightPanelMode === 'timeline') {
                  set({ pendingDraftData: { draftId: data.draftId, itinerary: data.itinerary } });
                } else {
                  set({
                    draftId: data.draftId,
                    currentItinerary: data.itinerary,
                  });
                }
              },
              onSources: (sources) => {
                set((state) => ({
                  messages: state.messages.map((msg) =>
                    msg.id === assistantMessageId
                      ? {
                        ...msg,
                        sources: [
                          ...(msg.sources || []),
                          ...sources.map((s) => ({
                            title: s.title || '',
                            url: s.url,
                          })),
                        ],
                      }
                      : msg
                  ),
                }));
              },
              onSuggestions: (suggestions) => {
                set({ suggestions });
              },
              onDone: () => {
                set((state) => ({
                  messages: state.messages.map((msg) =>
                    msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg
                  ),
                  isSubmitting: false,
                }));
              },
              onError: (errorMessage) => {
                set((state) => ({
                  messages: state.messages.map((msg) => {
                    if (msg.id === assistantMessageId) {
                      return { ...msg, isStreaming: false, content: '', error: true };
                    }
                    if (msg.clientMessageId === clientMessageId) {
                      return { ...msg, error: true };
                    }
                    return msg;
                  }),
                  error: errorMessage,
                  isSubmitting: false,
                }));
              },
            },
            controller.signal
          );
        } catch {
          if (!controller.signal.aborted) {
            set((state) => ({
              messages: state.messages.map((msg) => {
                if (msg.id === assistantMessageId) {
                  return { ...msg, isStreaming: false, content: '', error: true };
                }
                if (msg.clientMessageId === clientMessageId) {
                  return { ...msg, error: true };
                }
                return msg;
              }),
              error: 'Không thể gửi tin nhắn. Vui lòng thử lại.',
              isSubmitting: false,
            }));
          }
        }
      },
    }),
    {
      name: 'atrips-chat-store',
      storage: createJSONStorage(() => sessionStorage),
      // Persist essential data including currentItinerary for draft updates
      partialize: (state) => ({
        draftId: state.draftId,
        conversationId: state.conversationId,
        currentItinerary: state.currentItinerary,
        rightPanelMode: state.rightPanelMode,
        savedTripId: state.savedTripId,
      }),
    }
  )
);

export default useChatStore;
