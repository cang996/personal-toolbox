# personal-toolbox

A small monorepo of browser tools with a Vue/Vite frontend and a Python/FastAPI
backend.

```text
personal-toolbox/
├── frontend/   # Vue 3, TypeScript, Vite, Vue Router
├── backend/    # FastAPI exchange-rate service
├── docs/       # Feature architecture and agent workflows
└── vercel.json # Vercel Services and public routing
```

## Local development

Create the backend environment and start the API:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

In another terminal, start the frontend:

```powershell
cd frontend
npm install
npm run dev
```

The frontend calls `/api/*` on its own origin. Vite proxies that path to the local
FastAPI process; Vercel routes it to the backend service in deployed environments.

Run backend checks from `backend/` with `python -m pytest tests -v`. Run frontend
checks from `frontend/` with `npm test`, `npm run lint`, `npm run type-check`, and
`npm run build`.
