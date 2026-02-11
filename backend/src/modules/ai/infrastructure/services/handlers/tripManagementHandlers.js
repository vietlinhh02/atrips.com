/**
 * Trip Management Handlers
 * Handles trip CRUD operations, activities, and days management
 */

import tripRepository from '../../../../trip/infrastructure/repositories/TripRepository.js';
import activityRepository from '../../../../trip/infrastructure/repositories/ActivityRepository.js';
import itineraryDayRepository from '../../../../trip/infrastructure/repositories/ItineraryDayRepository.js';
import applyAIDraftUseCase from '../../../../trip/application/useCases/ApplyAIDraftUseCase.js';

/**
 * Create trip management handlers bound to executor context
 */
export function createTripManagementHandlers(executor) {
  return {
    getUserTrips: getUserTrips.bind(executor),
    getTripDetail: getTripDetail.bind(executor),
    updateTrip: updateTrip.bind(executor),
    deleteTrip: deleteTrip.bind(executor),
    addActivity: addActivity.bind(executor),
    updateActivity: updateActivity.bind(executor),
    deleteActivity: deleteActivity.bind(executor),
    reorderActivities: reorderActivities.bind(executor),
    applyDraftToTrip: applyDraftToTrip.bind(executor),
    addDayToTrip: addDayToTrip.bind(executor),
    updateDay: updateDay.bind(executor),
    deleteDay: deleteDay.bind(executor),
  };
}

/**
 * Get user's trips list
 */
async function getUserTrips(args) {
  const { status, limit = 10 } = args;

  if (!this.currentUserId) {
    return {
      success: false,
      error: 'User not authenticated',
      message: 'Bạn cần đăng nhập để xem danh sách chuyến đi.',
    };
  }

  try {
    const filters = status ? { status } : {};
    const result = await tripRepository.getUserTrips(this.currentUserId, filters, { page: 1, limit });

    return {
      success: true,
      trips: result.trips,
      total: result.pagination.total,
      message: `Tìm thấy ${result.pagination.total} chuyến đi${status ? ` với trạng thái ${status}` : ''}.`,
    };
  } catch (error) {
    console.error('Get user trips error:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Không thể lấy danh sách chuyến đi.',
    };
  }
}

/**
 * Get trip detail with itinerary
 */
async function getTripDetail(args) {
  const { tripId } = args;

  if (!this.currentUserId) {
    return {
      success: false,
      error: 'User not authenticated',
      message: 'Bạn cần đăng nhập để xem chi tiết chuyến đi.',
    };
  }

  try {
    const trip = await tripRepository.getTripWithItinerary(tripId, this.currentUserId);

    return {
      success: true,
      trip: {
        id: trip.id,
        title: trip.title,
        description: trip.description,
        startDate: trip.start_date,
        endDate: trip.end_date,
        status: trip.status,
        travelersCount: trip.travelers_count,
        budgetTotal: trip.budget_total,
        budgetCurrency: trip.budget_currency,
        days: trip.itinerary_days.map(day => ({
          id: day.id,
          date: day.date,
          dayNumber: day.day_number,
          title: day.title,
          notes: day.notes,
          activities: day.activities.map(act => ({
            id: act.id,
            name: act.name,
            type: act.type,
            description: act.description,
            startTime: act.start_time,
            endTime: act.end_time,
            duration: act.duration,
            address: act.custom_address,
            latitude: act.latitude,
            longitude: act.longitude,
            estimatedCost: act.estimated_cost,
            orderIndex: act.order_index,
          })),
        })),
        members: trip.trip_members,
      },
      message: `Đã lấy thông tin chuyến đi "${trip.title}".`,
    };
  } catch (error) {
    console.error('Get trip detail error:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Không thể lấy chi tiết chuyến đi. Trip có thể không tồn tại hoặc bạn không có quyền truy cập.',
    };
  }
}

/**
 * Update trip information
 */
async function updateTrip(args) {
  const { tripId, ...updates } = args;

  if (!this.currentUserId) {
    return {
      success: false,
      error: 'User not authenticated',
      message: 'Bạn cần đăng nhập để cập nhật chuyến đi.',
    };
  }

  try {
    const trip = await tripRepository.updateTrip(tripId, updates, this.currentUserId);

    const updatedFields = Object.keys(updates).filter(k => updates[k] !== undefined);
    return {
      success: true,
      trip: trip.toJSON(),
      updatedFields,
      message: `Đã cập nhật chuyến đi "${trip.title}". Các trường đã thay đổi: ${updatedFields.join(', ')}.`,
    };
  } catch (error) {
    console.error('Update trip error:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Không thể cập nhật chuyến đi.',
    };
  }
}

