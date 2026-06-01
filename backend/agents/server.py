from fastapi import FastAPI
from agents.orchestrator import app as graph
from pydantic import BaseModel
from typing import Optional, List

server = FastAPI()

class CartItemInput(BaseModel):
    item_id:    str
    name:       str
    quantity:   int
    unit_price: float
    line_total: float = 0.0

class IdentifyRequest(BaseModel):
    # scan flow
    image:           Optional[str]  = None
    dish:            Optional[str]  = None
    weight:          float          = 100.0
    # checkout flow — only sent when user hits place order
    items:           Optional[List[CartItemInput]] = None
    restaurant_id:   Optional[str]  = None
    restaurant_name: Optional[str]  = None
    pickup_address:  Optional[str]  = None
    dropoff_address: Optional[str]  = None
    payment_method:  Optional[str]  = "COD"
    coupon_code:     Optional[str]  = None

@server.post("/agents/identify")
async def identify(body: IdentifyRequest):
    result = await graph.ainvoke({
        # vision
        "image_b64":       body.image or "",
        "dish_name":       body.dish  or "",
        "cuisine":         "",
        "confidence":      0.0,
        # nutrition
        "weight":          body.weight,
        "nutrition":       None,
        # order — empty if scan-only
        "restaurant_id":   body.restaurant_id   or "",
        "restaurant_name": body.restaurant_name or "",
        "pickup_address":  body.pickup_address  or "",
        "dropoff_address": body.dropoff_address or "",
        "items":           [i.dict() for i in body.items] if body.items else [],
        "payment_method":  body.payment_method  or "COD",
        "coupon_code":     body.coupon_code,
        "item_total":      0.0,
        "delivery_fee":    0.0,
        "discount":        0.0,
        "taxes":           0.0,
        "total":           0.0,
        # delivery
        "order_id":        "",
        "delivery_id":     "",
        "status":          "",
        "driver_name":     None,
        "driver_lat":      None,
        "driver_lng":      None,
        "eta_minutes":     0,
        "tracking_url":    None,
        # shared
        "error":           None
    })

    if result.get("error"):
        return {"error": result["error"]}

    # scan-only response
    if not body.items:
        return {
            "dish":       result["dish_name"],
            "cuisine":    result["cuisine"],
            "confidence": result["confidence"],
            "calories":   result["nutrition"]["calories"] if result["nutrition"] else 0,
            "macros": {
                "protein":   result["nutrition"]["protein"],
                "carbs":     result["nutrition"]["carbs"],
                "fat":       result["nutrition"]["fat"],
                "fiber":     result["nutrition"]["fiber"],
                "sugar":     result["nutrition"]["sugar"],
                "iron":      result["nutrition"]["iron"],
                "magnesium": result["nutrition"]["magnesium"],
            },
            "health_summary": result["nutrition"]["health_summary"]
        }

    # full checkout response
    return {
        "dish":         result["dish_name"],
        "cuisine":      result["cuisine"],
        "order_id":     result["order_id"],
        "delivery_id":  result["delivery_id"],
        "status":       result["status"],
        "eta_minutes":  result["eta_minutes"],
        "tracking_url": result["tracking_url"],
        "total":        result["total"],
        "driver": {
            "name": result["driver_name"],
            "lat":  result["driver_lat"],
            "lng":  result["driver_lng"],
        }
    }

@server.get("/agents/track/{delivery_id}")
async def track(delivery_id: str):
    """Separate polling endpoint for TrackingScreen"""
    from agents.delivery import get_delivery_status
    result = await get_delivery_status(delivery_id)
    return result

@server.get("/health")
async def health():
    return {"status": "ok"}