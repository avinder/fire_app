from pydantic import BaseModel

from app.schemas.account_schema import (
    ExpensePoint,
    MonthlyCategoryBreakdownPoint,
    MonthlyCategoryPoint,
    MonthlyCreditDebitPoint,
)
from app.schemas.transaction_schema import ExpenseTransaction


class ExpenseSummaryResponse(BaseModel):
    total_expense: float
    total_income: float
    net_cashflow: float
    monthly_expenses: list[ExpensePoint]
    monthly_credit_debit: list[MonthlyCreditDebitPoint]
    monthly_category_lines: list[MonthlyCategoryPoint]
    monthly_credit_category_lines: list[MonthlyCategoryPoint]
    monthly_debit_category_lines: list[MonthlyCategoryPoint]
    monthly_credit_l1_breakdown: list[MonthlyCategoryBreakdownPoint]
    monthly_credit_l2_breakdown: list[MonthlyCategoryBreakdownPoint]
    monthly_debit_l1_breakdown: list[MonthlyCategoryBreakdownPoint]
    monthly_debit_l2_breakdown: list[MonthlyCategoryBreakdownPoint]
    top_expenses: list[ExpenseTransaction]
