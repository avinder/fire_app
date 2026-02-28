import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from app.core.config import DEFAULT_STATEMENT_PATH, PROJECT_ROOT
from app.schemas.holding_schema import ExpenseSummaryResponse
from app.services.analytics_service import build_expense_summary

sys.path.append(str(PROJECT_ROOT))
from data_pipeline.parsers.icici_parser import parse_icici_file  # noqa: E402


router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/expenses", response_model=ExpenseSummaryResponse)
def get_expense_summary(
    statement_path: str | None = Query(
        default=None,
        description="Optional absolute or project-relative path to an ICICI .xls statement.",
    ),
    top_n: int = Query(default=10, ge=1, le=50),
):
    candidate_path = Path(statement_path) if statement_path else DEFAULT_STATEMENT_PATH
    if not candidate_path.is_absolute():
        candidate_path = PROJECT_ROOT / candidate_path

    if not candidate_path.exists():
        raise HTTPException(status_code=404, detail=f"Statement not found: {candidate_path}")

    try:
        df = parse_icici_file(str(candidate_path))
        return build_expense_summary(df=df, top_n=top_n)
    except Exception as exc:  # pragma: no cover - runtime guard
        raise HTTPException(status_code=500, detail=f"Failed to parse statement: {exc}") from exc
