# Exchange-rate backend

## Setup

From the repository root:

```powershell
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

Set the CurrencyBeacon credential in the backend process environment. The key is
used only as a Bearer token by the backend and is never returned by the API:

```powershell
$env:CURRENCYBEACON_API_KEY = "your-key"
```

Start the API from the repository root:

```powershell
backend\.venv\Scripts\python.exe -m uvicorn backend.app.exchange_rate.api:app --reload
```

Query a supported V1 currency:

```text
GET http://127.0.0.1:8000/api/exchange-rates/AUD
```

The response combines CurrencyBeacon mid-market reference data with BOC, ICBC,
CCB, ABC, and CMB retail bank quotes. The market reference is not a bank deal
price or a People's Bank of China official midpoint. CurrencyBeacon data uses a
lazy one-hour in-memory cache; it is fetched only on demand and the cache is lost
when the process restarts. There is currently no database.

Development CORS allows `http://localhost:5173`. Set `FRONTEND_ORIGIN` to one
explicit origin for another environment.