/**
 * Delete trip
 */
async function deleteTrip(args) {
  const { tripId, confirm } = args;

  if (!this.currentUserId) {
    return {
      success: false,
      error: 'User not authenticated',
      message: 'Bạn cần đăng nhập để xóa chuyến đi.',
    };
  }

  if (!confirm) {
    return {
      success: false,
      error: 'Confirmation required',
      message: 'Vui lòng xác nhận xóa chuyến đi. Hành động này không thể hoàn tác!',
      requireConfirm: true,
    };
  }

  try {
    const trip = await tripRepository.getTripById(tripId, this.currentUserId);
    const tripTitle = trip?.title || 'Unknown';

    await tripRepository.deleteTrip(tripId, this.currentUserId);

    return {
      success: true,
      deletedTripId: tripId,
      message: `Đã xóa chuyến đi "${tripTitle}" thành công.`,
    };
  } catch (error) {
    console.error('Delete trip error:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Không thể xóa chuyến đi.',
    };
  }
}

/**
 * Add activity to a day
 */
async function addActivity(args) {
  const { tripId, dayId, name, type, description, startTime, endTime, duration, address, latitude, longitude, estimatedCost, notes } = args;

  if (!this.currentUserId) {
    return {
      success: false,
      error: 'User not authenticated',
      message: 'Bạn cần đăng nhập để thêm hoạt động.',
    };
  }

  try {
    await tripRepository.verifyTripOwnership(tripId, this.currentUserId);

    const activity = await activityRepository.create({
      itineraryDayId: dayId,
      name,
      type: type || 'OTHER',
      description,
      startTime,
      endTime,
      duration,
      customAddress: address,
      latitude,
      longitude,
      estimatedCost,
      notes,
      createdById: this.currentUserId,
    });

    return {
      success: true,
      activity: {
        id: activity.id,
        name: activity.name,
        type: activity.type,
        startTime: activity.start_time,
        orderIndex: activity.order_index,
      },
      message: `Đã thêm hoạt động "${name}" vào lịch trình.`,
    };
  } catch (error) {
    console.error('Add activity error:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Không thể thêm hoạt động.',
    };
  }
}

/**
 * Update activity
 */
async function updateActivity(args) {
  const { tripId, activityId, ...updates } = args;

  if (!this.currentUserId) {
    return {
      success: false,
      error: 'User not authenticated',
      message: 'Bạn cần đăng nhập để cập nhật hoạt động.',
    };
  }

  try {
    await tripRepository.verifyTripOwnership(tripId, this.currentUserId);

    if (updates.address) {
      updates.customAddress = updates.address;
      delete updates.address;
    }

    const activity = await activityRepository.update(activityId, updates);

    const updatedFields = Object.keys(updates).filter(k => updates[k] !== undefined);
    return {
      success: true,
      activity: {
        id: activity.id,
        name: activity.name,
        type: activity.type,
      },
      updatedFields,
      message: `Đã cập nhật hoạt động "${activity.name}". Các trường đã thay đổi: ${updatedFields.join(', ')}.`,
    };
  } catch (error) {
    console.error('Update activity error:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Không thể cập nhật hoạt động.',
    };
  }
}

/**
 * Delete activity
 */
async function deleteActivity(args) {
  const { tripId, activityId } = args;

  if (!this.currentUserId) {
    return {
      success: false,
      error: 'User not authenticated',
      message: 'Bạn cần đăng nhập để xóa hoạt động.',
    };
  }

  try {
    await tripRepository.verifyTripOwnership(tripId, this.currentUserId);

    const activity = await activityRepository.getById(activityId);
    const activityName = activity?.name || 'Unknown';

    await activityRepository.delete(activityId);

    return {
      success: true,
      deletedActivityId: activityId,
      message: `Đã xóa hoạt động "${activityName}" khỏi lịch trình.`,
    };
  } catch (error) {
    console.error('Delete activity error:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Không thể xóa hoạt động.',
    };
  }
}

/**
 * Reorder activities in a day
 */
