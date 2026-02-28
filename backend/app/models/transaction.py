from dataclasses import dataclass
from datetime import date


@dataclass
class Transaction:
    txn_date: date
    description: str
    amount: float
    txn_type: str
