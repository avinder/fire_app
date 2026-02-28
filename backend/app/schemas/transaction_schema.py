from pydantic import BaseModel


class ExpenseTransaction(BaseModel):
    date: str
    description: str
    amount: float
