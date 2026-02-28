from fastapi import APIRouter


router = APIRouter(tags=["accounts"])


@router.get("/accounts")
def list_accounts() -> dict[str, list]:
    return {"accounts": []}
