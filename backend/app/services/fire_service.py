def estimate_fire_number(annual_expense: float, withdrawal_rate: float = 0.04) -> float:
    if withdrawal_rate <= 0:
        raise ValueError("withdrawal_rate must be greater than zero")
    return round(annual_expense / withdrawal_rate, 2)
