import { fetchEventSource } from '@microsoft/fetch-event-source';

import api from '../lib/api';
import type { ItineraryStructuredData, YouTubeVideo } from '../types/itinerary.types';

export interface YouTubeSearchParams {
  query: string;
  maxResults?: number;
  videoDuration?: string;
  order?: string;
  publishedAfter?: string;
}

export interface YouTubeSearchResponse {
  videos: YouTubeVideo[];
  totalResults: number;
  source: string;
}

export interface TripPlanningContext {
  destination?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  travelers?: number;
  budget?: number | null;
  currency?: string;
}

export interface ChatPayload {
  message: string;
  conversationId?: string | null;
  tripId?: string | null;
  clientMessageId?: string; // For idempotency on retry
  context?: TripPlanningContext; // Trip planning context for AI
  fileIds?: string[]; // Uploaded file IDs for context injection
}

export interface ChatResponse {
  conversationId: string;
  message: string;
  usage?: unknown;
  quota?: unknown;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  structuredData?: unknown;
  tokensUsed?: number;
  sources?: unknown;
  createdAt?: string;
  functionCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
  toolResults?: Array<{ name: string; result: unknown }>;
}

export interface ConversationDetail {
  id: string;
  title?: string;
  ai_messages: ConversationMessage[];
  ai_itinerary_drafts?: Array<{
    id: string;
    sourcePrompt: string;
    appliedAt: string | null;
    appliedToTripId: string | null;
    createdAt: string;
  }>;
}

export interface ConversationItem {
  id: string;
  userId: string;
  tripId?: string | null;
  title: string;
  totalTokensUsed: number;
  createdAt: string;
  updatedAt: string;
  ai_messages: ConversationMessage[];
  trips?: unknown;
}

