/**
 * Expense Routes
 * Defines routes for expense and split endpoints
 */

import { Router } from 'express';
import expenseController from './expenseController.js';
import { authenticate } from '../../../../shared/middleware/authenticate.js';

const router = Router();

router.use(authenticate);

// Trip-scoped expense routes
router.get(
  '/trips/:tripId/expenses',
  expenseController.listExpenses
);
router.get(
  '/trips/:tripId/expenses/summary',
  expenseController.getTripSummary
);
router.get(
  '/trips/:tripId/expenses/balances',
  expenseController.getBalances
);
router.post(
  '/trips/:tripId/expenses',
  expenseController.createExpense
);
router.post(
  '/trips/:tripId/expenses/settle',
  expenseController.settleAllBetween
);

// Individual expense routes
router.get('/expenses/:id', expenseController.getExpense);
router.patch('/expenses/:id', expenseController.updateExpense);
router.delete('/expenses/:id', expenseController.deleteExpense);

// Split settlement route
router.patch(
  '/splits/:splitId/settle',
  expenseController.settleSplit
);

export default router;
