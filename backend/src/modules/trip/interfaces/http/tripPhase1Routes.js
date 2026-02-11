/**
 * Trip Phase 1 Routes
 * Routes for Phase 1 features
 */

import express from 'express';
import { authenticate } from '../../../../shared/middleware/authenticate.js';
import * as tripPhase1Controller from './tripPhase1Controller.js';
import * as bookingsController from './bookingsController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ═══════════════════════════════════════════════════════════════
// Trip Overview Routes
// ═══════════════════════════════════════════════════════════════
router.get('/:tripId/overview', tripPhase1Controller.getTripOverview);
router.put('/:tripId/overview', tripPhase1Controller.updateTripOverview);

// ═══════════════════════════════════════════════════════════════
// Transportation Routes
// ═══════════════════════════════════════════════════════════════
router.get('/:tripId/transportation', tripPhase1Controller.getTripTransportation);
router.post('/:tripId/recalculate-routes', tripPhase1Controller.recalculateRoutes);

// ═══════════════════════════════════════════════════════════════
// Budget Routes
// ═══════════════════════════════════════════════════════════════
router.get('/:tripId/budget-breakdown', tripPhase1Controller.getBudgetBreakdown);

// ═══════════════════════════════════════════════════════════════
// Travel Tips Routes
// ═══════════════════════════════════════════════════════════════
router.get('/:tripId/tips', tripPhase1Controller.getTravelTips);
router.put('/:tripId/tips', tripPhase1Controller.updateTravelTips);

// ═══════════════════════════════════════════════════════════════
// Bookings Routes
// ═══════════════════════════════════════════════════════════════
router.get('/:tripId/bookings', bookingsController.listBookings);
router.post('/:tripId/bookings', bookingsController.createBooking);
router.get('/bookings/:bookingId', bookingsController.getBooking);
router.put('/bookings/:bookingId', bookingsController.updateBooking);
router.delete('/bookings/:bookingId', bookingsController.deleteBooking);
router.put('/bookings/:bookingId/status', bookingsController.updateBookingStatus);
router.put('/bookings/:bookingId/payment-status', bookingsController.updatePaymentStatus);

export default router;
