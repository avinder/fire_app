from pydantic import BaseModel


class ExpensePoint(BaseModel):
    month: str
    amount: float


class MonthlyCreditDebitPoint(BaseModel):
    month: str
    credit: float
    debit: float


class MonthlyCategoryPoint(BaseModel):
    month: str
    rent: float
    income: float
    refund: float
    food: float
    travel: float


class MonthlyCategoryBreakdownPoint(BaseModel):
    month: str
    categories: dict[str, float]
