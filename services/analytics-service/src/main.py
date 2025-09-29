from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from typing import List, Optional, Dict, Any
import logging

from .models.demand_prediction import DemandPredictor
from .models.pricing_optimization import PricingOptimizer
from .models.maintenance_prediction import MaintenancePredictor
from .pipelines.data_processor import DataProcessor
from .controllers.analytics_controller import AnalyticsController

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="EV Analytics Service",
    description="AI-powered analytics for EV charging stations",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure based on environment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize controllers and models
data_processor = DataProcessor()
demand_predictor = DemandPredictor()
pricing_optimizer = PricingOptimizer()
maintenance_predictor = MaintenancePredictor()
analytics_controller = AnalyticsController()

# Pydantic models
class PredictDemandRequest(BaseModel):
    station_id: str
    start_date: datetime
    end_date: datetime
    features: Optional[Dict[str, Any]] = None

class OptimizePricingRequest(BaseModel):
    station_id: str
    current_demand: float
    competitor_prices: List[float]
    time_of_day: int
    day_of_week: int

class PredictMaintenanceRequest(BaseModel):
    station_id: str
    port_id: str
    telemetry_data: Dict[str, Any]

class AnalyticsRequest(BaseModel):
    tenant_id: str
    metric_type: str
    start_date: datetime
    end_date: datetime
    filters: Optional[Dict[str, Any]] = None

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow(),
        "version": "1.0.0"
    }

@app.post("/predict/demand")
async def predict_demand(request: PredictDemandRequest):
    """Predict charging demand for a station."""
    try:
        # Process historical data
        historical_data = await data_processor.get_station_data(
            request.station_id,
            request.start_date - timedelta(days=30),  # Include 30 days of history
            request.end_date
        )

        if historical_data.empty:
            raise HTTPException(status_code=404, message="No historical data found")

        # Generate predictions
        predictions = demand_predictor.predict(
            historical_data,
            request.start_date,
            request.end_date,
            features=request.features
        )

        return {
            "station_id": request.station_id,
            "predictions": predictions.to_dict('records'),
            "confidence_interval": demand_predictor.get_confidence_interval(),
            "model_accuracy": demand_predictor.get_model_accuracy()
        }

    except Exception as e:
        logger.error(f"Demand prediction failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Prediction failed")

@app.post("/optimize/pricing")
async def optimize_pricing(request: OptimizePricingRequest):
    """Optimize pricing based on demand and market conditions."""
    try:
        # Get current market data
        market_data = await data_processor.get_market_data(request.station_id)

        # Optimize pricing
        optimal_price = pricing_optimizer.optimize(
            current_demand=request.current_demand,
            competitor_prices=request.competitor_prices,
            time_of_day=request.time_of_day,
            day_of_week=request.day_of_week,
            market_data=market_data
        )

        return {
            "station_id": request.station_id,
            "optimal_price": optimal_price,
            "price_elasticity": pricing_optimizer.get_price_elasticity(),
            "revenue_impact": pricing_optimizer.estimate_revenue_impact(optimal_price),
            "confidence_score": pricing_optimizer.get_confidence_score()
        }

    except Exception as e:
        logger.error(f"Pricing optimization failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Optimization failed")

@app.post("/predict/maintenance")
async def predict_maintenance(request: PredictMaintenanceRequest):
    """Predict maintenance needs for charging ports."""
    try:
        # Get historical telemetry data
        telemetry_history = await data_processor.get_telemetry_data(
            request.port_id,
            datetime.utcnow() - timedelta(days=90)  # 90 days of telemetry
        )

        # Predict maintenance needs
        maintenance_prediction = maintenance_predictor.predict(
            telemetry_history,
            request.telemetry_data
        )

        return {
            "port_id": request.port_id,
            "maintenance_score": maintenance_prediction["score"],
            "predicted_failure_date": maintenance_prediction["failure_date"],
            "recommended_actions": maintenance_prediction["actions"],
            "confidence": maintenance_prediction["confidence"],
            "risk_factors": maintenance_prediction["risk_factors"]
        }

    except Exception as e:
        logger.error(f"Maintenance prediction failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Prediction failed")

@app.post("/analytics/generate")
async def generate_analytics(request: AnalyticsRequest):
    """Generate comprehensive analytics for a tenant."""
    try:
        analytics_data = await analytics_controller.generate_comprehensive_analytics(
            tenant_id=request.tenant_id,
            metric_type=request.metric_type,
            start_date=request.start_date,
            end_date=request.end_date,
            filters=request.filters
        )

        return {
            "tenant_id": request.tenant_id,
            "analytics": analytics_data,
            "generated_at": datetime.utcnow()
        }

    except Exception as e:
        logger.error(f"Analytics generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Analytics generation failed")

@app.get("/analytics/insights/{tenant_id}")
async def get_ai_insights(tenant_id: str):
    """Get AI-generated insights for a tenant."""
    try:
        insights = await analytics_controller.generate_ai_insights(tenant_id)

        return {
            "tenant_id": tenant_id,
            "insights": insights,
            "generated_at": datetime.utcnow()
        }

    except Exception as e:
        logger.error(f"Insight generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Insight generation failed")

@app.get("/models/retrain")
async def retrain_models():
    """Retrain all ML models with latest data."""
    try:
        # Retrain demand prediction model
        demand_accuracy = await demand_predictor.retrain()

        # Retrain pricing optimization model
        pricing_accuracy = await pricing_optimizer.retrain()

        # Retrain maintenance prediction model
        maintenance_accuracy = await maintenance_predictor.retrain()

        return {
            "retrain_completed": True,
            "model_accuracies": {
                "demand_prediction": demand_accuracy,
                "pricing_optimization": pricing_accuracy,
                "maintenance_prediction": maintenance_accuracy
            },
            "retrained_at": datetime.utcnow()
        }

    except Exception as e:
        logger.error(f"Model retraining failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Model retraining failed")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)