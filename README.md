# SnapOrder

> Snap a dish photo → identify it with AI → see calories → order via DoorDash

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
| Vision agent | ✅ | Groq + Llama 4 Scout identifies dish from photo |
| Nutrition agent | ✅ | USDA Food Data API + LLM health summary |
| LangGraph orchestrator | ✅ | Vision → Nutrition → Order → Delivery pipeline |
| Swiggy search | ✅ (mock) | 8 cuisine profiles, restaurant matches with delivery time/rating |
| Cart & checkout | ✅ (mock) | Full cart flow with totals, delivery fee, taxes |
| Coupons | ✅ (mock) | SNAP50, BIRYANI75, PIZZA50, FREEDEL, UPI100 — category-aware |
| Order tracking | ✅ (mock) | Status advances automatically based on elapsed time |
| Calorie tracker | ✅ | localStorage, resets daily, tracks macros |
| Text search fallback | ✅ | If scan fails, user can type dish name |
| DoorDash delivery (real) | ⏳ | Agent wired, needs `DOORDASH_*` credentials |
| Swiggy MCP (real) | ⏳ | Stubs in place, waiting for API access |

## Architecture

```
Frontend (React/Vite :3000)
        │  POST /api/identify
        ▼
Node.js / Express (:3001)   ──proxy──►  Python FastAPI (:8000)
  routes/identify.js                      LangGraph orchestrator
  routes/cart.js                            ├── vision_node    (Groq Llama 4 Scout)
  routes/order.js                           ├── nutrition_node (USDA + Llama 3.3-70b)
  routes/track.js                           ├── order_node     (DoorDash Drive API)
  services/swiggy.js (mock)                 └── delivery_node  (DoorDash tracking)
```

The Node backend handles cart state, coupons, and Swiggy search (mock).  
The Python FastAPI backend runs the LangGraph agent pipeline for vision, nutrition, and ordering.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite 4 |
| Styling | Custom CSS (Syne font, dark theme, #FC5622) |
| AI agents | LangGraph + LangChain + Groq (Llama 4 Scout, Llama 3.3-70b) |
| Nutrition data | USDA FoodData Central API |
| Ordering | DoorDash Drive API (mock fallback) |
| Node backend | Node.js + Express (ESM) |
| Python backend | FastAPI + LangGraph |
| Deploy | Vercel (frontend + Node) + separate Python service |

## Repo structure

```
snaporder/
├── vercel.json
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
│   ├── agents/                   # Python LangGraph agents
│   │   ├── server.py             # FastAPI entry point → port 8000
│   │   ├── vision.py             # Dish identification (Groq)
│   │   ├── nutrition.py          # USDA nutrition lookup + LLM summary
│   │   ├── order.py              # DoorDash order placement
│   │   └── delivery.py           # DoorDash delivery tracking
│   ├── orchestrator/
│   │   └── orchestrator.py       # LangGraph StateGraph wiring all agents
│   ├── routes/
│   │   ├── identify.js           # POST /api/identify → proxies to :8000
│   │   ├── search.js             # POST /api/search
│   │   ├── cart.js               # GET/POST/DELETE /api/cart
│   │   ├── coupons.js            # GET /api/coupons, POST /api/coupons/apply
│   │   ├── order.js              # POST /api/order
│   │   ├── track.js              # GET /api/track/:orderId
│   │   ├── addresses.js          # GET /api/addresses
│   │   └── support.js            # POST /api/support/report
│   └── services/
│       ├── swiggy.js             # Swiggy mock (restaurant matches)
│       └── nutrition.js          # Fallback nutrition DB (14 dishes)
└── shared/
    └── api.types.js
```

## Running locally

Requires 3 terminals.

```bash
git clone https://github.com/snavya0309/snaporder.git
cd snaporder

# Terminal 1 — Python agent backend
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install fastapi uvicorn langgraph langchain-groq langchain-core httpx python-dotenv pyjwt
cp .env.example .env              # fill in GROQ_API_KEY at minimum
uvicorn agents.server:server --port 8000 --reload

# Terminal 2 — Node.js backend
cd backend
npm install
npm run dev                       # → http://localhost:3001

# Terminal 3 — Frontend
cd frontend
npm install
npm run dev                       # → http://localhost:3000
```

**Minimum to run:** only `GROQ_API_KEY` is required. USDA falls back to `DEMO_KEY` (rate-limited). DoorDash order/tracking will mock if credentials are missing.

## Environment variables

**`backend/.env`** (copy from `.env.example`)

```
# Node backend
ANTHROPIC_API_KEY=          # optional
PORT=3001

# Python agents (required)
GROQ_API_KEY=

# Nutrition (optional — DEMO_KEY used if blank)
USDA_API_KEY=

# DoorDash Drive API (optional — mocked if blank)
DOORDASH_DEVELOPER_ID=
DOORDASH_KEY_ID=
DOORDASH_SIGNING_SECRET=
```

## API reference

### `POST /api/identify`
Accepts an image or dish name. Node backend proxies to Python FastAPI at `:8000`.
```json
{ "image": "<base64 jpeg>" }
// or
{ "dish": "Masala Dosa" }
```
Returns `{ dish, cuisine, confidence, calories, macros{ protein, carbs, fat, fiber, sugar, iron, magnesium }, health_summary, matches[] }`.

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

### Python agent endpoints (port 8000)
- `POST /agents/identify` — full LangGraph pipeline (vision + nutrition + optional order)
- `GET /agents/track/:delivery_id` — DoorDash delivery status

## Deployment

Frontend + Node backend deploy together on Vercel (`vercel.json` at repo root).  
The Python FastAPI backend needs a separate service (Railway, Render, or Fly.io) — set `PYTHON_AGENT_URL` in the Node backend's env to point to it instead of `localhost:8000`.

## What's left to build

- Add `PYTHON_AGENT_URL` env var to `routes/identify.js` so it works in production
- Wire real DoorDash credentials and test the order flow end-to-end
- Swap Swiggy mock for real MCP calls once API access is granted
- PWA manifest for mobile install