export interface ConversationsListResponse {
  data: ConversationItem[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

class AiConversationService {
  async chat(payload: ChatPayload): Promise<ChatResponse> {
    const body: Record<string, unknown> = { message: payload.message };
    if (payload.conversationId) body.conversationId = payload.conversationId;
    if (payload.tripId) body.tripId = payload.tripId;
    if (payload.fileIds?.length) body.fileIds = payload.fileIds;

    const response = await api.post('/ai/chat', body);
    return response.data.data;
  }

  async createConversation(
    payload: { tripId?: string; title?: string; continueFromId?: string } = {},
  ): Promise<ConversationDetail> {
    // Always create on server - auth required
    const response = await api.post('/ai/conversations', payload);
    return response.data.data.conversation;
  }

  async streamChat(
    payload: ChatPayload,
    handlers: {
      onConversation?: (conversationId: string) => void;
      onChunk?: (text: string) => void;
      onFunctionCall?: (data: unknown) => void;
      onFunctionResult?: (data: unknown) => void;
      onDraftCreated?: (data: { draftId: string; itinerary: ItineraryStructuredData }) => void;
      onSources?: (sources: Array<{ url: string; title: string }>) => void;
      onSuggestions?: (suggestions: string[]) => void;
      onQuota?: (data: {
        conversation: {
          messagesUsed: number;
          messagesLimit: number;
          tokensUsed: number;
          tokensLimit: number;
        };
        monthly: { used: number; limit: number };
      }) => void;
      onDone?: (data: unknown) => void;
      onError?: (error: string) => void;
    },
    signal?: AbortSignal
  ): Promise<void> {
    const params = new URLSearchParams({ message: payload.message });
    if (payload.conversationId) params.append('conversationId', payload.conversationId);
    if (payload.tripId) params.append('tripId', payload.tripId);
    if (payload.clientMessageId) params.append('clientMessageId', payload.clientMessageId);
    if (payload.context) params.append('context', JSON.stringify(payload.context));
    if (payload.fileIds?.length) params.append('fileIds', JSON.stringify(payload.fileIds));

    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';
    const url = `${baseUrl}/ai/chat/stream?${params.toString()}`;

    // Optimized batching mechanism for smooth streaming
    // Collects chunks within the same frame and flushes on next animation frame
    let chunkBuffer = '';
    let rafScheduled = false;

    const flushBuffer = () => {
      rafScheduled = false;
      if (chunkBuffer && handlers.onChunk) {
        const textToFlush = chunkBuffer;
        chunkBuffer = '';
        handlers.onChunk(textToFlush);
      }
    };

    const addToBuffer = (text: string) => {
      chunkBuffer += text;
      if (!rafScheduled) {
        rafScheduled = true;
        requestAnimationFrame(flushBuffer);
      }
    };

    const cleanup = () => {
      // Flush any remaining buffer immediately
      if (chunkBuffer && handlers.onChunk) {
        handlers.onChunk(chunkBuffer);
        chunkBuffer = '';
      }
    };

    // Track whether stream completed normally to prevent auto-retry
    let streamCompleted = false;

    // Store pending itinerary data from create_trip_plan tool call
    let pendingItineraryData: {
      title?: string;
      destination?: string;
      description?: string;
      startDate?: string;
      endDate?: string;
      travelersCount?: number;
      itineraryData?: {
        days?: Array<{
          dayNumber?: number;
          date?: string;
          theme?: string;
          dailyCost?: number;
          meals?: {
            breakfast?: string;
            lunch?: string;
            dinner?: string;
          };
          activities?: Array<{
            title?: string;
            time?: string;
            location?: string;
            description?: string;
            type?: string;
            estimatedCost?: number;
            duration?: number;
          }>;
        }>;
        budget?: unknown;
        tips?: string[];
      };
    } | null = null;

    const MAX_RETRIES = 3;
    let retryCount = 0;

    try {
      await fetchEventSource(url, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
        },
        credentials: 'include', // Send cookies for authentication
        signal,
        openWhenHidden: true, // Keep connection even when tab is hidden

        onopen: async (response) => {
          if (response.status === 429) {
            const body = await response.json().catch(() => null);
            const details = body?.error?.details;
            handlers.onError?.(
              `CONVERSATION_LIMIT:${JSON.stringify(details)}`,
            );
            throw new Error('CONVERSATION_LIMIT');
          }
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        },

        onmessage: (event) => {
          let data: Record<string, unknown> | null = null;
          try {
            data = JSON.parse(event.data);
          } catch {
            // Non-JSON data fallback
            return;
          }

          if (!data || typeof data !== 'object') return;

          const eventType = data.type as string;

          switch (eventType) {
            case 'content':
              // Content chunks - streaming text
              if (typeof data.content === 'string') {
                addToBuffer(data.content);
              }
              break;
            case 'tool_call':
              // Tool call event - AI is calling a function
              if (data.name && typeof data.name === 'string') {
                // Capture itinerary data from create_trip_plan tool call
                if (data.name === 'create_trip_plan' && data.arguments) {
                  pendingItineraryData = data.arguments as typeof pendingItineraryData;
                  console.log('📝 Captured create_trip_plan data:', pendingItineraryData);
                }
                handlers.onFunctionCall?.({
                  name: data.name,
                  arguments: data.arguments || {},
                });
              }
              break;
            case 'tool_result':
              // Tool result event - function execution result
              if (data.name && typeof data.name === 'string') {
                handlers.onFunctionResult?.({
                  name: data.name,
                  result: data.result,
                });
              }
              break;
            case 'draft_created':
              // Draft created - use captured data from tool_call or event payload
              console.log('🎯 draft_created event received:', data);
              console.log('📋 pendingItineraryData:', pendingItineraryData);

              // Fallback: construct from event's itineraryData (PlanningPipeline path
              // sends itineraryData directly in the draft_created event)
              if (!pendingItineraryData && data.itineraryData) {
                const itin = data.itineraryData as Record<string, unknown>;
                pendingItineraryData = Object.assign({
                  title: itin.title as string,
                  destination: (itin.destination as string) || '',
                  description: itin.description as string,
                  startDate: (itin.startDate as string) || '',
                  endDate: (itin.endDate as string) || '',
                  travelersCount: (itin.travelersCount as number) || 1,
                  itineraryData: data.itineraryData,
                }, {
                  overview: itin.overview,
                  travelTips: itin.travelTips,
                  budgetBreakdown: itin.budgetBreakdown,
                  bookingSuggestions: itin.bookingSuggestions,
                }) as NonNullable<typeof pendingItineraryData>;
              }

              if (data.draftId && typeof data.draftId === 'string' && pendingItineraryData) {
                // Extract budget from itineraryData - could be in different fields
                const budgetData = pendingItineraryData.itineraryData?.budget as {
                  total?: number;
                  currency?: string;
                  breakdown?: Record<string, number>;
                } | number | null;
                const itinData = pendingItineraryData.itineraryData as Record<string, unknown> | undefined;
                const totalEstimatedCost = itinData?.totalEstimatedCost;

                // Handle budget - could be number or object with total
                let budgetAmount: number | undefined;
                let budgetCurrency = (itinData?.currency as string) || 'VND';

                if (typeof budgetData === 'number' && budgetData > 0) {
                  budgetAmount = budgetData;
                } else if (budgetData && typeof budgetData === 'object' && budgetData.total) {
                  budgetAmount = budgetData.total;
                  budgetCurrency = budgetData.currency || 'VND';
                } else if (typeof totalEstimatedCost === 'number' && totalEstimatedCost > 0) {
                  budgetAmount = totalEstimatedCost;
                }

                // Ensure budget is valid
                if (budgetAmount && (isNaN(budgetAmount) || budgetAmount <= 0)) {
                  budgetAmount = undefined;
                }

                // Transform create_trip_plan arguments to ItineraryStructuredData format
                const pending = pendingItineraryData as Record<string, unknown>;
                const pendingOverview = pending.overview;
                const itinerary: ItineraryStructuredData = {
                  tripTitle: pendingItineraryData.title,
                  destination: pendingItineraryData.destination || '',
                  description: pendingItineraryData.description,
                  startDate: pendingItineraryData.startDate || '',
                  endDate: pendingItineraryData.endDate || '',
                  travelers: pendingItineraryData.travelersCount,
                  budget: budgetAmount,
                  currency: budgetCurrency,
                  overview: typeof pendingOverview === 'object' && pendingOverview ? (pendingOverview as Record<string, unknown>).summary as string : (pendingOverview as string) || undefined,
                  overviewData: typeof pendingOverview === 'object' ? pendingOverview as Record<string, unknown> : undefined,
                  travelTips: (pending.travelTips as ItineraryStructuredData['travelTips']) || undefined,
                  bookingSuggestions: (pending.bookingSuggestions as ItineraryStructuredData['bookingSuggestions']) || undefined,
                  budgetBreakdown: (pending.budgetBreakdown as ItineraryStructuredData['budgetBreakdown']) || (pendingItineraryData.itineraryData?.budget && typeof pendingItineraryData.itineraryData.budget === 'object' ? (pendingItineraryData.itineraryData.budget as Record<string, unknown>).breakdown as ItineraryStructuredData['budgetBreakdown'] : undefined) || undefined,
                  days: (pendingItineraryData.itineraryData?.days || []).map((day, index) => {
                    const mappedActivities = (day.activities || []).map((activity, actIndex) => {
                      const act = activity as Record<string, unknown>;
                      const actCoordinates = act.coordinates as Record<string, unknown> | undefined;
                      const lat = typeof actCoordinates?.lat === 'number'
                        ? actCoordinates.lat
                        : (typeof act.latitude === 'number' ? act.latitude : undefined);
                      const lng = typeof actCoordinates?.lng === 'number'
                        ? actCoordinates.lng
                        : (typeof act.longitude === 'number' ? act.longitude : undefined);
                      const normalizedCoordinates = (typeof lat === 'number' && typeof lng === 'number')
                        ? { ...(actCoordinates || {}), lat, lng }
                        : undefined;
                      const rawPhotos = Array.isArray(act.photos)
                        ? act.photos.filter((value): value is string => typeof value === 'string')
                        : [];
                      const rawGoogleMapsInfo =
                        act.googleMapsInfo && typeof act.googleMapsInfo === 'object'
                          ? (act.googleMapsInfo as Record<string, unknown>)
                          : undefined;
                      const mergedGoogleMapsInfo = rawGoogleMapsInfo
                        ? {
                            ...rawGoogleMapsInfo,
                            photos: Array.isArray(rawGoogleMapsInfo.photos)
                              ? rawGoogleMapsInfo.photos
                              : rawPhotos,
                          }
                        : (rawPhotos.length > 0 ? { photos: rawPhotos } : undefined);

                      return {
                      name: activity.title || activity.location || `Activity ${actIndex + 1}`,
                      title: activity.title,
                      type: activity.type || 'ACTIVITY',
                      time: activity.time,
                      startTime: activity.time,
                      description: activity.description,
                      location: activity.location,
                      duration: activity.duration,
                      estimatedCost: activity.estimatedCost,
                      coordinates: normalizedCoordinates as { lat: number; lng: number } | undefined,
                      image: (act.image as string) || undefined,
                      thumbnail: (act.thumbnail as string) || undefined,
                      imageUrl: (act.imageUrl as string) || undefined,
                      thumbnailUrl: (act.thumbnailUrl as string) || undefined,
                      photos: rawPhotos,
                      placeId: (act.placeId as string) || undefined,
                      transportFromPrevious: act.transportFromPrevious || undefined,
                      googleMapsInfo: mergedGoogleMapsInfo,
                    };}) as ItineraryStructuredData['days'][number]['activities'];

                    return {
                      dayNumber: day.dayNumber || index + 1,
                      date: day.date || '',
                      title: day.theme,
                      theme: day.theme,
                      dailyCost: day.dailyCost,
                      meals: day.meals,
                      activities: mappedActivities,
                      schedule: mappedActivities, // Map to schedule for component compatibility
                    };
                  }),
                };

                console.log('✅ Transformed itinerary:', itinerary);

                handlers.onDraftCreated?.({
                  draftId: data.draftId as string,
                  itinerary,
                });

                // Clear pending data after use
                pendingItineraryData = null;
              }
              break;
            case 'finish':
              // AI finished generating (reason: 'stop' or 'tool_calls')
              streamCompleted = true;
              cleanup();
              break;
            case 'sources':
              // Sources event - forward to handler
              if (Array.isArray(data.sources)) {
                handlers.onSources?.(data.sources as Array<{ url: string; title: string }>);
              }
              break;
            case 'suggestions':
              // Suggestions event - forward to handler
              handlers.onSuggestions?.(data.suggestions as string[]);
              break;
            case 'quota':
              handlers.onQuota?.({
                conversation: data.conversation as {
                  messagesUsed: number;
                  messagesLimit: number;
                  tokensUsed: number;
                  tokensLimit: number;
                },
                monthly: data.monthly as {
                  used: number;
                  limit: number;
                },
              });
              break;
            case 'done':
              // Final event with metadata
              streamCompleted = true;
              cleanup();
              if (data.conversationId && typeof data.conversationId === 'string') {
                handlers.onConversation?.(data.conversationId);
              }
              // Extract suggestions from done event or from fullContent
              if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
                handlers.onSuggestions?.(data.suggestions as string[]);
              } else if (typeof data.fullContent === 'string') {
                const suggestionsMatch = data.fullContent.match(/<suggestions>([\s\S]*?)<\/suggestions>/);
                if (suggestionsMatch) {
                  try {
                    const parsed = JSON.parse(suggestionsMatch[1]);
                    if (Array.isArray(parsed)) {
                      handlers.onSuggestions?.(parsed);
                    }
                  } catch {
                    // ignore parse errors
                  }
                }
              }
              handlers.onDone?.(data);
              break;
            case 'error': {
              cleanup();
              streamCompleted = true;
              const errorMsg = typeof data.error === 'string' ? data.error : 'Stream error';
              handlers.onError?.(errorMsg);
              break;
            }
            default:
              break;
          }
        },

        onclose: () => {
          cleanup();
          // Always prevent auto-retry. Each chat message is a
          // one-shot SSE request — retrying resends the same message.
          // Connection errors are handled separately by onerror.
          throw new Error('Stream closed');
        },

        onerror: (error) => {
          if (signal?.aborted || streamCompleted) {
            cleanup();
            throw error;
          }
          retryCount++;
          if (retryCount > MAX_RETRIES) {
            cleanup();
            handlers.onError?.('Connection to server lost');
            throw error;
          }
          // Return interval ms to retry after delay
          return retryCount * 1000;
        },
      });
    } catch (err) {
      cleanup();
      const isNormalClose = err instanceof Error && err.message === 'Stream closed';
      if (isNormalClose || streamCompleted) {
        // Stream closed normally — ensure onDone fires even if server
        // didn't send an explicit 'done' event (e.g. clarification responses)
        handlers.onDone?.({});
      } else if (!signal?.aborted) {
        handlers.onError?.('Không thể kết nối tới server.');
      }
    }
  }

  async getConversation(conversationId: string): Promise<ConversationDetail> {
    // Always fetch from server - auth required
    const response = await api.get(`/ai/conversations/${conversationId}`);
    return response.data.data.conversation;
  }

  async updateConversation(conversationId: string, payload: { title?: string }): Promise<void> {
    await api.patch(`/ai/conversations/${conversationId}`, payload);
  }

  async searchYouTubeVideos(params: YouTubeSearchParams): Promise<YouTubeSearchResponse> {
    const response = await api.post('/ai/tools/search_youtube_videos/execute', params);
    return response.data.data || response.data;
  }

  async listConversations(params?: {
    limit?: number;
    offset?: number;
    tripId?: string;
  }): Promise<ConversationsListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    if (params?.tripId) searchParams.append('tripId', params.tripId);

    const query = searchParams.toString();
    const url = query ? `/ai/conversations?${query}` : '/ai/conversations';

    const response = await api.get(url);
    const apiData = response.data.data;

    return {
      data: apiData.conversations || [],
      pagination: {
        limit: params?.limit || 10,
        offset: params?.offset || 0,
        total: apiData.total || 0,
      },
    };
  }
}

const aiConversationService = new AiConversationService();
export default aiConversationService;
