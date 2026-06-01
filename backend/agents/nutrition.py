from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from dotenv import load_dotenv
from typing import TypedDict, Optional
import httpx
import json
import os

load_dotenv()

model = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)
USDA_API_KEY = os.getenv("USDA_API_KEY", "DEMO_KEY")

class Nutrition(TypedDict):
    food_name:      str
    weight:         float
    calories:       float
    protein:        float
    carbs:          float
    fat:            float
    fiber:          float
    sugar:          float
    magnesium:      float
    iron:           float
    health_summary: str     #  LLM output goes here

class NutritionState(TypedDict):
    dish_name:  str
    weight:     float
    nutrition:  Optional[Nutrition]
    error:      Optional[str]

async def nutrition_node(state: NutritionState) -> dict:
    dish_name = state["dish_name"]
    weight    = state["weight"]

    try:
        async with httpx.AsyncClient() as client:
            #  search for the food and get fdc_id
            id_response = await client.get(
                f"https://api.nal.usda.gov/fdc/v1/foods/search",
                params={"api_key": USDA_API_KEY, "query": dish_name, "pageSize": 1}
            )
            id_data = id_response.json()

            if not id_data["foods"]:
                return {"error": f"No USDA match found for {dish_name}"}

            fdc_id = id_data["foods"][0]["fdcId"]

            # step 2 — get full nutrition details for that food
            nutrition_response = await client.get(
                f"https://api.nal.usda.gov/fdc/v1/food/{fdc_id}",
                params={"api_key": USDA_API_KEY}
            )
            nutrition_data = nutrition_response.json()

        # extract nutrients from USDA response
        nutrients = {n["nutrientName"]: n["value"] for n in nutrition_data["foodNutrients"]}

        calories  = nutrients.get("Energy", 0)
        protein   = nutrients.get("Protein", 0)
        carbs     = nutrients.get("Carbohydrate, by difference", 0)
        fat       = nutrients.get("Total lipid (fat)", 0)
        fiber     = nutrients.get("Fiber, total dietary", 0)
        sugar     = nutrients.get("Sugars, total including NLEA", 0)
        iron      = nutrients.get("Iron, Fe", 0)
        magnesium = nutrients.get("Magnesium, Mg", 0)

        #  ask LLM for health evaluation using real values
        system = SystemMessage(content=f"""You are a certified nutritionist.
Given the following nutritional data for {dish_name} (per {weight}g serving):
- Calories:  {calories} kcal
- Protein:   {protein}g
- Carbs:     {carbs}g
- Fat:       {fat}g
- Fiber:     {fiber}g
- Sugar:     {sugar}g
- Iron:      {iron}mg
- Magnesium: {magnesium}mg

Evaluate how healthy this dish is in 2-3 sentences. Be concise.""")

        human = HumanMessage(content=[
            {"type": "text", "text": "Is this a healthy dish? What are the benefits or concerns?"}
        ])

        response = model.invoke([system, human])
        health_summary = response.content  # plain text, no json.loads

        return {
            "nutrition": {
                "food_name":      dish_name,
                "weight":         weight,
                "calories":       calories,
                "protein":        protein,
                "carbs":          carbs,
                "fat":            fat,
                "fiber":          fiber,
                "sugar":          sugar,
                "iron":           iron,
                "magnesium":      magnesium,
                "health_summary": health_summary
            },
            "error": None
        }

    except KeyError as e:
        return {"error": f"Missing field in USDA response: {str(e)}"}
    except Exception as e:
        return {"error": str(e)}