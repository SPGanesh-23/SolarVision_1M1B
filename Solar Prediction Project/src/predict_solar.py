import pandas as pd
import joblib

# -----------------------------
# STEP 1: LOAD TRAINED MODEL
# -----------------------------

model = joblib.load("models/solar_prediction_model.pkl")

# Load feature info if available
try:
    model_info = joblib.load("models/model_info.pkl")
    FEATURE_COLUMNS = model_info["feature_columns"]
    print(f"Model features: {FEATURE_COLUMNS}")
except:
    FEATURE_COLUMNS = [
        "temperature", "wind_speed", "humidity", "cloud_cover",
        "precipitation", "pressure", "latitude", "longitude",
        "day_of_year", "month", "hour_of_day"
    ]

# -----------------------------
# STEP 2: LOAD WEATHER FORECAST
# -----------------------------

forecast_df = pd.read_csv("data/weather_forecast.csv")

# Convert datetime
forecast_df["datetime"] = pd.to_datetime(forecast_df["datetime"])

# -----------------------------
# STEP 3: CREATE TIME FEATURES
# -----------------------------

forecast_df["day_of_year"] = forecast_df["datetime"].dt.dayofyear
forecast_df["month"] = forecast_df["datetime"].dt.month
forecast_df["hour_of_day"] = forecast_df["datetime"].dt.hour

# -----------------------------
# STEP 4: ADD MISSING FEATURES
# -----------------------------

if "precipitation" not in forecast_df.columns:
    forecast_df["precipitation"] = 0
if "pressure" not in forecast_df.columns:
    forecast_df["pressure"] = 1013

forecast_df["latitude"] = 17.3850  # Hyderabad latitude
forecast_df["longitude"] = 78.4867  # Hyderabad longitude

# -----------------------------
# STEP 5: SELECT FEATURES
# -----------------------------

X_new = forecast_df[FEATURE_COLUMNS]

# -----------------------------
# STEP 6: MAKE PREDICTIONS
# -----------------------------

predictions = model.predict(X_new)

forecast_df["predicted_solar_radiation"] = predictions

# -----------------------------
# STEP 7: SAVE RESULTS
# -----------------------------

forecast_df.to_csv("data/solar_predictions.csv", index=False)

print("Solar predictions generated successfully!")
print(f"Predictions shape: {forecast_df.shape}")
print(f"\nSample predictions:")
print(forecast_df[["datetime", "predicted_solar_radiation"]].head(10).to_string())