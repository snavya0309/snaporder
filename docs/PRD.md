# SnapOrder PRD

## 1. Product Summary

SnapOrder is an AI-assisted food ordering app that turns a dish photo into an orderable Swiggy cart. The user scans or uploads a dish photo, gets dish identification and nutrition, selects one or more matching menu items, confirms address/cart/payment, places the order through Swiggy MCP, tracks delivery, and logs calories for the day.

This is not a clone of Swiggy's whole consumer app. It is a focused ordering surface powered by Swiggy's official MCP tools. SnapOrder owns the AI scan, nutrition context, cart presentation, and calorie tracking. Swiggy owns restaurant/menu data, cart/order execution, delivery tracking, payments where supported, refunds, and underlying user account data.

## 2. Goals

- Let users identify a dish from a photo with high confidence.
- Show useful nutrition estimates before ordering.
- Convert identified dishes into real Swiggy menu/cart choices.
- Support multiple quantities and multiple compatible menu items.
- Confirm the complete cart, address, charges, coupons, and payment method before placing an order.
- Track order status after placement.
- Persist daily calorie totals across sessions.
- Use Swiggy MCP safely: no blind retries for real order placement, no raw PII logging, and no unsupported payment handling.

## 3. Non-Goals

- Do not build a full marketplace replacement for Swiggy browsing.
- Do not store raw payment credentials.
- Do not become merchant of record unless explicitly re-scoped.
- Do not scrape Swiggy.
- Do not bypass Swiggy's checkout/payment/order policies.
- Do not train models on Swiggy-originated user/order data without explicit consent and a data agreement.

## 4. Core Users

- Hungry user: sees a dish, wants to order the closest available version quickly.
- Health-conscious user: wants calorie/macros visibility before ordering.
- Repeat user: wants a fast reorder-like experience with daily calorie tracking.

## 5. Source Constraints And Product Implications

- Official Swiggy Food MCP flow is: `get_addresses -> search_restaurants -> get_restaurant_menu/search_menu -> update_food_cart -> fetch/apply_food_coupon -> get_food_cart -> place_food_order -> track_food_order`.
- Swiggy Food MCP v1 states COD payment and a Rs. 1000 cart cap for Builders Club orders.
- Official docs say `place_food_order` is not idempotent. On 5xx/network failure, we must check active orders before retrying.
- Food cart is tied to a single restaurant. If the user changes restaurant, the Swiggy cart is flushed.
- Swiggy-originated data must be treated as PII. Log session IDs and minimal metadata, not full tool payloads.
- Swiggy's own app has in-app UPI via Swiggy UPI/Juspay HyperUPI, but MCP v1 does not expose that as the food order payment path.

## 6. MVP Scope

### 6.1 Scan And Identify

User can:
- Upload or capture a dish photo.
- Trigger mock scan for demos.
- See dish name, cuisine, confidence, calories, carbs, protein, and fat.
- Retry identification on failure.

System must:
- Call Claude Vision when an API key is configured.
- Fall back to deterministic mock mode for local demos.
- Normalize dish names before nutrition lookup.
- Return empty nutrition safely when unknown.

### 6.2 Swiggy Discovery

User can:
- Select or confirm delivery address.
- See matching restaurants/menu items for the identified dish.
- Filter out closed/unavailable restaurants.
- See item name, restaurant, rating, distance, ETA, price, and availability.

System must:
- Use saved Swiggy addresses via `get_addresses`.
- Search by dish name through `search_restaurants`, `get_restaurant_menu`, and/or `search_menu`.
- Only recommend restaurants marked open/available.
- Explain when no restaurants or no matching items are found.

### 6.3 Cart And Multi-Item Ordering

User can:
- Increase/decrease item quantity.
- Select multiple units of a dish.
- Add compatible items from the same restaurant cart.
- See subtotal, fees, taxes, discounts, final payable, ETA, and item count.
- Remove items and clear cart.

System must:
- Respect Swiggy's single-restaurant cart behavior.
- If user selects an item from a different restaurant, show a cart replacement confirmation before flushing.
- Use `update_food_cart` for quantity changes.
- Use `get_food_cart` as source of truth before final confirmation.
- Enforce Builders Club cart cap where applicable.

### 6.4 Coupons And Offers

User can:
- View eligible offers.
- Apply a coupon.
- Remove or change coupon.
- See coupon failure reasons.

System must:
- Use `fetch_food_coupons`.
- Filter out coupons requiring unsupported payment methods in MCP v1.
- Use `apply_food_coupon`.
- Re-fetch cart totals after coupon changes.

### 6.5 Address And Delivery Instructions

User can:
- Select from saved Swiggy addresses.
- See address label and masked display text.
- Add delivery instructions if supported.
- Change address before order confirmation.

