# Finance App

This project parses ICICI bank statements and shows expense analytics in a web dashboard.

## Run with Docker

```bash
cd infra/docker
docker compose up --build
```

- Backend API: `http://localhost:8000`
- Expense endpoint: `http://localhost:8000/api/dashboard/expenses`
- Frontend dashboard: `http://localhost:8080`

## Run backend locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn app.main:app --app-dir backend --reload
```

## Notes

- Default statement file path:
  `data/raw/icici/OpTransactionHistory26-02-2026.xls`
- You can pass `statement_path` and `top_n` query params to
  `/api/dashboard/expenses`.
