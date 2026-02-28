from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.account_routes import router as account_router
from app.api.dashboard_routes import router as dashboard_router
from app.api.transaction_routes import router as transaction_router


app = FastAPI(title="Finance App API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard_router, prefix="/api")
app.include_router(account_router, prefix="/api")
app.include_router(transaction_router, prefix="/api")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
