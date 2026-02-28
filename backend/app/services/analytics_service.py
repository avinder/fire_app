import pandas as pd


CATEGORY_ORDER = ["rent", "income", "refund", "food", "travel"]


def categorize_transaction(raw_text: str, amount: float) -> str | None:
    text = (raw_text or "").lower()

    refund_keywords = ["refund", "reversal", "cashback", "chargeback", "returned"]
    income_keywords = ["salary", "interest", "dividend", "bonus", "payout", "income"]
    rent_keywords = ["rent", "lease", "landlord", "house rent"]
    food_keywords = [
        "swiggy",
        "zomato",
        "restaurant",
        "cafe",
        "food",
        "dine",
        "blinkit",
        "instamart",
        "grocery",
        "bigbasket",
    ]
    travel_keywords = [
        "uber",
        "ola",
        "irctc",
        "flight",
        "metro",
        "taxi",
        "bus",
        "train",
        "makemytrip",
        "goibibo",
    ]

    if amount > 0:
        if any(k in text for k in refund_keywords):
            return "refund"
        return "income"

    if amount < 0:
        if any(k in text for k in rent_keywords):
            return "rent"
        if any(k in text for k in food_keywords):
            return "food"
        if any(k in text for k in travel_keywords):
            return "travel"
        if any(k in text for k in income_keywords):
            return "income"
        if any(k in text for k in refund_keywords):
            return "refund"

    return None


