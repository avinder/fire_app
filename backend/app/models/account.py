from dataclasses import dataclass


@dataclass
class Account:
    id: str
    bank_name: str
    account_masked: str
