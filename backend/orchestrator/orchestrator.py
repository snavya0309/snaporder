from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Optional, List

from agents.vision    import vision_node
from agents.nutrition import nutrition_node, Nutrition
from agents.order     import order_node, CartItem
from agents.delivery  import delivery_node

# ─────────────────────────────────────────────────────────────────────────────
# AppState — single source of truth for the entire graph
# Every agent reads from and writes to this.
# Each agent only touches its own fields — nothing else.
# ─────────────────────────────────────────────────────────────────────────────

class AppState(TypedDict):

    # ── VisionAgent ──────────────────────────────────────────────────────────
    # IN:  image_b64 (from server.py)
    # OUT: dish_name, cuisine, confidence
    image_b64:       str
    dish_name:       str
    cuisine:         str
    confidence:      float

    # ── NutritionAgent ───────────────────────────────────────────────────────
    # IN:  dish_name (from VisionAgent), weight (from server.py)
    # OUT: nutrition (full Nutrition TypedDict)
    weight:          float
    nutrition:       Optional[Nutrition]

    # ── OrderAgent ───────────────────────────────────────────────────────────
    # IN:  items, addresses, payment (from server.py)
    # OUT: item_total, delivery_fee, discount, taxes, total, order_id, delivery_id
    restaurant_id:   str
    restaurant_name: str
    pickup_address:  str            # restaurant address → DoorDash pickup
    dropoff_address: str            # customer address   → DoorDash dropoff
    items:           List[CartItem]
    payment_method:  str
    coupon_code:     Optional[str]
    item_total:      float
    delivery_fee:    float
    discount:        float
    taxes:           float
    total:           float

    # ── DeliveryAgent ────────────────────────────────────────────────────────
    # IN:  delivery_id (from OrderAgent)
    # OUT: status, driver details, eta, tracking_url
    order_id:        str
    delivery_id:     str            # DoorDash delivery_id
    status:          str            # mapped to frontend status string
    driver_name:     Optional[str]
    driver_lat:      Optional[float]
    driver_lng:      Optional[float]
    eta_minutes:     int
    tracking_url:    Optional[str]  # DoorDash live tracking link

    # ── shared ───────────────────────────────────────────────────────────────
    error:           Optional[str]

# ─────────────────────────────────────────────────────────────────────────────
# Routing logic
# ─────────────────────────────────────────────────────────────────────────────

def route_after_nutrition(state: AppState) -> str:
    """
    After nutrition runs, decide what's next:
    - If items exist in state → user is checking out → run order + delivery
    - If no items → scan-only call (identify screen) → stop here
    """
    if state.get("items") and len(state["items"]) > 0:
        return "order"
    return END

def route_after_order(state: AppState) -> str:
    """
    After order runs, decide what's next:
    - If order succeeded and has a delivery_id → run delivery
    - If order failed → stop with error
    """
    if state.get("error"):
        return END
    if state.get("delivery_id"):
        return "delivery"
    return END

# ─────────────────────────────────────────────────────────────────────────────
# Build the graph
# ─────────────────────────────────────────────────────────────────────────────

graph = StateGraph(AppState)

# ── Register nodes ────────────────────────────────────────────────────────────
graph.add_node("vision",    vision_node)
graph.add_node("nutrition", nutrition_node)
graph.add_node("order",     order_node)
graph.add_node("delivery",  delivery_node)

# ── Wire edges ────────────────────────────────────────────────────────────────

# vision is always the entry point
graph.add_edge(START, "vision")

# vision → nutrition always
# (nutrition needs dish_name which vision sets)
graph.add_edge("vision", "nutrition")

# nutrition → order OR end
# (depends on whether items were passed in)
graph.add_conditional_edges(
    "nutrition",
    route_after_nutrition,
    {
        "order": "order",
        END:     END
    }
)

# order → delivery OR end
# (depends on whether DoorDash returned a delivery_id)
graph.add_conditional_edges(
    "order",
    route_after_order,
    {
        "delivery": "delivery",
        END:        END
    }
)

# delivery is always the last node
graph.add_edge("delivery", END)

# ─────────────────────────────────────────────────────────────────────────────
# Compile — this is what server.py imports as `app`
# ─────────────────────────────────────────────────────────────────────────────

app = graph.compile()