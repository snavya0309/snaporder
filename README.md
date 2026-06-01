# SnapOrder

> Snap a dish photo → identify it with AI → see calories → order on Swiggy

## What's built

| Screen | Status | Notes |
|---|---|---|
| ScanScreen | ✅ | Camera + file upload, image preview, mock scan button |
| ResultsScreen | ✅ | Dish hero, nutrition band, restaurant matches, veg/non-veg filter, address selector, cart bar |
| CheckoutScreen | ✅ | Address, items, coupon input, bill breakdown, COD order |
| TrackingScreen | ✅ | Live polling, animated progress bar, timeline, report issue |
| HistoryScreen | ✅ | Daily calorie log with macros, accessible from header |

| Feature | Status | Notes |
|---|---|---|
| Claude Vision | ✅ (mock) | Real call wired; mock returns random dish if no API key |
| Nutrition lookup | ✅ | 14-dish DB with fuzzy match |
| Swiggy search | ✅ (mock) | 8 cuisine profiles: biryani, pizza, burger, dosa, noodles, pasta, curry, salad |
| Cart & checkout | ✅ (mock) | Full cart flow with totals, delivery fee, taxes |
| Coupons | ✅ (mock) | SNAP50, BIRYANI75, PIZZA50, FREEDEL, UPI100 — category-aware |
| Order tracking | ✅ (mock) | Status advances automatically based on elapsed time |
| Calorie tracker | ✅ | localStorage, resets daily, tracks macros |
| Text search fallback | ✅ | If scan fails, user can type dish name |
| Swiggy MCP (real) | ⏳ | Stubs in place, waiting for API access |
| Claude Vision (real) | ⏳ | Needs `ANTHROPIC_API_KEY` in backend `.env` |

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite 4 |
| Styling | Custom CSS (Syne font, dark theme, #FC5622) |
| AI Vision | Claude claude-sonnet-4-20250514 (multimodal) |
| Ordering | Swiggy Food MCP (mocked) |
| Backend | Node.js + Express (ESM) |
| Deploy | Vercel — single project, frontend + backend together |

## Repo structure

```
snaporder/
├── vercel.json                   # Single-project deploy config
├── frontend/
│   └── src/
│       ├── screens/
│       │   ├── ScanScreen.jsx
│       │   ├── ResultsScreen.jsx
│       │   ├── CheckoutScreen.jsx
│       │   ├── TrackingScreen.jsx
│       │   └── HistoryScreen.jsx
│       ├── components/
│       │   └── CalorieTracker.jsx
│       ├── hooks/
│       │   └── useCalorieTracker.js
│       ├── utils/
│       │   └── api.js
│       ├── App.jsx
│       └── styles.css
├── backend/
│   ├── routes/
│   │   ├── identify.js           # POST /api/identify (image or dish name)
│   │   ├── search.js             # POST /api/search
│   │   ├── cart.js               # GET/POST/DELETE /api/cart
│   │   ├── coupons.js            # GET /api/coupons, POST /api/coupons/apply
│   │   ├── order.js              # POST /api/order
│   │   ├── track.js              # GET /api/track/:orderId
│   │   ├── addresses.js          # GET /api/addresses
│   │   └── support.js            # POST /api/support/report
│   └── services/
│       ├── claude.js             # Claude Vision + mock fallback
│       ├── swiggy.js             # All Swiggy logic (mock)
│       └── nutrition.js          # Nutrition DB
└── shared/
    └── api.types.js              # JSDoc API contract
```

## Running locally

```bash
git clone https://github.com/snavya0309/snaporder.git
cd snaporder

# Backend (terminal 1)
cd backend
npm install
cp .env.example .env          # add ANTHROPIC_API_KEY if you have one
npm run dev                   # → http://localhost:3001

# Frontend (terminal 2)
cd frontend
npm install
npm run dev                   # → http://localhost:3000
```

The app works fully without any API keys — everything falls back to deterministic mocks.

## Environment variables

**`backend/.env`**
```
ANTHROPIC_API_KEY=           # optional — mock used if blank
SWIGGY_CLIENT_ID=            # pending MCP access
SWIGGY_CLIENT_SECRET=        # pending MCP access
PORT=3001
```

**`frontend/.env`** — not required locally (Vite proxies `/api` to port 3001 automatically)

## API reference

### `POST /api/identify`
Accepts an image or a dish name (text fallback).
```json
{ "image": "<base64 jpeg>" }
// or
{ "dish": "Masala Dosa" }
```
Returns `{ dish, cuisine, confidence, calories, macros, matches[] }`.

### `POST /api/search`
```json
{ "dish": "Burger", "addressId": "addr-home" }
```

### `POST /api/cart`
```json
{ "restaurantId": "beh-001", "addressId": "addr-home", "items": [{ "itemId": "item-biryani-001", "quantity": 2 }] }
```

### `POST /api/coupons/apply`
```json
{ "code": "SNAP50" }
```
Category-aware — BIRYANI75 only works on biryani carts, PIZZA50 on pizza.

### `POST /api/order`
```json
{ "paymentMethod": "COD", "restaurantId": "...", "items": [...] }
```

### `GET /api/track/:orderId`
Status advances: `confirmed → preparing → out_for_delivery → delivered` based on real elapsed time.

## Deployment

Single Vercel project from repo root. `vercel.json` routes `/api/*` to the Express backend and everything else to the Vite-built frontend.

```
vercel deploy
```

Set `ANTHROPIC_API_KEY` in Vercel environment variables when real Claude Vision is needed.

## What's left to build

- Swap Swiggy mock for real MCP calls (`services/swiggy.js` — all stubs are marked `TODO`)
- Swiggy OAuth flow (`/auth/callback` endpoint)
- Add more dishes to `services/nutrition.js` (currently 14)
- PWA manifest for mobile install