System must:
- Never expose raw coordinates.
- Prompt address creation flow if no saved address is returned.
- Re-run restaurant/menu availability when address changes.

### 6.6 Payment

MVP payment behavior:
- Support COD only for real MCP v1 food orders.
- Show COD as the only enabled method when using Swiggy MCP v1.
- Show disabled placeholders for UPI/cards/wallets with copy: "Online payment is pending Swiggy MCP support."
- Never collect card, UPI PIN, CVV, OTP, or bank credentials inside SnapOrder.

Future online payment behavior:
- Prefer Swiggy-owned hosted checkout or official payment handoff when exposed through MCP.
- If Swiggy exposes UPI/card selection through MCP later, SnapOrder may display those methods but must keep credential entry within Swiggy/Juspay/NPCI-approved surfaces.
- If SnapOrder ever directly processes payments, it becomes a separate payments product requiring payment gateway integration, PCI DSS scope review, refund/dispute operations, regulatory review, and clear merchant-of-record ownership. This is out of MVP scope.

### 6.7 Order Confirmation

User must see before placing:
- Restaurant name.
- Delivery address label/display text.
- Items, variants, add-ons, quantities.
- Item subtotal.
- Taxes, packaging, delivery fee, platform fee, discounts, final total.
- Payment method.
- Estimated delivery time.
- Cancellation/refund warning.

System must:
- Require explicit user confirmation.
- Disable double-submit.
- Treat `place_food_order` as non-idempotent.
- On network/5xx after placement attempt, call active orders/details before retrying.

### 6.8 Tracking

User can:
- See order ID.
- See status timeline: confirmed, preparing, picked up/out for delivery, delivered/cancelled.
- See ETA.
- See delivery partner info only if provided by Swiggy.
- Start a new scan after order placement.

System must:
- Poll no faster than Swiggy's recommended cadence.
- Stop polling on terminal states.
- Surface tracking errors without losing order context.

### 6.9 Support, Cancellation, Refunds

User can:
- See order details.
- Report a problem.
- Navigate to Swiggy support for refund/cancellation cases.

System must:
- Do not promise refunds.
- Do not implement cancellation unless Swiggy MCP exposes a supported tool.
- Capture a minimal internal support record: order ID, session ID, user-facing error, timestamp.
- Use `report_error` for MCP failures where appropriate.

### 6.10 Calorie Tracker

User can:
- See today's total calories and macros.
- See item count logged.
- Reset today's tracker.

System must:
- Persist tracker in localStorage for MVP.
- Multiply calories/macros by selected quantity.
- Reset automatically per local day.
- Avoid mixing calorie tracking with payment/order truth; tracker is an estimate.

## 7. Future Scope

- Swiggy OAuth login and token refresh.
- Real Swiggy MCP food integration.
- Online payment handoff when officially supported.
- Address creation/edit flow.
- Menu variants and add-ons.
- Dietary preferences and allergens.
- Multiple dish detection from one image.
- Reorder from history.
- Voice ordering.
- Real nutrition provider integration.
- Admin observability dashboard.

## 8. User Flow

1. User lands on scan screen.
2. User scans/uploads dish photo.
3. App identifies dish and nutrition.
4. App resolves saved Swiggy address.
5. App searches restaurants/menu items for the dish.
6. User reviews results and selects quantities.
7. App updates Swiggy cart.
8. User reviews cart, fees, coupons, address, ETA, and payment method.
9. User confirms order.
10. App places Swiggy order.
11. App logs calories based on selected quantity.
12. User tracks delivery.
13. User can report a problem or start a new scan.

## 9. Key Screens

- Scan screen
- Identification results screen
- Restaurant/menu match screen
- Cart drawer or checkout screen
- Coupon selection sheet
- Address selection sheet
- Payment selection section
- Final confirmation modal
- Tracking screen
- Support/problem screen
- Calorie tracker panel

## 10. API Requirements

### Frontend To Backend

`POST /api/identify`
- Request: `{ image: string }`
- Response: `{ dish, cuisine, confidence, calories, macros, matches }`

`GET /api/addresses`
- Response: `{ addresses: [{ id, label, displayText }] }`

`POST /api/search`
- Request: `{ dish, addressId }`
- Response: `{ restaurants, matches }`

`POST /api/cart`
- Request: `{ restaurantId, items: [{ itemId, quantity, variants?, addOns? }] }`
- Response: Swiggy cart summary.

`GET /api/cart`
- Response: current cart summary.

`POST /api/coupons/apply`
- Request: `{ code }`
- Response: updated cart summary.

`POST /api/order`
- Request: `{ paymentMethod: "COD" }`
- Response: `{ orderId, eta, status, itemCount }`

`GET /api/track/:orderId`
- Response: `{ orderId, status, eta, partnerName? }`

