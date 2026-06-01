from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from dotenv import load_dotenv
from typing import TypedDict, Optional, List
import httpx
import json
import os
import jwt
import time
import uuid

load_dotenv()

model = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)

DOORDASH_BASE_URL = "https://openapi.doordash.com"  # sandbox: "https://openapi.doordash.com/drive/v2"

# ─── TypedDicts ───────────────────────────────────────────────────────────────

class CartItem(TypedDict):
    item_id:    str
    name:       str
    quantity:   int
    unit_price: float
    line_total: float

class OrderState(TypedDict):
    # inputs from frontend
    restaurant_id:   str
    restaurant_name: str
    pickup_address:  str       # restaurant address
    dropoff_address: str       # customer address
    items:           List[CartItem]
    payment_method:  str
    coupon_code:     Optional[str]

    # computed by validate_cart
    item_total:      float
    delivery_fee:    float
    discount:        float
    taxes:           float
    total:           float

    # set after DoorDash call
    order_id:        str
    delivery_id:     str       # DoorDash delivery_id → passed to delivery.py
    status:          str
    eta_minutes:     int

    error:           Optional[str]

# ─── JWT helper ───────────────────────────────────────────────────────────────

def get_doordash_jwt() -> str:
    payload = {
        "aud": "doordash",
        "iss": os.getenv("DOORDASH_DEVELOPER_ID"),
        "kid": os.getenv("DOORDASH_KEY_ID"),
        "exp": int(time.time()) + 300,
        "iat": int(time.time()),
        "jti": str(uuid.uuid4()),
    }
    secret = os.getenv("DOORDASH_SIGNING_SECRET")
    return jwt.encode(
        payload,
        secret,
        algorithm="HS256",
        headers={"dd-ver": "DD-JWT-V1"}
    )

# ─── Step 1: validate cart + compute totals ──────────────────────────────────

async def validate_cart(state: OrderState) -> dict:
    items = state["items"]

    if not items:
        return {"error": "cart is empty"}

    # compute item total from items
    item_total = sum(item["unit_price"] * item["quantity"] for item in items)

    # update line_total on each item in case frontend sent wrong value
    updated_items = [
        {**item, "line_total": round(item["unit_price"] * item["quantity"], 2)}
        for item in items
    ]

    # delivery fee waived above $30
    delivery_fee = 0.0 if item_total >= 30 else 4.99

    # taxes at 8%
    taxes = round(item_total * 0.08, 2)

    # discount starts at 0 — apply_coupon will update this
    discount = 0.0

    total = round(item_total - discount + delivery_fee + taxes, 2)

    return {
        "items":        updated_items,
        "item_total":   round(item_total, 2),
        "delivery_fee": delivery_fee,
        "discount":     discount,
        "taxes":        taxes,
        "total":        total,
        "error":        None
    }

# ─── Step 2: coupon reasoning via Groq ───────────────────────────────────────

async def apply_coupon(state: OrderState) -> dict:
    coupon_code  = state["coupon_code"]
    items        = state["items"]
    item_total   = state["item_total"]
    payment      = state["payment_method"]
    delivery_fee = state["delivery_fee"]

    system = SystemMessage(content="""You are a coupon validation assistant.
Given a cart and coupon code, decide if the coupon is valid and what discount to apply.
Return ONLY a JSON object with exactly these fields:
{
  "valid": true or false,
  "discount": float (dollar amount to subtract, 0 if invalid),
  "reason": "short explanation"
}
No markdown. No explanation. Just the JSON.""")

    human = HumanMessage(content=[{
        "type": "text",
        "text": f"""Coupon code: {coupon_code}
Cart items: {json.dumps(items)}
Item total: ${item_total}
Payment method: {payment}
Delivery fee: ${delivery_fee}

Valid coupon rules:
- SAVE10: 10% off orders over $20
- FREEDEL: free delivery on any order
- FLAT5: $5 off orders over $25, card payment only"""
    }])

    try:
        response = model.invoke([system, human])
        data     = json.loads(response.content)

        if not data.get("valid"):
            return {"error": f"Coupon invalid: {data.get('reason', 'unknown reason')}"}

        discount = float(data.get("discount", 0))
        total    = round(state["item_total"] - discount + state["delivery_fee"] + state["taxes"], 2)

        return {
            "discount": discount,
            "total":    total,
            "error":    None
        }

    except json.JSONDecodeError:
        return {"error": f"Coupon check failed — model returned non-JSON: {response.content}"}
    except Exception as e:
        return {"error": str(e)}

# ─── Step 3: call DoorDash Drive to create delivery ──────────────────────────

async def place_order(state: OrderState) -> dict:
    try:
        token = get_doordash_jwt()

        # build the DoorDash delivery payload
        payload = {
            "external_delivery_id": str(uuid.uuid4()),   # your unique order ID
            "pickup_address":       state["pickup_address"],
            "pickup_business_name": state["restaurant_name"],
            "dropoff_address":      state["dropoff_address"],
            "order_value":          int(state["total"] * 100),  # DoorDash wants cents
            "currency":             "USD",
            "items": [
                {
                    "name":     item["name"],
                    "quantity": item["quantity"],
                    "price":    int(item["unit_price"] * 100)    # cents
                }
                for item in state["items"]
            ]
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{DOORDASH_BASE_URL}/drive/v2/deliveries",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type":  "application/json"
                },
                json=payload
            )

        if response.status_code not in (200, 201):
            return {"error": f"DoorDash error {response.status_code}: {response.text}"}

        data = response.json()

        return {
            "order_id":    payload["external_delivery_id"],
            "delivery_id": data.get("external_delivery_id") or data.get("id", ""),
            "status":      data.get("delivery_status", "created"),
            "eta_minutes": data.get("pickup_time_estimated", 30),
            "error":       None
        }

    except Exception as e:
        return {"error": str(e)}

# ─── Main node — called by orchestrator ──────────────────────────────────────

async def order_node(state: OrderState) -> dict:
    # step 1 — validate and compute totals
    cart_result = await validate_cart(state)
    if cart_result.get("error"):
        return cart_result
    state = {**state, **cart_result}

    # step 2 — apply coupon if provided
    if state.get("coupon_code"):
        coupon_result = await apply_coupon(state)
        if coupon_result.get("error"):
            return coupon_result
        state = {**state, **coupon_result}

    # step 3 — place order via DoorDash
    order_result = await place_order(state)
    return {**state, **order_result}