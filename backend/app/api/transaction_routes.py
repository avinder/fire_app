from fastapi import APIRouter


router = APIRouter(tags=["transactions"])


@router.get("/transactions")
def list_transactions() -> dict[str, list]:
    return {"transactions": []}
