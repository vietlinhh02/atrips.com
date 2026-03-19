/**
 * Bookings Controller
 * Handles booking management (hotels, flights, tours, etc.)
 */

import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import { sendSuccess, sendCreated } from '../../../../shared/utils/response.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import tripRepository from '../../infrastructure/repositories/TripRepository.js';
import prisma from '../../../../config/database.js';
import novuService from '../../../notification/application/NovuService.js';

/**
 * GET /api/trips/:tripId/bookings
 * List all bookings for a trip
 */
export const listBookings = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const { type, status } = req.query;

  await tripRepository.verifyTripAccess(tripId, req.user.id);

  const where = {
    tripId,
    deletedAt: null,
  };

  if (type) where.bookingType = type;
  if (status) where.status = status;

  const bookings = await prisma.trip_bookings.findMany({
    where,
    include: {
      activities: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
    orderBy: { checkInDate: 'asc' },
  });

  return sendSuccess(res, { bookings, total: bookings.length });
});

/**
 * GET /api/bookings/:bookingId
 * Get booking details
 */
export const getBooking = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  const booking = await prisma.trip_bookings.findUnique({
    where: { id: bookingId },
    include: {
      activities: true,
      trips: {
        select: {
          id: true,
          title: true,
          ownerId: true,
        },
      },
    },
  });

  if (!booking) {
    throw AppError.notFound('Booking not found');
  }

  // Verify access
  await tripRepository.verifyTripAccess(booking.tripId, req.user.id);

  return sendSuccess(res, { booking });
});

/**
 * POST /api/trips/:tripId/bookings
 * Create a new booking
 */
export const createBooking = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const {
    activityId,
    bookingType,
    provider,
    providerBookingId,
    confirmationCode,
    bookingUrl,
    title,
    description,
    checkInDate,
    checkOutDate,
    checkInTime,
    checkOutTime,
    totalCost,
    currency,
    paymentStatus,
    guestsCount,
    guestNames,
    address,
    latitude,
    longitude,
    contactPhone,
    contactEmail,
    details,
    attachments,
  } = req.body;

  await tripRepository.verifyTripOwnership(tripId, req.user.id);

  // Validate required fields
  if (!title || !bookingType) {
    throw AppError.badRequest('Title and bookingType are required');
  }

  const booking = await prisma.trip_bookings.create({
    data: {
      tripId,
      activityId: activityId || null,
      bookingType,
      provider,
      providerBookingId,
      confirmationCode,
      bookingUrl,
      status: 'PENDING',
      title,
      description,
      checkInDate: checkInDate ? new Date(checkInDate) : null,
      checkOutDate: checkOutDate ? new Date(checkOutDate) : null,
      checkInTime,
      checkOutTime,
      totalCost,
      currency: currency || 'VND',
      paymentStatus: paymentStatus || 'UNPAID',
      guestsCount: guestsCount || 1,
      guestNames: guestNames || [],
      address,
      latitude,
      longitude,
      contactPhone,
      contactEmail,
      details: details || {},
      attachments: attachments || [],
      bookingDate: new Date(),
    },
  });

  return sendCreated(res, { booking }, 'Booking created successfully');
});

/**
 * PUT /api/bookings/:bookingId
 * Update booking
 */
export const updateBooking = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const updates = req.body;

  const booking = await prisma.trip_bookings.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw AppError.notFound('Booking not found');
  }

  await tripRepository.verifyTripOwnership(booking.tripId, req.user.id);

  // Prepare update data
  const updateData = {};
  const allowedFields = [
    'bookingType',
    'provider',
    'providerBookingId',
    'confirmationCode',
    'bookingUrl',
    'status',
    'title',
    'description',
    'checkInDate',
    'checkOutDate',
    'checkInTime',
    'checkOutTime',
    'totalCost',
    'currency',
    'paymentStatus',
    'guestsCount',
    'guestNames',
    'address',
    'latitude',
    'longitude',
    'contactPhone',
    'contactEmail',
    'details',
    'attachments',
  ];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      if (field === 'checkInDate' || field === 'checkOutDate') {
        updateData[field] = updates[field] ? new Date(updates[field]) : null;
      } else {
        updateData[field] = updates[field];
      }
    }
  }

  const updatedBooking = await prisma.trip_bookings.update({
    where: { id: bookingId },
    data: updateData,
  });

  return sendSuccess(res, { booking: updatedBooking }, 'Booking updated successfully');
});

/**
 * DELETE /api/bookings/:bookingId
 * Delete (soft delete) booking
 */
export const deleteBooking = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  const booking = await prisma.trip_bookings.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw AppError.notFound('Booking not found');
  }

  await tripRepository.verifyTripOwnership(booking.tripId, req.user.id);

  await prisma.trip_bookings.update({
    where: { id: bookingId },
    data: { deletedAt: new Date() },
  });

  return sendSuccess(res, null, 'Booking deleted successfully');
});

/**
 * PUT /api/bookings/:bookingId/status
 * Update booking status
 */
export const updateBookingStatus = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { status } = req.body;

  if (!['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'].includes(status)) {
    throw AppError.badRequest('Invalid status');
  }

  const booking = await prisma.trip_bookings.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw AppError.notFound('Booking not found');
  }

  await tripRepository.verifyTripOwnership(booking.tripId, req.user.id);

  const updatedBooking = await prisma.trip_bookings.update({
    where: { id: bookingId },
    data: { status },
  });

  return sendSuccess(res, { booking: updatedBooking }, `Booking status updated to ${status}`);
});

/**
 * PUT /api/bookings/:bookingId/payment-status
 * Update payment status
 */
export const updatePaymentStatus = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { paymentStatus } = req.body;

  if (!['UNPAID', 'PAID', 'PARTIALLY_PAID', 'REFUNDED'].includes(paymentStatus)) {
    throw AppError.badRequest('Invalid payment status');
  }

  const booking = await prisma.trip_bookings.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw AppError.notFound('Booking not found');
  }

  await tripRepository.verifyTripOwnership(booking.tripId, req.user.id);

  const updatedBooking = await prisma.trip_bookings.update({
    where: { id: bookingId },
    data: { paymentStatus },
  });

  // Notify trip members about payment status change
  tripRepository.getTripMembers(booking.tripId).then((members) => {
    const memberIds = members.map((m) => m.userId);
    if (memberIds.length > 0) {
      novuService.triggerBulk('payment-update', memberIds, {
        bookingTitle: updatedBooking.title || 'Booking',
        paymentStatus,
        amount: updatedBooking.totalCost,
        currency: updatedBooking.currency,
      }, req.user.id);
    }
  });

  return sendSuccess(res, { booking: updatedBooking }, `Payment status updated to ${paymentStatus}`);
});