async function reorderActivities(args) {
  const { tripId, dayId, activityIds } = args;

  if (!this.currentUserId) {
    return {
      success: false,
      error: 'User not authenticated',
      message: 'Bạn cần đăng nhập để sắp xếp hoạt động.',
    };
  }

  try {
    await tripRepository.verifyTripOwnership(tripId, this.currentUserId);
    await activityRepository.reorder(dayId, activityIds);

    return {
      success: true,
      reorderedCount: activityIds.length,
      message: `Đã sắp xếp lại ${activityIds.length} hoạt động.`,
    };
  } catch (error) {
    console.error('Reorder activities error:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Không thể sắp xếp lại hoạt động.',
    };
  }
}

/**
 * Apply draft to create trip
 */
async function applyDraftToTrip(args) {
  const { draftId, createNew = true, existingTripId } = args;

  if (!this.currentUserId) {
    return {
      success: false,
      error: 'User not authenticated',
      message: 'Bạn cần đăng nhập để tạo chuyến đi từ draft.',
    };
  }

  try {
    const result = await applyAIDraftUseCase.execute({
      draftId,
      userId: this.currentUserId,
      createNew,
      existingTripId,
    });

    return {
      success: true,
      trip: {
        id: result.trip.id,
        title: result.trip.title,
        startDate: result.trip.start_date,
        endDate: result.trip.end_date,
        daysCount: result.trip.itinerary_days?.length || 0,
      },
      message: `Đã tạo chuyến đi "${result.trip.title}" thành công từ draft!`,
    };
  } catch (error) {
    console.error('Apply draft error:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Không thể tạo chuyến đi từ draft.',
    };
  }
}

/**
 * Add a new day to trip
 */
async function addDayToTrip(args) {
  const { tripId, date, title, notes } = args;

  if (!this.currentUserId) {
    return {
      success: false,
      error: 'User not authenticated',
      message: 'Bạn cần đăng nhập để thêm ngày.',
    };
  }

  try {
    await tripRepository.verifyTripOwnership(tripId, this.currentUserId);

    const existingDays = await itineraryDayRepository.getDaysByTrip(tripId);
    const dayNumber = existingDays.length + 1;

    const day = await itineraryDayRepository.createDay(tripId, {
      date,
      dayNumber,
      title: title || `Day ${dayNumber}`,
      notes,
    });

    return {
      success: true,
      day: {
        id: day.id,
        date: day.date,
        dayNumber: day.day_number,
        title: day.title,
      },
      message: `Đã thêm "${day.title}" vào chuyến đi.`,
    };
  } catch (error) {
    console.error('Add day error:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Không thể thêm ngày vào chuyến đi.',
    };
  }
}

/**
 * Update day information
 */
async function updateDay(args) {
  const { tripId, dayId, title, notes, date } = args;

  if (!this.currentUserId) {
    return {
      success: false,
      error: 'User not authenticated',
      message: 'Bạn cần đăng nhập để cập nhật ngày.',
    };
  }

  try {
    await tripRepository.verifyTripOwnership(tripId, this.currentUserId);

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (notes !== undefined) updates.notes = notes;
    if (date !== undefined) updates.date = date;

    const day = await itineraryDayRepository.updateDay(dayId, updates);

    const updatedFields = Object.keys(updates);
    return {
      success: true,
      day: {
        id: day.id,
        title: day.title,
        date: day.date,
      },
      updatedFields,
      message: `Đã cập nhật thông tin ngày. Các trường đã thay đổi: ${updatedFields.join(', ')}.`,
    };
  } catch (error) {
    console.error('Update day error:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Không thể cập nhật thông tin ngày.',
    };
  }
}

/**
 * Delete a day from trip
 */
async function deleteDay(args) {
  const { tripId, dayId } = args;

  if (!this.currentUserId) {
    return {
      success: false,
      error: 'User not authenticated',
      message: 'Bạn cần đăng nhập để xóa ngày.',
    };
  }

  try {
    await tripRepository.verifyTripOwnership(tripId, this.currentUserId);

    const day = await itineraryDayRepository.getDayById(dayId);
    const dayTitle = day?.title || 'Unknown';
    const activitiesCount = day?.activities?.length || 0;

    await itineraryDayRepository.deleteDay(dayId);

    return {
      success: true,
      deletedDayId: dayId,
      activitiesDeleted: activitiesCount,
      message: `Đã xóa "${dayTitle}" và ${activitiesCount} hoạt động trong ngày đó.`,
    };
  } catch (error) {
    console.error('Delete day error:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Không thể xóa ngày.',
    };
  }
}