`POST /api/support/report`
- Request: `{ orderId?, sessionId?, issueType, message }`
- Response: `{ reportId }`

### Backend To Swiggy MCP

Required food tools:
- `get_addresses`
- `search_restaurants`
- `get_restaurant_menu`
- `search_menu`
- `update_food_cart`
- `flush_food_cart`
- `get_food_cart`
- `fetch_food_coupons`
- `apply_food_coupon`
- `place_food_order`
- `track_food_order`
- `get_food_orders`
- `get_food_order_details`
- `report_error`

## 11. Payment Requirements

### MVP

- Payment method: COD only.
- Do not collect online payment credentials.
- Order total must be displayed before placement.
- User must explicitly confirm "Place order".
- Coupon filtering must exclude coupons that require online payment.

### Post-MVP

- Add Swiggy-hosted payment method selector when MCP supports it.
- Support UPI/card/wallet only through official Swiggy or payment-provider UI.
- Add payment states: pending, authorized, failed, retryable failed, successful, refunded.
- Add payment failure recovery: retry payment, switch method, abandon order.
- Add reconciliation: order placed but payment state unknown, payment deducted but order not placed.

## 12. Error States

- Image upload failure.
- AI identification failure.
- Unknown nutrition.
- No saved address.
- Address outside service zone.
- Restaurant closed after search.
- Menu item unavailable.
- Cart replaced due to restaurant switch.
- Coupon invalid/ineligible/payment-method restricted.
- Minimum order not met.
- Cart cap exceeded.
- Order placement timeout.
- Order placement succeeded but client timed out.
- Duplicate order prevention.
- Tracking unavailable.
- Order cancelled by restaurant/Swiggy.
- Payment unavailable in MCP v1.

## 13. Safety And Compliance

- Treat Swiggy-originated tool responses as PII.
- Store minimal data locally.
- Hash user IDs in logs.
- Do not log raw addresses, full order payloads, payment data, or tokens.
- Use TLS in all environments beyond local dev.
- Keep Anthropic and Swiggy secrets server-side only.
- Add a deletion path for locally stored derived user data.
- Add explicit consent before analytics on order/nutrition behavior.

## 14. Observability

Log per request:
- Timestamp.
- User/session ID hash.
- Swiggy MCP session ID.
- Tool name.
- Duration.
- Status.
- Error code/message class.

Metrics:
- Identify success rate.
- Identify latency.
- Search/menu success rate.
- Cart update success rate.
- Order placement success rate.
- Order placement unknown-state count.
- Coupon failure rate.
- Tracking polling failures.
- Payment method distribution when online payments exist.

## 15. Success Metrics

- Scan to result success rate.
- Result to cart conversion.
- Cart to confirmed order conversion.
- Median time from scan to order confirmation.
- Order placement unknown-state rate.
- Daily active returning users.
- Calorie tracker repeat usage.
- Support issue rate per order.

## 16. Release Plan

### Phase 0: Demo

- Mock AI.
- Mock Swiggy matches.
- Mock ordering/tracking.
- Multi-item quantities.
- Local calorie tracker.

### Phase 1: Real Food MCP, COD

- OAuth.
- Real addresses.
- Real restaurant/menu search.
- Real cart/coupons.
- COD order placement.
- Real tracking.
- Production retry/observability.

### Phase 2: Checkout Completeness

- Address creation/edit if supported.
- Variants/add-ons.
- Better cart replacement UX.
- Support/reporting.
- Cancellation/refund handoff.

### Phase 3: Online Payments

- Only after Swiggy exposes official online payment support for MCP or hosted handoff.
- Add UPI/cards/wallets through official checkout surfaces.
- Add payment failure/reconciliation/refund states.

## 17. Open Questions

- Does Swiggy Food MCP production allow any online payment method beyond COD yet?
- Will Swiggy expose hosted checkout/payment handoff for MCP partners?
- Are address creation and delivery instructions available for Food MCP in the target access tier?
- What are the exact production cart caps and coupon restrictions for this partner account?
- What order cancellation APIs, if any, are exposed to Builders Club partners?
- What support handoff URL/deep link should SnapOrder use for user-facing refund issues?

## 18. References

- Swiggy Builders Club Food flow: https://mcp.swiggy.com/builders/docs/build/recipes/order-food/
- Swiggy Builders Club Food reference: https://mcp.swiggy.com/builders/docs/reference/food/
- Swiggy Builders Club production guidance: https://mcp.swiggy.com/builders/docs/build/ship-to-production/
- Swiggy Builders Club data and compliance: https://mcp.swiggy.com/builders/docs/operate/data-and-compliance/
- Swiggy UPI announcement: https://blog.swiggy.com/news/swiggy-launches-swiggy-upi-for-faster-payment-experience/