def build_expense_summary(df: pd.DataFrame, top_n: int = 10) -> dict:
    if df.empty:
        return {
            "total_expense": 0.0,
            "total_income": 0.0,
            "net_cashflow": 0.0,
            "monthly_expenses": [],
            "monthly_credit_debit": [],
            "monthly_category_lines": [],
            "monthly_credit_category_lines": [],
            "monthly_debit_category_lines": [],
            "monthly_credit_l1_breakdown": [],
            "monthly_credit_l2_breakdown": [],
            "monthly_debit_l1_breakdown": [],
            "monthly_debit_l2_breakdown": [],
            "top_expenses": [],
        }

    debit_df = df[df["amount"] < 0].copy()
    credit_df = df[df["amount"] > 0].copy()

    if "category_l1" in df.columns:
        income_df = df[df["category_l1"].astype(str).str.lower() == "income"]
        expense_df = df[df["category_l1"].astype(str).str.lower() == "expense"]
        total_income = float(income_df[income_df["amount"] > 0]["amount"].sum())
        total_expense = float(expense_df[expense_df["amount"] < 0]["amount"].abs().sum())
        net_cashflow = float(total_income - total_expense)
    else:
        total_expense = float(abs(debit_df["amount"].sum()))
        total_income = float(credit_df["amount"].sum())
        net_cashflow = float(df["amount"].sum())

    monthly = (
        debit_df.assign(month=debit_df["date"].dt.to_period("M").astype(str))
        .groupby("month", as_index=False)["amount"]
        .sum()
    )
    monthly["amount"] = monthly["amount"].abs().round(2)

    monthly_credit = (
        credit_df.assign(month=credit_df["date"].dt.to_period("M").astype(str))
        .groupby("month", as_index=False)["amount"]
        .sum()
        .rename(columns={"amount": "credit"})
    )
    monthly_debit = (
        debit_df.assign(month=debit_df["date"].dt.to_period("M").astype(str))
        .groupby("month", as_index=False)["amount"]
        .sum()
        .assign(amount=lambda x: x["amount"].abs())
        .rename(columns={"amount": "debit"})
    )
    monthly_cd = monthly_credit.merge(monthly_debit, on="month", how="outer").fillna(0.0)
    monthly_cd = monthly_cd.sort_values("month")

    top = debit_df.assign(abs_amount=debit_df["amount"].abs()).nlargest(top_n, "abs_amount")

    top_records = [
        {
            "date": row["date"].strftime("%Y-%m-%d"),
            "description": row["description"],
            "amount": round(float(row["abs_amount"]), 2),
        }
        for _, row in top.iterrows()
    ]

    monthly_records = [
        {"month": row["month"], "amount": round(float(row["amount"]), 2)}
        for _, row in monthly.iterrows()
    ]
    monthly_credit_debit_records = [
        {
            "month": row["month"],
            "credit": round(float(row["credit"]), 2),
            "debit": round(float(row["debit"]), 2),
        }
        for _, row in monthly_cd.iterrows()
    ]

    categorized = df.copy()
    categorized["month"] = categorized["date"].dt.to_period("M").astype(str)
    categorized["category"] = categorized.apply(
        lambda row: categorize_transaction(
            raw_text=str(row.get("raw_text") or row.get("description") or ""),
            amount=float(row["amount"]),
        ),
        axis=1,
    )
    categorized = categorized[categorized["category"].isin(CATEGORY_ORDER)]
    categorized["value"] = categorized["amount"].abs()

    def build_category_records(frame: pd.DataFrame) -> list[dict]:
        if frame.empty:
            return []
        monthly_category = (
            frame.pivot_table(
                index="month",
                columns="category",
                values="value",
                aggfunc="sum",
                fill_value=0.0,
            )
            .reset_index()
            .sort_values("month")
        )
        for category in CATEGORY_ORDER:
            if category not in monthly_category.columns:
                monthly_category[category] = 0.0
        return [
            {
                "month": row["month"],
                "rent": round(float(row["rent"]), 2),
                "income": round(float(row["income"]), 2),
                "refund": round(float(row["refund"]), 2),
                "food": round(float(row["food"]), 2),
                "travel": round(float(row["travel"]), 2),
            }
            for _, row in monthly_category.iterrows()
        ]

    monthly_category_records = build_category_records(categorized)
    monthly_credit_category_records = build_category_records(categorized[categorized["amount"] > 0])
    monthly_debit_category_records = build_category_records(categorized[categorized["amount"] < 0])

    def build_dynamic_breakdown(frame: pd.DataFrame, category_col: str) -> list[dict]:
        if frame.empty or category_col not in frame.columns:
            return []
        work = frame.copy()
        work[category_col] = work[category_col].fillna("Unknown").astype(str)
        work = work[work[category_col].str.strip() != ""]
        if work.empty:
            return []

        monthly = (
            work.assign(value=work["amount"].abs())
            .pivot_table(
                index="month",
                columns=category_col,
                values="value",
                aggfunc="sum",
                fill_value=0.0,
            )
            .reset_index()
            .sort_values("month")
        )
        categories = [c for c in monthly.columns if c != "month"]
        return [
            {
                "month": row["month"],
                "categories": {category: round(float(row[category]), 2) for category in categories},
            }
            for _, row in monthly.iterrows()
        ]

    credit_categorized = categorized[categorized["amount"] > 0]
    debit_categorized = categorized[categorized["amount"] < 0]

    monthly_credit_l1_breakdown = build_dynamic_breakdown(credit_categorized, "category_l1")
    monthly_credit_l2_breakdown = build_dynamic_breakdown(credit_categorized, "category_l2")
    monthly_debit_l1_breakdown = build_dynamic_breakdown(debit_categorized, "category_l1")
    monthly_debit_l2_breakdown = build_dynamic_breakdown(debit_categorized, "category_l2")

    return {
        "total_expense": round(total_expense, 2),
        "total_income": round(total_income, 2),
        "net_cashflow": round(net_cashflow, 2),
        "monthly_expenses": monthly_records,
        "monthly_credit_debit": monthly_credit_debit_records,
        "monthly_category_lines": monthly_category_records,
        "monthly_credit_category_lines": monthly_credit_category_records,
        "monthly_debit_category_lines": monthly_debit_category_records,
        "monthly_credit_l1_breakdown": monthly_credit_l1_breakdown,
        "monthly_credit_l2_breakdown": monthly_credit_l2_breakdown,
        "monthly_debit_l1_breakdown": monthly_debit_l1_breakdown,
        "monthly_debit_l2_breakdown": monthly_debit_l2_breakdown,
        "top_expenses": top_records,
    }
