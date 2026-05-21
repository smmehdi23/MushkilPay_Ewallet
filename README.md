# MushkilPay — Digital wallet (React + FastAPI + Oracle)

Full-stack demo: React (Vite) frontend, FastAPI backend, Oracle Database wallet schema.

**UI:** Branding and icons are served from `Frontend/public/ui-assets/` (synced from `MushkilPay UI (1)/UI Assets`). Re-copy that folder if you refresh designs.

## Prerequisites

- **Python** 3.10+
- **Node.js** 18+ and npm (or pnpm)
- **Oracle DB** with your course schema: `USERS`, `WALLETS`, `TRANSFERS`, `CARDS`, `ADMINS`, views `USER_TRANSFER_HISTORY`, `USER_WALLET_VIEW`, and related triggers

## Backend

```powershell
cd "c:\MY DATA\VS Code projects\E_WALLET-main"
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
# Edit .env with real Oracle credentials
python main.py
```

API default: **http://127.0.0.1:8000** (docs at `/docs`).

## Frontend

```powershell
cd Frontend
npm install
npm run dev
```

App: **http://127.0.0.1:5173**

Development uses an **empty** `VITE_API_BASE_URL` so requests go to Vite; `vite.config.ts` proxies `/user`, `/admin`, and `/transfer` to the backend.

**Temporary UI-only mode:** in `Frontend/.env.development`, `VITE_SKIP_LOGIN=true` skips the login screen and `/` goes straight to `/app`. API calls still need a real JWT in `localStorage` (log in once, then turn skip on) or they will fail. Set to `false` or remove before shipping.

### Production build

Set `VITE_API_BASE_URL` to your API origin (e.g. `https://api.example.com`), then:

```powershell
npm run build
```

Serve the `Frontend/dist` folder from any static host; ensure `CORS_ORIGINS` on the API includes that host.

## Features wired to the API

- User signup / login, JWT sessions, route guard on `/app`
- Home: balance, account number, transfers (lookup + receipt), admin cash/cheque top-up, quick services (transfer live; others “coming soon”), charity ribbon
- Cards: activate, replacement request (PKR 2000), withdrawal limit, change PIN
- Transactions: list, CSV export, PDF statement download
- Profile: edit, password, delete account
- Notifications bell (loads on mount + when opening panel)

## Security note

Do not commit real `.env` or production secrets. The repo ships `.env.example` only.
