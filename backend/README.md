# Exchange-rate backend

`backend/` is an independent Python service root. The top-level FastAPI application
is `app.main:app`; exchange-rate routing and domain logic remain under
`app/exchange_rate/`.

## Setup and run

From `backend/`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:CURRENCYBEACON_API_KEY = "your-key"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Alternatively, from the repository root:

```powershell
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

Do not use `backend.app.exchange_rate.api:app`: `exchange_rate/api.py` exposes an
`APIRouter`, while `app/main.py` owns the ASGI application.

Query `GET http://127.0.0.1:8000/api/exchange-rates/AUD`.

Run the full backend suite from the same directory:

```powershell
.\.venv\Scripts\python.exe -m pytest tests -v
```

The response combines CurrencyBeacon mid-market reference data with BOC, ICBC,
CCB, ABC, and CMB retail bank quotes. The market reference is not a bank deal price
or a People's Bank of China official midpoint. CurrencyBeacon uses a lazy one-hour
in-memory cache, fetched only on demand and lost when the process restarts; there is
currently no database. Development CORS allows
`http://localhost:5173`; `FRONTEND_ORIGIN` may replace it with one explicit origin.
Deployed browser traffic normally remains same-origin through `/api/*` routing.
