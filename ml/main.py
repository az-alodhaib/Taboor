from fastapi import FastAPI, Response
from pydantic import BaseModel
from ml.ml_model import ModelManager


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
            arrival_hour=request.arrival_hour,
            queue_length=request.queue_length,
            service_type=request.service_type,
            service_details=request.service_details,
            avg_service_time=request.avg_service_time,
            hourly_avg_service_time=request.hourly_avg_service_time,
        )

        # self-note: prediction can be array-like; always return a float if possible
        val = float(prediction[0]) if hasattr(prediction, "__len__") else float(prediction)
        return {"predicted_wait_minutes": val}

    except Exception as e:
        # self-note: keep API stable (frontend/backend can fallback)
        return {"error": str(e)}


@app.get("/labels")
def labels():
    """
    self-note: debug endpoint to see what categories the saved encoder accepts.
    Use this to align Node mappings / UI service values with the trained model.
    """
    try:
        return manager.get_model_labels()
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
