from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from typing import TypedDict, Optional
from dotenv import load_dotenv
import json 



load_dotenv()
model = ChatGroq(model="meta-llama/llama-4-scout-17b-16e-instruct", temperature=0)

class VisionState(TypedDict):
    image_b64: str        
    dish_name: str        
    cuisine: str         
    confidence: float     
    error: Optional[str]

async def vision_node(state:VisionState) ->dict:
    image_b64 = state["image_b64"]

    if not image_b64:
        return {"error":"Image was not provided"}

    if "," in image_b64:
        image_b64 = image_b64.split(",")[1]

    
    
    system = SystemMessage(
        content= """ You are a certified nutritionist with 25 years of experience.
                     look at the image and return the result only in json object with these exact fields:
                     {
                        "dish_name": "name of the dish",
                        "cuisine": "cuisine type",
                        "confidence": 0.0 to 1.0
                    }
                Return nothing else. No explanation. No markdown. Just the JSON."""
    )
    human = HumanMessage(content=[
        {"type": "text", "text": "Identify the food in this image."},
        {"type": "image_url", "image_url": {
            "url": f"data:image/jpeg;base64,{image_b64}"
        }}
    ])

    try:
        response = model.invoke([system, human])
        data = json.loads(response.content)
        return {
            "dish_name":  data["dish_name"],
            "cuisine":    data["cuisine"],
            "confidence": data["confidence"],
            "error":      None
        }
    except json.JSONDecodeError:
        return {"error": f"model returned non-JSON: {response.content}"}
    except Exception as e:
        return {"error": str(e)}