/**
 * Expense Repository
 * Database operations for expenses and expense splits
 */

import prisma from '../../../../config/database.js';
import { AppError } from '../../../../shared/errors/AppError.js';

const USER_SELECT = {
  id: true,
  name: true,
  displayName: true,
  avatarUrl: true,
};

class ExpenseRepository {
  async findByTripId(tripId, { page = 1, limit = 20, category } = {}) {
    const skip = (page - 1) * limit;

    const where = { tripId };
    if (category) {
      where.category = category;
    }

    const [expenses, total] = await Promise.all([
      prisma.expenses.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          users_expenses_paidByIdTousers: {
            select: USER_SELECT,
          },
          expense_splits: {
            include: {
              User: { select: USER_SELECT },
            },
          },
        },
      }),
      prisma.expenses.count({ where }),
    ]);

    return {
      expenses: expenses.map(formatExpense),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id) {
    const expense = await prisma.expenses.findUnique({
      where: { id },
      include: {
        users_expenses_paidByIdTousers: {
          select: USER_SELECT,
        },
        users_expenses_createdByIdTousers: {
          select: USER_SELECT,
        },
        expense_splits: {
          include: {
            User: { select: USER_SELECT },
          },
        },
      },
    });

    if (!expense) {
      return null;
    }

    return formatExpenseDetail(expense);
  }

  async create({
    tripId,
    createdById,
    paidById,
    category,
    description,
    amount,
    currency,
    date,
    receiptUrl,
    splits,
  }) {
    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.expenses.create({
        data: {
          tripId,
          createdById,
          paidById,
          category,
          description: description || null,
          amount,
          currency: currency || 'USD',
          date: new Date(date),
          receiptUrl: receiptUrl || null,
        },
      });

      if (splits && splits.length > 0) {
        await tx.expense_splits.createMany({
          data: splits.map((s) => ({
            expenseId: created.id,
            userId: s.userId,
            shareAmount: s.shareAmount,
          })),
        });
      }

      return tx.expenses.findUnique({
        where: { id: created.id },
        include: {
          users_expenses_paidByIdTousers: {
            select: USER_SELECT,
          },
          users_expenses_createdByIdTousers: {
            select: USER_SELECT,
          },
          expense_splits: {
            include: {
              User: { select: USER_SELECT },
            },
          },
        },
      });
    });

    return formatExpenseDetail(expense);
  }

  async update(id, userId, data) {
    const existing = await prisma.expenses.findUnique({
      where: { id },
      select: { createdById: true },
    });

    if (!existing) {
      throw AppError.notFound('Expense not found');
    }

    if (existing.createdById !== userId) {
      throw AppError.forbidden(
        'Only the creator can update this expense'
      );
    }

    const updateData = {};
    if (data.paidById !== undefined) updateData.paidById = data.paidById;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.date !== undefined) updateData.date = new Date(data.date);
    if (data.receiptUrl !== undefined) {
      updateData.receiptUrl = data.receiptUrl;
    }

    const expense = await prisma.$transaction(async (tx) => {
      await tx.expenses.update({
        where: { id },
        data: updateData,
      });

      if (data.splits) {
        await tx.expense_splits.deleteMany({
          where: { expenseId: id },
        });

        if (data.splits.length > 0) {
          await tx.expense_splits.createMany({
            data: data.splits.map((s) => ({
              expenseId: id,
              userId: s.userId,
              shareAmount: s.shareAmount,
            })),
          });
        }
      }

      return tx.expenses.findUnique({
        where: { id },
        include: {
          users_expenses_paidByIdTousers: {
            select: USER_SELECT,
          },
          users_expenses_createdByIdTousers: {
            select: USER_SELECT,
          },
          expense_splits: {
            include: {
              User: { select: USER_SELECT },
            },
          },
        },
      });
    });

    return formatExpenseDetail(expense);
  }

  async delete(id, userId) {
    const existing = await prisma.expenses.findUnique({
      where: { id },
      select: { createdById: true },
    });

    if (!existing) {
      throw AppError.notFound('Expense not found');
    }

    if (existing.createdById !== userId) {
      throw AppError.forbidden(
        'Only the creator can delete this expense'
      );
    }

    await prisma.expenses.delete({ where: { id } });
  }

  async getTripSummary(tripId) {
    const expenses = await prisma.expenses.findMany({
      where: { tripId },
      include: {
        users_expenses_paidByIdTousers: {
          select: USER_SELECT,
        },
        expense_splits: {
          include: {
            User: { select: USER_SELECT },
          },
        },
      },
    });

    let totalSpent = 0;
    const byCategory = {};
    const memberPaid = {};
    const memberOwes = {};

    for (const expense of expenses) {
      const amount = Number(expense.amount);
      totalSpent += amount;

      const cat = expense.category;
      byCategory[cat] = (byCategory[cat] || 0) + amount;

      const payerId = expense.paidById;
      if (!memberPaid[payerId]) {
        memberPaid[payerId] = {
          userId: payerId,
          user: expense.users_expenses_paidByIdTousers,
          totalPaid: 0,
        };
      }
      memberPaid[payerId].totalPaid += amount;

      for (const split of expense.expense_splits) {
        const splitUserId = split.userId;
        const shareAmount = Number(split.shareAmount);
        if (!memberOwes[splitUserId]) {
          memberOwes[splitUserId] = {
            userId: splitUserId,
            user: split.User,
            totalOwed: 0,
          };
        }
        memberOwes[splitUserId].totalOwed += shareAmount;
      }
    }

    const categoryBreakdown = Object.entries(byCategory).map(
      ([category, amount]) => ({
        category,
        amount: round2(amount),
        percentage: totalSpent > 0
          ? round2((amount / totalSpent) * 100)
          : 0,
      })
    );

    const memberBreakdown = buildMemberBreakdown(
      memberPaid,
      memberOwes
    );

    return {
      totalSpent: round2(totalSpent),
      currency: expenses[0]?.currency || 'USD',
      expenseCount: expenses.length,
      categoryBreakdown,
      memberBreakdown,
    };
  }

  async getBalances(tripId) {
    const expenses = await prisma.expenses.findMany({
      where: { tripId },
      include: {
        users_expenses_paidByIdTousers: {
          select: USER_SELECT,
        },
        expense_splits: {
          where: { isSettled: false },
          include: {
            User: { select: USER_SELECT },
          },
        },
      },
    });

    const netBalances = {};
    const userMap = {};

    for (const expense of expenses) {
      const payerId = expense.paidById;
      userMap[payerId] =
        expense.users_expenses_paidByIdTousers;

      for (const split of expense.expense_splits) {
        const debtorId = split.userId;
        userMap[debtorId] = split.User;

        if (debtorId === payerId) continue;

        const key = pairKey(debtorId, payerId);
        if (!netBalances[key]) {
          netBalances[key] = { from: debtorId, to: payerId, net: 0 };
        }

        const shareAmount = Number(split.shareAmount);
        if (netBalances[key].from === debtorId) {
          netBalances[key].net += shareAmount;
        } else {
          netBalances[key].net -= shareAmount;
        }
      }
    }

    const currency = expenses[0]?.currency || 'USD';
    const balances = [];

    for (const entry of Object.values(netBalances)) {
      const amount = round2(Math.abs(entry.net));
      if (amount <= 0) continue;

      const fromId = entry.net > 0 ? entry.from : entry.to;
      const toId = entry.net > 0 ? entry.to : entry.from;

      balances.push({
        fromUserId: fromId,
        fromUserName: userName(userMap[fromId]),
        toUserId: toId,
        toUserName: userName(userMap[toId]),
        amount,
        currency,
      });
    }

    return balances;
  }

  async settleSplit(splitId, userId) {
    const split = await prisma.expense_splits.findUnique({
      where: { id: splitId },
    });

    if (!split) {
      throw AppError.notFound('Split not found');
    }

    if (split.userId !== userId) {
      throw AppError.forbidden(
        'You can only settle your own splits'
      );
    }

    if (split.isSettled) {
      throw AppError.badRequest('This split is already settled');
    }

    const updated = await prisma.expense_splits.update({
      where: { id: splitId },
      data: {
        isSettled: true,
        settledAt: new Date(),
      },
      include: {
        User: { select: USER_SELECT },
        expenses: {
          select: {
            id: true,
            description: true,
            amount: true,
            currency: true,
          },
        },
      },
    });

    return updated;
  }

  async settleAllBetween(tripId, fromUserId, toUserId) {
    const expenseIds = await prisma.expenses.findMany({
      where: { tripId, paidById: toUserId },
      select: { id: true },
    });

    const ids = expenseIds.map((e) => e.id);

    if (ids.length === 0) {
      return { settledCount: 0 };
    }

    const result = await prisma.expense_splits.updateMany({
      where: {
        expenseId: { in: ids },
        userId: fromUserId,
        isSettled: false,
      },
      data: {
        isSettled: true,
        settledAt: new Date(),
      },
    });

    return { settledCount: result.count };
  }
}

function pairKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function userName(user) {
  if (!user) return 'Unknown';
  return user.displayName || user.name || 'Unknown';
}

function formatExpense(expense) {
  return {
    id: expense.id,
    tripId: expense.tripId,
    category: expense.category,
    description: expense.description,
    amount: Number(expense.amount),
    currency: expense.currency,
    date: expense.date,
    receiptUrl: expense.receiptUrl,
    createdAt: expense.createdAt,
    paidBy: expense.users_expenses_paidByIdTousers,
    splits: expense.expense_splits.map(formatSplit),
  };
}

function formatExpenseDetail(expense) {
  return {
    id: expense.id,
    tripId: expense.tripId,
    createdById: expense.createdById,
    paidById: expense.paidById,
    category: expense.category,
    description: expense.description,
    amount: Number(expense.amount),
    currency: expense.currency,
    baseAmount: expense.baseAmount
      ? Number(expense.baseAmount)
      : null,
    baseCurrency: expense.baseCurrency,
    exchangeRate: expense.exchangeRate,
    receiptUrl: expense.receiptUrl,
    date: expense.date,
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
    paidBy: expense.users_expenses_paidByIdTousers,
    createdBy: expense.users_expenses_createdByIdTousers,
    splits: expense.expense_splits.map(formatSplit),
  };
}

function formatSplit(split) {
  return {
    id: split.id,
    userId: split.userId,
    shareAmount: Number(split.shareAmount),
    isSettled: split.isSettled,
    settledAt: split.settledAt,
    user: split.User,
  };
}

function buildMemberBreakdown(memberPaid, memberOwes) {
  const allUserIds = new Set([
    ...Object.keys(memberPaid),
    ...Object.keys(memberOwes),
  ]);

  const breakdown = [];
  for (const userId of allUserIds) {
    const paid = memberPaid[userId];
    const owed = memberOwes[userId];
    breakdown.push({
      userId,
      user: paid?.user || owed?.user,
      totalPaid: round2(paid?.totalPaid || 0),
      totalOwed: round2(owed?.totalOwed || 0),
      netBalance: round2(
        (paid?.totalPaid || 0) - (owed?.totalOwed || 0)
      ),
    });
  }

  return breakdown;
}

export default new ExpenseRepository();
