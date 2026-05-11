# SnapOrder — Project Context

## What we're building
AI app that scans a dish photo → identifies it → shows calories/macros → lets you order on Swiggy via MCP.

## Stack
- Frontend: React + Vite (port 3000)
- Backend: Node.js + Express (port 3001)
- AI: Claude Vision API (claude-sonnet-4-20250514)
- Ordering: Swiggy Food MCP (stubs in place, waiting for access)

## Current state
- Full folder structure is set up
- All files scaffolded with stubs
- Swiggy MCP calls are mocked in backend/services/swiggy.js
- Claude Vision call is in backend/services/claude.js
- Frontend screens: ScanScreen, ResultsScreen, TrackingScreen

## What needs building next
1. Wire up frontend to backend (test the full flow with mock data)
2. Add styling to match the prototype (dark theme, Swiggy-like Proxima Nova stack, #FC5622 orange)
3. Replace Swiggy stubs with real MCP calls once access granted
4. Add calorie tracker that persists across sessions (localStorage)

## API contract
POST /api/identify → { dish, cuisine, confidence, calories, macros, matches }
GET  /api/addresses → { addresses }
POST /api/search → { address, restaurants, matches }
POST /api/cart → { cart }
GET  /api/cart → { cart }
GET  /api/coupons → { coupons }
POST /api/coupons/apply → { cart }
POST /api/order → { orderId, eta, status, itemCount, totals }
GET  /api/track/:orderId → { orderId, status, eta }
POST /api/support/report → { reportId, status }
