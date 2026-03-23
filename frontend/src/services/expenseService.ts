import api from '@/src/lib/api';

export type ExpenseCategory =
  | 'ACCOMMODATION'
  | 'FOOD'
  | 'TRANSPORT'
  | 'ACTIVITY'
  | 'SHOPPING'
  | 'OTHER';

export interface ExpenseUser {
  id: string;
  name: string;
  displayName?: string;
  avatarUrl: string | null;
}

export interface ExpenseSplit {
  id: string;
  userId: string;
  shareAmount: number;
  isSettled: boolean;
  settledAt: string | null;
  user: ExpenseUser;
}

export interface Expense {
  id: string;
  tripId: string;
  category: ExpenseCategory;
  description: string | null;
  amount: number;
  currency: string;
  date: string;
  receiptUrl: string | null;
  createdAt: string;
  paidBy: ExpenseUser;
  splits: ExpenseSplit[];
}

export interface ExpenseDetail extends Expense {
  createdById: string;
  paidById: string;
  baseAmount: number | null;
  baseCurrency: string | null;
  exchangeRate: number | null;
  updatedAt: string;
  createdBy: ExpenseUser;
}

export interface CategoryBreakdown {
  category: ExpenseCategory;
  amount: number;
  percentage: number;
}

export interface MemberBreakdown {
  userId: string;
  user: ExpenseUser;
  totalPaid: number;
  totalOwed: number;
  netBalance: number;
}

export interface ExpenseSummary {
  totalSpent: number;
  currency: string;
  expenseCount: number;
  categoryBreakdown: CategoryBreakdown[];
  memberBreakdown: MemberBreakdown[];
}

export interface Balance {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
  currency: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  pagination: Pagination;
}

export interface CreateExpenseInput {
  paidById?: string;
  category: ExpenseCategory;
  description?: string;
  amount: number;
  currency?: string;
  date: string;
  receiptUrl?: string;
  splits: Array<{ userId: string; shareAmount: number }>;
}

export interface UpdateExpenseInput {
  paidById?: string;
  category?: ExpenseCategory;
  description?: string;
  amount?: number;
  currency?: string;
  date?: string;
  receiptUrl?: string;
  splits?: Array<{ userId: string; shareAmount: number }>;
}

class ExpenseService {
  async listExpenses(
    tripId: string,
    params?: { page?: number; limit?: number; category?: ExpenseCategory }
  ): Promise<{ expenses: Expense[]; pagination: Pagination }> {
    const response = await api.get<PaginatedResponse<Expense>>(
      `/trips/${tripId}/expenses`,
      { params }
    );
    return {
      expenses: response.data.data,
      pagination: response.data.pagination,
    };
  }

  async getSummary(tripId: string): Promise<ExpenseSummary> {
    const response = await api.get<ApiResponse<{ summary: ExpenseSummary }>>(
      `/trips/${tripId}/expenses/summary`
    );
    return response.data.data.summary;
  }

  async getBalances(tripId: string): Promise<Balance[]> {
    const response = await api.get<ApiResponse<{ balances: Balance[] }>>(
      `/trips/${tripId}/expenses/balances`
    );
    return response.data.data.balances;
  }

  async createExpense(
    tripId: string,
    data: CreateExpenseInput
  ): Promise<ExpenseDetail> {
    const response = await api.post<ApiResponse<{ expense: ExpenseDetail }>>(
      `/trips/${tripId}/expenses`,
      data
    );
    return response.data.data.expense;
  }

  async updateExpense(
    expenseId: string,
    data: UpdateExpenseInput
  ): Promise<ExpenseDetail> {
    const response = await api.patch<ApiResponse<{ expense: ExpenseDetail }>>(
      `/expenses/${expenseId}`,
      data
    );
    return response.data.data.expense;
  }

  async deleteExpense(expenseId: string): Promise<void> {
    await api.delete(`/expenses/${expenseId}`);
  }

  async settleSplit(splitId: string): Promise<void> {
    await api.patch(`/splits/${splitId}/settle`);
  }

  async settleAllBetween(
    tripId: string,
    fromUserId: string,
    toUserId: string
  ): Promise<{ settledCount: number }> {
    const response = await api.post<
      ApiResponse<{ settledCount: number }>
    >(`/trips/${tripId}/expenses/settle`, {
      fromUserId,
      toUserId,
    });
    return response.data.data;
  }
}

export const expenseService = new ExpenseService();
export default expenseService;
