from dataclasses import dataclass


@dataclass
class Holding:
    symbol: str
    quantity: float
    average_price: float
