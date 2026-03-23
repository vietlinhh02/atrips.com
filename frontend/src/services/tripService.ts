// src/services/tripService.ts

import api from '../lib/api';
import type { AIItineraryDraft, ItineraryStructuredData, TransportFromPrevious } from '../types/itinerary.types';

// ============================================
// API Response Types
// ============================================

export interface ImageAsset {
    id: string;
    status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
    variants: { thumb: string; card: string; hero: string; original: string } | null;
    sourceUrl: string;
}

interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
}

interface Trip {
    id: string;
    ownerId: string;
    title: string;
    description: string | null;
    startDate: string;
    endDate: string;
    travelersCount: number;
    budgetTotal: number | null;
    budgetCurrency: string;
    status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
    visibility: 'PRIVATE' | 'SHARED' | 'PUBLIC';
    coverImageUrl: string | null;
    createdAt: string;
    updatedAt: string;
}

interface TripActivity {
    id: string;
    name: string;
    type: string;
    description: string | null;
    startTime: string | null;
    endTime: string | null;
    duration: number | null;
    latitude: number | null;
    longitude: number | null;
    estimatedCost: number | string | null;
    currency: string;
    customAddress: string | null;
    notes: string | null;
    bookingUrl: string | null;
    placeId: string | null;
    transportFromPrevious: TransportFromPrevious | null;
    orderIndex: number;
    image_assets?: ImageAsset | null;
}

interface TripDay {
    id: string;
    tripId: string;
    date: string;
    dayNumber: number;
    notes: string | null;
    activities: TripActivity[];
}

interface TripWithItinerary extends Trip {
    itinerary_days: TripDay[];
    trip_members?: unknown[];
    _count?: { ai_conversations: number };
    coverImageAsset?: ImageAsset | null;
}

// ============================================
// Trip Service
// ============================================

class TripService {
    /**
     * Get a single draft by ID
     */
    async getDraft(draftId: string): Promise<AIItineraryDraft> {
        // The API might return { drafts: [...] } or { draft: ... }
        // We need to type the response as `any` temporarily or union to handle the mismatch safely
        const response = await api.get<ApiResponse<Record<string, unknown>>>(`/ai/drafts/${draftId}`);

        const data = response.data.data as Record<string, unknown>;

        if (data.draft) {
            return data.draft as AIItineraryDraft;
        }

        if (data.drafts && Array.isArray(data.drafts) && data.drafts.length > 0) {
            // If ID lookup returns a list, find the matching one or take the first
            return data.drafts.find((d: Record<string, unknown>) => d.id === draftId) || data.drafts[0];
        }

        throw new Error('Draft not found in response');
    }

    /**
     * List all drafts for the current user
     */
    async listDrafts(conversationId?: string): Promise<AIItineraryDraft[]> {
        const params = conversationId ? `?conversationId=${conversationId}` : '';
        const response = await api.get<ApiResponse<{ drafts: AIItineraryDraft[] }>>(`/ai/drafts${params}`);
        return response.data.data.drafts;
    }

    /**
     * Apply a draft to create a new trip or update existing trip
     */
    async applyDraft(
        draftId: string,
        options: {
            createNew?: boolean;
            existingTripId?: string;
        } = { createNew: true }
    ): Promise<TripWithItinerary> {
        const response = await api.post<ApiResponse<{ trip: TripWithItinerary }>>(
            `/trips/drafts/${draftId}/apply`,
            options
        );
        return response.data.data.trip;
    }

    /**
     * Get a single trip by ID with full itinerary
     */
    async getTrip(tripId: string): Promise<TripWithItinerary> {
        const response = await api.get<ApiResponse<{ trip: TripWithItinerary }>>(`/trips/${tripId}`);
        return response.data.data.trip;
    }

