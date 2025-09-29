import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
from datetime import datetime, timedelta
import logging
from typing import Dict, Any, Tuple, List

logger = logging.getLogger(__name__)

class DemandPredictor:
    """ML model for predicting EV charging demand."""

    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.feature_importance = {}
        self.model_accuracy = {}
        self.confidence_interval = (0.8, 0.95)
        self.is_trained = False

    def prepare_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """Prepare features for demand prediction."""
        features = data.copy()

        # Time-based features
        features['hour'] = pd.to_datetime(features['timestamp']).dt.hour
        features['day_of_week'] = pd.to_datetime(features['timestamp']).dt.dayofweek
        features['month'] = pd.to_datetime(features['timestamp']).dt.month
        features['is_weekend'] = features['day_of_week'].isin([5, 6]).astype(int)

        # Cyclical encoding for time features
        features['hour_sin'] = np.sin(2 * np.pi * features['hour'] / 24)
        features['hour_cos'] = np.cos(2 * np.pi * features['hour'] / 24)
        features['day_sin'] = np.sin(2 * np.pi * features['day_of_week'] / 7)
        features['day_cos'] = np.cos(2 * np.pi * features['day_of_week'] / 7)

        # Lag features
        features['demand_lag_1h'] = features['demand'].shift(1)
        features['demand_lag_24h'] = features['demand'].shift(24)
        features['demand_lag_168h'] = features['demand'].shift(168)  # 1 week

        # Rolling averages
        features['demand_ma_24h'] = features['demand'].rolling(window=24).mean()
        features['demand_ma_168h'] = features['demand'].rolling(window=168).mean()

        # Weather features (if available)
        if 'temperature' in features.columns:
            features['temp_normalized'] = (features['temperature'] - features['temperature'].mean()) / features['temperature'].std()

        if 'weather_condition' in features.columns:
            # One-hot encode weather conditions
            weather_dummies = pd.get_dummies(features['weather_condition'], prefix='weather')
            features = pd.concat([features, weather_dummies], axis=1)

        # Station-specific features
        if 'station_utilization' in features.columns:
            features['utilization_normalized'] = features['station_utilization'] / 100

        # Special events/holidays (simplified)
        features['is_holiday'] = 0  # Implement holiday detection logic

        # Remove non-feature columns
        feature_cols = [col for col in features.columns if col not in ['timestamp', 'demand', 'station_id']]

        return features[feature_cols].fillna(0)

    def train(self, data: pd.DataFrame) -> Dict[str, float]:
        """Train the demand prediction model."""
        try:
            logger.info("Starting demand prediction model training")

            # Prepare features and target
            X = self.prepare_features(data)
            y = data['demand'].values

            # Remove rows with NaN targets
            valid_mask = ~np.isnan(y)
            X = X[valid_mask]
            y = y[valid_mask]

            if len(X) < 100:
                raise ValueError("Insufficient training data")

            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42, shuffle=False
            )

            # Scale features
            X_train_scaled = self.scaler.fit_transform(X_train)
            X_test_scaled = self.scaler.transform(X_test)

            # Train ensemble model
            rf_model = RandomForestRegressor(
                n_estimators=100,
                max_depth=10,
                random_state=42,
                n_jobs=-1
            )

            gb_model = GradientBoostingRegressor(
                n_estimators=100,
                max_depth=6,
                random_state=42
            )

            # Train models
            rf_model.fit(X_train_scaled, y_train)
            gb_model.fit(X_train_scaled, y_train)

            # Ensemble predictions
            rf_pred = rf_model.predict(X_test_scaled)
            gb_pred = gb_model.predict(X_test_scaled)
            ensemble_pred = 0.6 * rf_pred + 0.4 * gb_pred

            # Calculate metrics
            mae = mean_absolute_error(y_test, ensemble_pred)
            rmse = np.sqrt(mean_squared_error(y_test, ensemble_pred))
            r2 = r2_score(y_test, ensemble_pred)

            # Store ensemble weights and models
            self.model = {
                'rf_model': rf_model,
                'gb_model': gb_model,
                'rf_weight': 0.6,
                'gb_weight': 0.4
            }

            # Feature importance
            self.feature_importance = dict(zip(
                X.columns,
                0.6 * rf_model.feature_importances_ + 0.4 * gb_model.feature_importances_
            ))

            self.model_accuracy = {
                'mae': mae,
                'rmse': rmse,
                'r2_score': r2,
                'mape': np.mean(np.abs((y_test - ensemble_pred) / y_test)) * 100
            }

            self.is_trained = True

            logger.info(f"Model training completed. R2: {r2:.3f}, RMSE: {rmse:.3f}")
            return self.model_accuracy

        except Exception as e:
            logger.error(f"Model training failed: {str(e)}")
            raise

    def predict(self,
                historical_data: pd.DataFrame,
                start_date: datetime,
                end_date: datetime,
                features: Dict[str, Any] = None) -> pd.DataFrame:
        """Predict demand for a given time period."""

        if not self.is_trained or self.model is None:
            raise ValueError("Model not trained. Call train() first.")

        try:
            # Generate prediction timestamps
            timestamps = pd.date_range(start=start_date, end=end_date, freq='H')

            # Create base prediction dataframe
            pred_df = pd.DataFrame({'timestamp': timestamps})

            # Add features from historical data pattern
            for ts in timestamps:
                # Find similar historical patterns
                hour = ts.hour
                day_of_week = ts.weekday()

                historical_similar = historical_data[
                    (pd.to_datetime(historical_data['timestamp']).dt.hour == hour) &
                    (pd.to_datetime(historical_data['timestamp']).dt.dayofweek == day_of_week)
                ]

                if not historical_similar.empty:
                    avg_demand = historical_similar['demand'].mean()
                    pred_df.loc[pred_df['timestamp'] == ts, 'demand'] = avg_demand
                else:
                    pred_df.loc[pred_df['timestamp'] == ts, 'demand'] = historical_data['demand'].mean()

            # Add external features if provided
            if features:
                for key, value in features.items():
                    pred_df[key] = value

            # Prepare features for prediction
            X_pred = self.prepare_features(pred_df)
            X_pred_scaled = self.scaler.transform(X_pred)

            # Make ensemble predictions
            rf_pred = self.model['rf_model'].predict(X_pred_scaled)
            gb_pred = self.model['gb_model'].predict(X_pred_scaled)
            predictions = (self.model['rf_weight'] * rf_pred +
                          self.model['gb_weight'] * gb_pred)

            # Add predictions to dataframe
            pred_df['predicted_demand'] = predictions

            # Calculate confidence intervals (simplified)
            prediction_std = np.std(predictions) * 0.1  # Simplified confidence calculation
            pred_df['lower_bound'] = predictions - 1.96 * prediction_std
            pred_df['upper_bound'] = predictions + 1.96 * prediction_std

            return pred_df[['timestamp', 'predicted_demand', 'lower_bound', 'upper_bound']]

        except Exception as e:
            logger.error(f"Prediction failed: {str(e)}")
            raise

    def get_feature_importance(self) -> Dict[str, float]:
        """Get feature importance scores."""
        return self.feature_importance

    def get_model_accuracy(self) -> Dict[str, float]:
        """Get model accuracy metrics."""
        return self.model_accuracy

    def get_confidence_interval(self) -> Tuple[float, float]:
        """Get confidence interval."""
        return self.confidence_interval

    async def retrain(self) -> Dict[str, float]:
        """Retrain model with latest data."""
        # In a real implementation, this would fetch latest data from database
        # For now, return current accuracy
        return self.model_accuracy

    def save_model(self, filepath: str):
        """Save trained model to file."""
        if self.model:
            joblib.dump({
                'model': self.model,
                'scaler': self.scaler,
                'feature_importance': self.feature_importance,
                'model_accuracy': self.model_accuracy
            }, filepath)

    def load_model(self, filepath: str):
        """Load trained model from file."""
        model_data = joblib.load(filepath)
        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.feature_importance = model_data['feature_importance']
        self.model_accuracy = model_data['model_accuracy']
        self.is_trained = True