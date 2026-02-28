import re

import pandas as pd


STANDARD_COLUMNS = [
    "date",
    "year",
    "month",
    "month_name",
    "day",
    "weekday",
    "description",
    "txn_type",
    "amount",
    "balance",
    "raw_text",
    "category_l1",
    "category_l2",
    "category_l3",
    "category_l4",
    "source_bank",
]


def clean_text(text: str) -> str:
    """Basic narration cleaning"""
    if pd.isna(text):
        return ""

    text = str(text)

    text = re.sub(r"\s+", " ", text)
    text = text.replace("/", " ")
    text = text.replace("-", " ")

    return text.strip()


def classify(row):
    text = str(row["raw_text"]).lower()
    txn_type = row["txn_type"]

    if txn_type == "credit":
        if "medicare" in text:
            return ("Income", "Refund", "Medical", "QRG")
        if "barclays" in text:
            return ("Income", "ESOP", "Buyback", "Buyback")
        if "zerodha broking" in text:
            return ("Transfer", "Equity", "Zerodha", "Zerodha")
        if "salary" in text:
            return ("Income", "Salary", "Monthly Salary", "Employer")
        if "flipkart" in text:
            return ("Income", "Salary", "Monthly Salary", "Flipkart")
        if "interest" in text:
            return ("Income", "Interest", "Bank Interest", "Savings Interest")
        if "rajasthan marud" in text:
            return ("Transfer", "Home", "Home", "Home")
        if "ratan" in text:
            return ("Transfer", "Home", "Father", "Home")
        if "rupinder" in text:
            return ("Transfer", "Home", "Mother", "Home")
        if "priya" in text:
            return ("Transfer", "Priya", "Priya", "Priya")
        if "the new india assu" in text:
            return ("Income", "Refund", "Medical", "Insurance")
        if "avinder" in text:
            if "state" in text:
                return ("Transfer", "Self", "SBI", "SBI")
            return ("Transfer", "Self", "Others", "Others")

        return ("Income", "Transfer", "Others", "Miscellaneous")

    if "dainikbhaskar4" in text:
        return ("Expense", "Miscellaneous", "News Paper", "DB")
    if "zerodhabroking" in text:
        return ("Investment", "Equity", "Zerodha", "Zerodha")
    if "zerodhamf" in text:
        return ("Investment", "Mutual Fund", "SIP", "Mutual Fund")
    if "appleservices" in text:
        return ("Expense", "Miscellaneous", "Subscription", "Apple")
    if "altbalaji.razor" in text:
        return ("Expense", "Miscellaneous", "Subscription", "Alt Balaji")
    if "blinkit" in text:
        return ("Expense", "Grocery", "blinkit", "blinkit")
    if "zomato" in text:
        return ("Expense", "Food", "zomato", "zomato")
    if "swiggy" in text:
        return ("Expense", "Food", "swiggy", "swiggy")
    if "pizza" in text:
        return ("Expense", "Food", "Others", "pizza")
    if "rajasthan marud" in text:
        return ("Transfer", "Home", "Home", "Home")
    if "ratan" in text:
        return ("Transfer", "Home", "Father", "Home")
    if "rupinder" in text:
        return ("Transfer", "Home", "Mother", "Home")
    if "priya" in text:
        return ("Transfer", "Priya", "Priya", "Priya")
    if "bbpsbp" in text:
        return ("Expense", "Utility", "Electricity", "Electricity")
    if "airtelpostpaidb" in text:
        return ("Expense", "Utility", "Internet", "Airtel")
    if "akshayakalpafar" in text:
        return ("Expense", "Grocery", "Milk", "Akshayakalpa")

    if "neft" in text or "imps" in text or "rtgs" in text:
        return ("Transfer", "Internal", "Bank Transfer", "NEFT/IMPS")
    if "card payment" in text:
        return ("Transfer", "Credit Card", "Card Payment", "Credit Card Bill")
    if "cred" in text:
        return ("Transfer", "Credit Card", "Card Payment", "Credit Card Bill")

    if "ppf" in text:
        return ("Investment", "Debt", "PPF", "PPF Contribution")
    if "sip" in text or "mutual" in text:
        return ("Investment", "Mutual Fund", "SIP", "Mutual Fund")

    if "qrg" in text:
        return ("Expense", "Medical", "Hospital", "QRG")
    if "trf to fd" in text:
        return ("Investment", "Debt", "FD", "FD")
    if "cc billpay/self" in text:
        return ("Transfer", "Credit Card", "Card Payment", "Credit Card Bill")
    if "groww" in text:
        return ("Investment", "Equity", "Groww", "Groww")
    if "cloudnine" in text:
        return ("Expense", "Medical", "Hospital", "Cloudnine")

    if "8750043112@ptye" in text:
        return ("Expense", "Rent", "Rent", "Rent")
    if "personal loan" in text:
        return ("Expense", "Loan", "Loan EMI", "Loan EMI")

    if "gst" in text or "charge" in text:
        return ("Expense", "Financial", "Bank Charges", "Charges")
    if "atm" in text:
        return ("Expense", "Operational", "Cash Withdrawal", "ATM")

    return ("Expense", "Miscellaneous", "Others", "Other")


def parse_icici_file(file_path: str) -> pd.DataFrame:
    """Clean ICICI statement into standard format"""

    df = pd.read_excel(file_path, engine="xlrd", header=12)
    df = df.dropna(how="all")
    df = df.dropna(how="all", axis=1)
    df.columns = [str(c).strip().lower() for c in df.columns]

    date_col = next((c for c in df.columns if "date" in c), None)
    narration_col = next((c for c in df.columns if "remark" in c or "narration" in c), None)
    debit_col = next((c for c in df.columns if "withdraw" in c or "debit" in c), None)
    credit_col = next((c for c in df.columns if "deposit" in c or "credit" in c), None)
    balance_col = next((c for c in df.columns if "balance" in c), None)

    if not date_col:
        raise ValueError("Date column not found")

    df[date_col] = df[date_col].astype(str).str.strip()
    df["date"] = pd.to_datetime(df[date_col], format="%d/%m/%Y", errors="coerce")

    df["year"] = df["date"].dt.year
    df["month"] = df["date"].dt.month
    df["day"] = df["date"].dt.day
    df["month_name"] = df["date"].dt.month_name()
    df["weekday"] = df["date"].dt.day_name()

    if narration_col:
        df["raw_text"] = df[narration_col].astype(str)
    else:
        df["raw_text"] = ""

    df["description"] = df["raw_text"].apply(clean_text)

    if debit_col:
        df[debit_col] = pd.to_numeric(df[debit_col], errors="coerce").fillna(0)
        debit_series = df[debit_col]
    else:
        debit_series = pd.Series([0] * len(df), index=df.index)

    if credit_col:
        df[credit_col] = pd.to_numeric(df[credit_col], errors="coerce").fillna(0)
        credit_series = df[credit_col]
    else:
        credit_series = pd.Series([0] * len(df), index=df.index)

    df["amount"] = credit_series - debit_series
    df["txn_type"] = df["amount"].apply(
        lambda x: "credit" if x > 0 else ("debit" if x < 0 else "neutral")
    )

    df[["category_l1", "category_l2", "category_l3", "category_l4"]] = df.apply(
        classify, axis=1, result_type="expand"
    )

    if balance_col:
        df["balance"] = pd.to_numeric(df[balance_col], errors="coerce")
    else:
        df["balance"] = None

    df["source_bank"] = "ICICI"
    df = df.dropna(subset=["date"])
    df = df[STANDARD_COLUMNS]

    return df
