# SnapOrder 📸🍛

> Snap a dish photo → get calories → order it instantly from Swiggy

SnapOrder uses AI vision to identify any dish from a photo, breaks down its nutrition, and lets you order the closest match on Swiggy — all in under 30 seconds.

## Features

- 📷 **Snap any dish** — homemade, restaurant, or from social media
- 🔍 **AI identification** — Claude Vision detects dish, cuisine, confidence score
- 🔥 **Instant nutrition** — calories, carbs, protein, fat per serving
- 🛒 **One-tap ordering** — directly via Swiggy Food MCP
- 📊 **Daily calorie tracker** — running total across every ordered item

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite |
| AI Vision | Claude claude-sonnet-4-20250514 (multimodal) |
| Ordering | Swiggy Food MCP |
| Backend | Node.js + Express |
| Nutrition DB | Custom mapped dataset |
| Auth | Swiggy OAuth 2.0 |
| Deploy | Vercel (frontend) + Railway (backend) |

## Repo structure

```
snaporder/
├── frontend/                  # React app (Person 1)
│   └── src/
│       ├── screens/           # ScanScreen, ResultsScreen, CheckoutScreen, TrackingScreen
│       ├── components/        # CalorieBanner, DishCard, OrderOptions
│       ├── hooks/             # useCamera, useCalorieTracker
│       └── utils/             # api.js
├── backend/                   # Node.js API (Person 2)
│   ├── routes/                # /identify, /order, /track
│   ├── services/              # claude.js, swiggy.js, nutrition.js
│   └── middleware/            # auth.js
├── shared/                    # API contract — both teammates reference this
└── docs/
```

## API contract

Lock this before splitting work. Both teammates build against these shapes.

### `POST /api/identify`

**Request**
```json
{ "image": "<base64 jpeg>" }
```

**Response**
```json
{
  "dish": "Chicken Biryani",
  "cuisine": "Mughlai",
  "confidence": 0.97,
  "calories": 680,
  "macros": { "carbs": 72, "protein": 38, "fat": 22 },
  "matches": [
    {
      "restaurant": "Behrouz Biryani",
      "platform": "swiggy",
      "price": 289,
      "deliveryTime": 28,
      "rating": 4.5,
      "distance": 4.2
    }
  ]
}
```

### `POST /api/order`

**Request**
```json
{ "paymentMethod": "COD" }
```

The normal flow places the current cart created through `POST /api/cart`. The backend still accepts inline items for compatibility:
```json
{
  "paymentMethod": "COD",
  "items": [
    { "restaurantId": "string", "itemId": "string", "quantity": 1 }
  ]
}
```

**Response**
```json
{ "orderId": "SW-847291", "eta": 28, "status": "confirmed", "itemCount": 2 }
```

### Checkout endpoints

- `GET /api/addresses`
- `POST /api/search`
- `POST /api/cart`
- `GET /api/cart`
- `GET /api/coupons`
- `POST /api/coupons/apply`
- `POST /api/support/report`

### `GET /api/track/:orderId`

**Response**
```json
{ "orderId": "string", "status": "preparing|out_for_delivery|delivered", "eta": 18 }
```

## Getting started

```bash
# Clone
git clone https://github.com/snavya0309/snaporder.git
cd snaporder

# Frontend
cd frontend && npm install && npm run dev

# Backend (separate terminal)
cd backend && npm install && npm run dev
```

## Environment variables

**frontend/.env** (copy from `.env.example`)
```
VITE_API_URL=http://localhost:3001
```

**backend/.env** (copy from `.env.example`)
```
ANTHROPIC_API_KEY=your_key
SWIGGY_CLIENT_ID=your_id
SWIGGY_CLIENT_SECRET=your_secret
SWIGGY_MCP_URL=https://mcp.swiggy.com
PORT=3001
```

## Who owns what

| Area | Owner |
|---|---|
| React screens & components | Person 1 |
| Claude Vision integration | Person 1 |
| Swiggy MCP + ordering flow | Person 1 |
| Node.js API server | Person 2 |
| Swiggy OAuth flow | Person 2 |
| Nutrition database | Person 2 |
| Deployment | Person 2 |

## Built for

Swiggy MCP Builders Club — applying for early API access.
