/**
 * Expense Controller
 * Handles HTTP requests for expense and split endpoints
 */

import {
  sendSuccess,
  sendCreated,
  sendNoContent,
  sendPaginated,
} from '../../../../shared/utils/response.js';
import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import expenseRepository from '../../infrastructure/repositories/ExpenseRepository.js';

const VALID_CATEGORIES = [
  'ACCOMMODATION',
  'FOOD',
  'TRANSPORT',
  'ACTIVITY',
  'SHOPPING',
  'OTHER',
];

/**
 * @route GET /api/trips/:tripId/expenses
 * @desc List expenses for a trip (paginated, filterable by category)
 * @access Private
 */
export const listExpenses = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const { page = 1, limit = 20, category } = req.query;

  if (category && !VALID_CATEGORIES.includes(category)) {
    throw AppError.badRequest(
      `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`
    );
  }

  const result = await expenseRepository.findByTripId(tripId, {
    page: parseInt(page),
    limit: parseInt(limit),
    category,
  });

  return sendPaginated(
    res,
    result.expenses,
    result.pagination
  );
});

/**
 * @route GET /api/trips/:tripId/expenses/summary
 * @desc Get trip expense summary
 * @access Private
 */
export const getTripSummary = asyncHandler(async (req, res) => {
  const { tripId } = req.params;

  const summary = await expenseRepository.getTripSummary(tripId);

  return sendSuccess(res, { summary });
});

/**
 * @route GET /api/trips/:tripId/expenses/balances
 * @desc Get who-owes-whom balances for a trip
 * @access Private
 */
export const getBalances = asyncHandler(async (req, res) => {
  const { tripId } = req.params;

  const balances = await expenseRepository.getBalances(tripId);

  return sendSuccess(res, { balances });
});

/**
 * @route GET /api/expenses/:id
 * @desc Get single expense detail
 * @access Private
 */
export const getExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const expense = await expenseRepository.findById(id);

  if (!expense) {
    throw AppError.notFound('Expense not found');
  }

  return sendSuccess(res, { expense });
});

/**
 * @route POST /api/trips/:tripId/expenses
 * @desc Add expense with splits
 * @access Private
 */
export const createExpense = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const {
    paidById,
    category,
    description,
    amount,
    currency,
    date,
    receiptUrl,
    splits,
  } = req.body;

  if (!category || !VALID_CATEGORIES.includes(category)) {
    throw AppError.badRequest(
      `Category is required and must be one of: ${VALID_CATEGORIES.join(', ')}`
    );
  }

  if (amount === undefined || amount === null || Number(amount) <= 0) {
    throw AppError.badRequest('Amount must be a positive number');
  }

  if (!date) {
    throw AppError.badRequest('Date is required');
  }

  if (splits && splits.length > 0) {
    const splitsTotal = splits.reduce(
      (sum, s) => sum + Number(s.shareAmount),
      0
    );
    const diff = Math.abs(splitsTotal - Number(amount));
    if (diff > 0.01) {
      throw AppError.badRequest(
        `Splits total (${splitsTotal}) does not match expense amount (${amount})`
      );
    }
  }

  const expense = await expenseRepository.create({
    tripId,
    createdById: req.user.id,
    paidById: paidById || req.user.id,
    category,
    description,
    amount,
    currency,
    date,
    receiptUrl,
    splits: splits || [],
  });

  return sendCreated(res, { expense }, 'Expense created successfully');
});

/**
 * @route PATCH /api/expenses/:id
 * @desc Update expense
 * @access Private (creator only)
 */
export const updateExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    paidById,
    category,
    description,
    amount,
    currency,
    date,
    receiptUrl,
    splits,
  } = req.body;

  if (category && !VALID_CATEGORIES.includes(category)) {
    throw AppError.badRequest(
      `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`
    );
  }

  if (amount !== undefined && Number(amount) <= 0) {
    throw AppError.badRequest('Amount must be a positive number');
  }

  if (splits && splits.length > 0 && amount !== undefined) {
    const splitsTotal = splits.reduce(
      (sum, s) => sum + Number(s.shareAmount),
      0
    );
    const diff = Math.abs(splitsTotal - Number(amount));
    if (diff > 0.01) {
      throw AppError.badRequest(
        `Splits total (${splitsTotal}) does not match expense amount (${amount})`
      );
    }
  }

  const expense = await expenseRepository.update(
    id,
    req.user.id,
    {
      paidById,
      category,
      description,
      amount,
      currency,
      date,
      receiptUrl,
      splits,
    }
  );

  return sendSuccess(res, { expense }, 'Expense updated successfully');
});

/**
 * @route DELETE /api/expenses/:id
 * @desc Delete expense
 * @access Private (creator only)
 */
export const deleteExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;

  await expenseRepository.delete(id, req.user.id);

  return sendNoContent(res);
});

/**
 * @route PATCH /api/splits/:splitId/settle
 * @desc Mark a split as settled
 * @access Private (split owner only)
 */
export const settleSplit = asyncHandler(async (req, res) => {
  const { splitId } = req.params;

  const split = await expenseRepository.settleSplit(
    splitId,
    req.user.id
  );

  return sendSuccess(res, { split }, 'Split settled successfully');
});

/**
 * @route POST /api/trips/:tripId/expenses/settle
 * @desc Settle all splits between two users for a trip
 * @access Private
 */
export const settleAllBetween = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const { fromUserId, toUserId } = req.body;

  if (!fromUserId || !toUserId) {
    throw AppError.badRequest(
      'fromUserId and toUserId are required'
    );
  }

  if (fromUserId === toUserId) {
    throw AppError.badRequest(
      'fromUserId and toUserId must be different'
    );
  }

  const result = await expenseRepository.settleAllBetween(
    tripId,
    fromUserId,
    toUserId
  );

  return sendSuccess(
    res,
    result,
    `Settled ${result.settledCount} splits`
  );
});

export default {
  listExpenses,
  getTripSummary,
  getBalances,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  settleSplit,
  settleAllBetween,
};
