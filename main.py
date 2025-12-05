from fastapi import FastAPI, Body
from ML_model import ModelManager
from pydantic import BaseModel

app = FastAPI()
manager = ModelManager()

class PredictionRequest(BaseModel):
    business_id: str
    arrival_hour: int
    queue_length: int
    service_type: str
    service_details: str

@app.post("/predict")
def predict(request: PredictionRequest):
    """Simple prediction endpoint for Express.js"""
    try:
        prediction = manager.predict_from_customer_input(
            business_id=request.business_id,
            arrival_hour=request.arrival_hour,
            queue_length=request.queue_length,
            service_type=request.service_type,
            service_details=request.service_details
        )
        return {"وقت الانتظار": float(prediction[0])}
    except Exception as e:
        return {"error": str(e)}

@app.get("/health")
def health():
    return {"status": "ok"}