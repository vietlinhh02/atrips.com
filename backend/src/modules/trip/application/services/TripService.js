/**
 * Trip Service
 * Business logic for trip operations
 */
class TripService {
  validateTripDates(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime())) {
      throw new Error('Invalid start date');
    }

    if (isNaN(end.getTime())) {
      throw new Error('Invalid end date');
    }

    if (start >= end) {
      throw new Error('Start date must be before end date');
    }

    return { start, end };
  }

  validateBudget(amount, currency) {
    if (amount !== null && amount !== undefined) {
      if (amount < 0) {
        throw new Error('Budget amount must be positive');
      }
    }

    if (currency && currency.length !== 3) {
      throw new Error('Currency code must be 3 characters (ISO 4217)');
    }

    return true;
  }

  validateTripStatus(currentStatus, newStatus) {
    const validTransitions = {
      DRAFT: ['ACTIVE', 'ARCHIVED'],
      ACTIVE: ['COMPLETED', 'ARCHIVED'],
      COMPLETED: ['ARCHIVED'],
      ARCHIVED: [],
    };

    const allowedStatuses = validTransitions[currentStatus] || [];
    if (!allowedStatuses.includes(newStatus)) {
      throw new Error(`Cannot transition from ${currentStatus} to ${newStatus}`);
    }

    return true;
  }

  calculateTripDuration(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  generateItineraryDays(startDate, endDate, destination = null) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = [];
    let currentDate = new Date(start);
    let dayNumber = 1;

    while (currentDate <= end) {
      days.push({
        date: currentDate.toISOString().split('T')[0],
        dayNumber,
        title: destination ? `Day ${dayNumber} in ${destination}` : `Day ${dayNumber}`,
        notes: null,
      });
      currentDate.setDate(currentDate.getDate() + 1);
      dayNumber++;
    }

    return days;
  }

  estimateBudgetBreakdown(totalBudget, days, travelStyle = 'moderate') {
    if (!totalBudget || totalBudget <= 0) {
      return null;
    }

    const styles = {
      budget: {
        accommodation: 0.30,
        food: 0.25,
        activities: 0.20,
        transportation: 0.15,
        other: 0.10,
      },
      moderate: {
        accommodation: 0.35,
        food: 0.25,
        activities: 0.20,
        transportation: 0.12,
        other: 0.08,
      },
      comfort: {
        accommodation: 0.40,
        food: 0.25,
        activities: 0.18,
        transportation: 0.10,
        other: 0.07,
      },
      luxury: {
        accommodation: 0.45,
        food: 0.25,
        activities: 0.15,
        transportation: 0.10,
        other: 0.05,
      },
    };

    const breakdown = styles[travelStyle] || styles.moderate;
    const result = {};

    for (const [category, percentage] of Object.entries(breakdown)) {
      result[category] = {
        total: Math.round(totalBudget * percentage),
        perDay: Math.round((totalBudget * percentage) / days),
      };
    }

    return result;
  }

  parseAIDraftToTripData(draftData) {
    const generatedData = typeof draftData === 'string' ? JSON.parse(draftData) : draftData;

    // Support nested trip object or flat structure
    const tripInfo = generatedData.trip || generatedData;
    const budgetInfo = generatedData.budget || {};

    return {
      title: tripInfo.title || tripInfo.tripTitle || tripInfo.destination || 'AI Generated Trip',
      destination: tripInfo.destination || null,
      description: tripInfo.description || tripInfo.overview || null,
      startDate: tripInfo.startDate || tripInfo.dates?.start || generatedData.startDate,
      endDate: tripInfo.endDate || tripInfo.dates?.end || generatedData.endDate,
      travelersCount: tripInfo.travelers || tripInfo.travelersCount || generatedData.travelers || 1,
      budgetTotal: budgetInfo.total || generatedData.budget || generatedData.budgetTotal || null,
      budgetCurrency: budgetInfo.currency || generatedData.currency || generatedData.budgetCurrency || 'VND',
      status: 'DRAFT',
      visibility: 'PRIVATE',
    };
  }

  mapActivityTypeFromAI(aiType) {
    const typeMapping = {
      sightseeing: 'ATTRACTION',
      attraction: 'ATTRACTION',
      dining: 'RESTAURANT',
      restaurant: 'RESTAURANT',
      food: 'RESTAURANT',
      meal: 'RESTAURANT',
      cafe: 'RESTAURANT',
      coffee: 'RESTAURANT',
      accommodation: 'HOTEL',
      hotel: 'HOTEL',
      lodging: 'HOTEL',
      transport: 'TRANSPORT',
      transportation: 'TRANSPORT',
      travel: 'TRANSPORT',
      activity: 'ACTIVITY',
      adventure: 'ACTIVITY',
      entertainment: 'ACTIVITY',
      shopping: 'ACTIVITY',
      market: 'ACTIVITY',
      store: 'ACTIVITY',
      flight: 'FLIGHT',
      other: 'CUSTOM',
    };

    const normalizedType = aiType?.toLowerCase() || 'custom';
    return typeMapping[normalizedType] || 'CUSTOM';
  }

  extractPlaceData(aiActivity) {
    return {
      name: aiActivity.name || aiActivity.place || aiActivity.title,
      description: aiActivity.description || aiActivity.details || null,
      address: aiActivity.address || aiActivity.location || null,
      latitude: aiActivity.coordinates?.lat || aiActivity.latitude || null,
      longitude: aiActivity.coordinates?.lng || aiActivity.longitude || null,
      placeId: aiActivity.placeId || aiActivity.googlePlaceId || null,
      estimatedCost: aiActivity.estimatedCost || aiActivity.cost || null,
      duration: aiActivity.duration || aiActivity.estimatedDuration || null,
    };
  }

  parseAIModifications(aiContent) {
    const changes = {
      extendDates: false,
      addActivities: [],
      removeActivities: [],
      updateActivities: [],
      updateTrip: null,
    };

    try {
      if (typeof aiContent === 'string') {
        const jsonMatch = aiContent.match(/```json\n([\s\S]*?)\n```/) ||
                         aiContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
          return this.#normalizeAIChanges(parsed);
        }
      } else if (typeof aiContent === 'object') {
        return this.#normalizeAIChanges(aiContent);
      }
    } catch (error) {
      console.error('Failed to parse AI modifications:', error);
    }

    return changes;
  }

  #normalizeAIChanges(parsed) {
    const changes = {
      extendDates: false,
      addActivities: [],
      removeActivities: [],
      updateActivities: [],
      updateTrip: null,
    };

    if (parsed.extendDates || parsed.newEndDate) {
      changes.extendDates = true;
      changes.newEndDate = parsed.newEndDate;
      changes.oldEndDate = parsed.oldEndDate;
    }

    if (parsed.updateTrip) {
      changes.updateTrip = parsed.updateTrip;
    }

    if (parsed.addActivities && Array.isArray(parsed.addActivities)) {
      changes.addActivities = parsed.addActivities;
    }

    if (parsed.removeActivities && Array.isArray(parsed.removeActivities)) {
      changes.removeActivities = parsed.removeActivities;
    }

    if (parsed.updateActivities && Array.isArray(parsed.updateActivities)) {
      changes.updateActivities = parsed.updateActivities;
    }

    return changes;
  }

  generateDayTitle(dayNumber, destination, theme = null) {
    if (theme) {
      return `Day ${dayNumber}: ${theme}`;
    }
    return destination ? `Day ${dayNumber} in ${destination}` : `Day ${dayNumber}`;
  }

  calculateActivityOrderIndex(existingActivities) {
    if (!existingActivities || existingActivities.length === 0) {
      return 0;
    }
    const maxOrder = Math.max(...existingActivities.map(a => a.orderIndex || 0));
    return maxOrder + 1;
  }
}

export default new TripService();
