import os
from dataclasses import asdict
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.app.exchange_rate.clients import production_bank_clients
from backend.app.exchange_rate.currencybeacon import (
    CurrencyBeaconCache,
    CurrencyBeaconClient,
)
from backend.app.exchange_rate.service import ExchangeRateComparison, ExchangeRateService


DEFAULT_FRONTEND_ORIGIN = "http://localhost:5173"


class MarketReferenceResponse(BaseModel):
    currency_code: str
    rate: str | None
    source_code: str
    source_name: str
    source_url: str
    rate_type: str
    published_at: datetime | None
    retrieved_at: datetime
    status: str


class BankQuoteResponse(BaseModel):
    bank_code: str
    bank_name: str
    currency_code: str
    currency_name: str | None
    spot_buy: str | None
    spot_sell: str | None
    cash_buy: str | None
    cash_sell: str | None
    published_at: datetime | None
    status: str


class ExchangeRateComparisonResponse(BaseModel):
    currency_code: str
    market_reference: MarketReferenceResponse
    banks: list[BankQuoteResponse]


def create_app(service: ExchangeRateService | None = None) -> FastAPI:
    app = FastAPI(title="Personal Toolbox Exchange Rate API", version="1.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[os.environ.get("FRONTEND_ORIGIN", DEFAULT_FRONTEND_ORIGIN)],
        allow_credentials=False,
        allow_methods=["GET"],
        allow_headers=["*"],
    )
    app.state.exchange_rate_service = service or ExchangeRateService(
        production_bank_clients(),
        CurrencyBeaconCache(CurrencyBeaconClient()),
    )

    @app.get(
        "/api/exchange-rates/{currency_code}",
        response_model=ExchangeRateComparisonResponse,
    )
    def get_exchange_rates(currency_code: str, request: Request) -> dict[str, Any]:
        try:
            comparison = request.app.state.exchange_rate_service.get_comparison(
                currency_code
            )
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        return serialize_comparison(comparison)

    return app


def serialize_comparison(comparison: ExchangeRateComparison) -> dict[str, Any]:
    return _serialize(asdict(comparison))


def _serialize(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, dict):
        return {key: _serialize(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_serialize(item) for item in value]
    return value


app = create_app()