    /**
     * List all trips for the current user
     */
    async listTrips(params?: {
        status?: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
        page?: number;
        limit?: number;
    }): Promise<{
        trips: Trip[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }> {
        const response = await api.get<ApiResponse<{
            trips: Trip[];
            pagination: {
                page: number;
                limit: number;
                total: number;
                totalPages: number;
            };
        }>>('/trips', { params });
        return response.data.data;
    }

    /**
     * Update trip fields (title, visibility, status, etc.)
     */
    async updateTrip(
        tripId: string,
        data: Record<string, unknown>
    ): Promise<Trip> {
        const response = await api.patch<ApiResponse<{ trip: Trip }>>(
            `/trips/${tripId}`,
            data
        );
        return response.data.data.trip;
    }

    /**
     * Update an activity within a trip
     */
    async updateActivity(
        tripId: string,
        activityId: string,
        data: {
            name?: string;
            description?: string;
            startTime?: string;
            endTime?: string;
            estimatedCost?: number;
            notes?: string;
        }
    ): Promise<void> {
        await api.patch(`/trips/${tripId}/activities/${activityId}`, data);
    }

    /**
     * Delete an activity from a trip
     */
    async deleteActivity(tripId: string, activityId: string): Promise<void> {
        await api.delete(`/trips/${tripId}/activities/${activityId}`);
    }

    /**
     * Reorder activities within a day
     */
    async reorderActivities(tripId: string, dayId: string, activityIds: string[]): Promise<void> {
        await api.patch(`/trips/${tripId}/days/${dayId}/activities/reorder`, { activityIds });
    }

    /**
     * Add a new activity to a day
     */
    async addActivity(tripId: string, dayId: string, data: Record<string, unknown>): Promise<unknown> {
        const response = await api.post(`/trips/${tripId}/days/${dayId}/activities`, data);
        return response.data;
    }

    /**
     * Convert draft generatedData to ItineraryStructuredData format
     * This ensures consistency between API response and chatStore format
     */
    draftToItinerary(draft: AIItineraryDraft): ItineraryStructuredData {
        const rawGenerated = draft.generatedData as unknown;
        let rawData: Record<string, unknown>;
        if (typeof rawGenerated === 'string') {
            try {
                rawData = JSON.parse(rawGenerated) as Record<string, unknown>;
            } catch {
                rawData = {};
            }
        } else {
            rawData = rawGenerated as Record<string, unknown>;
        }

        // Map raw JSON fields to our internal types
        const days = ((rawData.days as Array<Record<string, unknown>>) || []).map((day: Record<string, unknown>, index: number) => {
            const activitiesData = (day.activities || day.schedule || []) as Array<Record<string, unknown>>;
            const normalizedActivities = activitiesData.map((activity) => {
                const coord = activity.coordinates as Record<string, unknown> | undefined;
                const lat = typeof coord?.lat === 'number'
                    ? coord.lat
                    : (typeof activity.latitude === 'number' ? activity.latitude : undefined);
                const lng = typeof coord?.lng === 'number'
                    ? coord.lng
                    : (typeof activity.longitude === 'number' ? activity.longitude : undefined);

                if (typeof lat === 'number' && typeof lng === 'number') {
                    return {
                        ...activity,
                        coordinates: {
                            ...(coord || {}),
                            lat,
                            lng,
                        },
                    };
                }

                return activity;
            });

            const rawDayNumber = day.dayNumber;
            const rawDay = day.day;
            const parsedDayNumber = typeof rawDayNumber === 'number'
                ? rawDayNumber
                : (typeof rawDayNumber === 'string' ? Number(rawDayNumber) : undefined);
            const parsedDayFallback = typeof rawDay === 'number'
                ? rawDay
                : (typeof rawDay === 'string' ? Number(rawDay) : undefined);
            const normalizedDayNumber =
                (parsedDayNumber && Number.isFinite(parsedDayNumber) && parsedDayNumber > 0
                    ? parsedDayNumber
                    : (parsedDayFallback && Number.isFinite(parsedDayFallback) && parsedDayFallback > 0
                        ? parsedDayFallback
                        : index + 1));

            return {
                ...day,
                dayNumber: normalizedDayNumber,
                activities: normalizedActivities, // Keep activities for compatibility
                schedule: normalizedActivities,   // Also map to schedule for backward compatibility
            };
        }) as unknown as ItineraryStructuredData['days'];

        // Extract budget - could be in different formats
        let budgetValue: number | undefined;
        let currencyValue = 'VND';

        // Check rawData.budget (could be object or number)
        const rawBudget = rawData.budget;
        if (rawBudget) {
            if (typeof rawBudget === 'object' && rawBudget !== null) {
                const budgetObj = rawBudget as Record<string, unknown>;
                if (budgetObj.total) {
                    budgetValue = Number(budgetObj.total);
                    currencyValue = (budgetObj.currency as string) || 'VND';
                }
            } else if (typeof rawBudget === 'number') {
                budgetValue = rawBudget;
            }
        }

        // Fallback to totalEstimatedCost
        if (!budgetValue && rawData.totalEstimatedCost) {
            budgetValue = Number(rawData.totalEstimatedCost);
        }

        // Fallback to trip.budget
        const rawTrip = rawData.trip as Record<string, unknown> | undefined;
        if (!budgetValue && rawTrip?.budget) {
            budgetValue = Number(rawTrip.budget);
        }

        // Ensure budget is valid
        if (budgetValue && (isNaN(budgetValue) || budgetValue <= 0)) {
            budgetValue = undefined;
        }

        // Extract other trip info
        const tripInfo = (rawTrip || {}) as Record<string, unknown>;

        // Map overview: if it's an object (rich data), put it in overviewData and extract summary for overview string
        const overviewRaw = rawData.overview;
        let overviewString: string | undefined;
        let overviewData: Record<string, unknown> | undefined = undefined;
        if (overviewRaw && typeof overviewRaw === 'object') {
            overviewData = overviewRaw as Record<string, unknown>;
            overviewString = (overviewData.summary as string) || undefined;
        } else if (typeof overviewRaw === 'string') {
            overviewString = overviewRaw;
        }

        return {
            ...rawData,
            days,
            destination: (rawData.destination as string) || (tripInfo.destination as string) || 'Unknown Destination',
            tripTitle: (tripInfo.title as string) || (rawData.title as string) || (draft.sourcePrompt ? (() => { try { return JSON.parse(draft.sourcePrompt).title; } catch { return 'Trip Plan'; } })() : 'Trip Plan'),
            description: (rawData.description as string) || (tripInfo.description as string) || undefined,
            startDate: (rawData.startDate as string) || (tripInfo.startDate as string) || '',
            endDate: (rawData.endDate as string) || (tripInfo.endDate as string) || '',
            travelers: (rawData.travelers as number) || (tripInfo.travelers as number) || (tripInfo.travelersCount as number) || 1,
            budget: budgetValue,
            currency: (rawData.currency as string) || currencyValue,
            overview: overviewString,
            overviewData,
            travelTips: rawData.travelTips as ItineraryStructuredData['travelTips'],
            bookingSuggestions: rawData.bookingSuggestions as ItineraryStructuredData['bookingSuggestions'],
            budgetBreakdown: rawData.budgetBreakdown as ItineraryStructuredData['budgetBreakdown'],
        } as ItineraryStructuredData;
    }
}

// Export singleton instance
export const tripService = new TripService();
export default tripService;
export type { Trip, TripWithItinerary };
