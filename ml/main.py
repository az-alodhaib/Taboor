from fastapi import FastAPI, Body, Response
from ml.ml_model import ModelManager
from pydantic import BaseModel


app = FastAPI()
manager = ModelManager()

class PredictionRequest(BaseModel):
    business_id: str
    arrival_hour: int
    queue_length: int
    service_type: str
    service_details: str
    avg_service_time: float      
    hourly_avg_service_time: float  

@app.post("/predict")
def predict(request: PredictionRequest):
    try:
        prediction = manager.predict_from_customer_input(
            business_id=request.business_id,
            arrival_hour=request.arrival_hour, # 11.45.29
            queue_length=request.queue_length, # 7
            service_type=request.service_type, # barber , workshop , car shop
            service_details=request.service_details, # (haircut , bread , haircut and bread) , (big car , small car) , (oil change)
            avg_service_time=request.avg_service_time,          
            hourly_avg_service_time=request.hourly_avg_service_time  
        )
        return {"predicted_wait_minutes": float(prediction[0])}  
    except Exception as e:
        return {"error": str(e)}

@app.get("/")
def root():
    return {"status": "ok", "service": "taboor-ml"}

@app.head("/")
def head_root():
    return Response(status_code=200)


@app.get("/health")
def health():
    return {"ok": True}
