"""
ML prediction module for Solar Power Prediction App.
Handles model loading and solar radiation predictions.
"""

import joblib
import pandas as pd
import numpy as np
import os
import math

# Load model at module import
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "..", "models", "solar_prediction_model.pkl")
INFO_PATH = os.path.join(BASE_DIR, "..", "models", "model_info.pkl")

model = joblib.load(MODEL_PATH)

try:
    model_info = joblib.load(INFO_PATH)
    FEATURE_COLUMNS = model_info["feature_columns"]
except:
    FEATURE_COLUMNS = [
        "temperature", "wind_speed", "humidity", "cloud_cover",
        "precipitation", "pressure", "latitude", "longitude",
        "day_of_year", "month", "hour_of_day"
    ]

# NASA data is in kWh/m²/day — we convert to W/m² for instantaneous
# Average daily irradiance: solar_radiation (kWh/m²/day) * 1000 / daylight_hours
# Typical daylight: ~10-14 hours depending on latitude & season


def _get_daylight_hours(lat, day_of_year):
    """Estimate daylight hours based on latitude and day of year."""
    # Declination angle
    declination = 23.45 * math.sin(math.radians(360 / 365 * (284 + day_of_year)))
    lat_rad = math.radians(lat)
    decl_rad = math.radians(declination)

    # Hour angle at sunrise/sunset
    cos_hour = -math.tan(lat_rad) * math.tan(decl_rad)
    cos_hour = max(-1, min(1, cos_hour))  # clamp

    hour_angle = math.degrees(math.acos(cos_hour))
    daylight = 2 * hour_angle / 15  # hours
    return max(daylight, 1)  # at least 1 hour


def _solar_hour_weight(hour, sunrise_hour, sunset_hour):
    """
    Bell-curve weighting for solar radiation throughout the day.
    Returns 0 for nighttime, peaks at solar noon.
    """
    if hour < sunrise_hour or hour > sunset_hour:
        return 0

    solar_noon = (sunrise_hour + sunset_hour) / 2
    half_day = (sunset_hour - sunrise_hour) / 2

    if half_day <= 0:
        return 0

    # Cosine-shaped bell curve
    normalized = (hour - solar_noon) / half_day
    weight = math.cos(normalized * math.pi / 2) ** 2
    return max(0, weight)


def predict_radiation(weather_data, lat, lon, day_of_year, month, hour_of_day, city="Unknown"):
    """
    Predict solar radiation for a single data point.
    Returns W/m² (converted from model's kWh/m²/day output).
    """
    data = pd.DataFrame([{
        "temperature": weather_data["temperature"],
        "wind_speed": weather_data["wind_speed"],
        "humidity": weather_data["humidity"],
        "cloud_cover": weather_data["cloud_cover"],
        "precipitation": weather_data.get("precipitation", 0),
        "pressure": weather_data.get("pressure", 1013),
        "latitude": lat,
        "longitude": lon,
        "day_of_year": day_of_year,
        "month": month,
        "hour_of_day": hour_of_day,
        "city": city
    }])

    # Apply one-hot encoding for city and ensure all feature columns match
    data = pd.get_dummies(data, columns=["city"], drop_first=False)
    for col in FEATURE_COLUMNS:
        if col not in data.columns:
            data[col] = 0
    data = data[FEATURE_COLUMNS]

    # Model predicts kWh/m²/day (daily average)
    daily_avg = model.predict(data)[0]
    daily_avg = max(0, daily_avg)  # no negative radiation

    # Convert to instantaneous W/m²
    daylight_hours = _get_daylight_hours(lat, day_of_year)
    sunrise_hour = 12 - daylight_hours / 2
    sunset_hour = 12 + daylight_hours / 2

    # Apply solar hour weighting
    weight = _solar_hour_weight(hour_of_day, sunrise_hour, sunset_hour)

    # Convert to W/m²:
    # daily_avg kWh/m²/day * 1000 W/kW / daylight_hours * normalization_factor * weight
    # The normalization factor accounts for the bell curve integral
    if weight > 0:
        # Peak irradiance factor (integral of cos^2 over daylight = daylight/2)
        peak_factor = 2.0  # because integral of cos^2 bell = half the period
        radiation_wm2 = daily_avg * 1000 / daylight_hours * peak_factor * weight
    else:
        radiation_wm2 = 0

    return round(radiation_wm2, 2)


def predict_hourly(forecast_data, lat, lon, city="Unknown"):
    """
    Generate hourly solar radiation predictions for forecast data.
    Returns list of dicts with datetime, radiation, and weather info.
    """
    from datetime import datetime

    results = []
    for point in forecast_data:
        dt = datetime.strptime(point["datetime"], "%Y-%m-%d %H:%M:%S")
        day_of_year = dt.timetuple().tm_yday
        month = dt.month
        hour = dt.hour

        radiation = predict_radiation(
            weather_data=point,
            lat=lat, lon=lon,
            day_of_year=day_of_year,
            month=month,
            hour_of_day=hour,
            city=city
        )

        results.append({
            "datetime": point["datetime"],
            "hour": hour,
            "day_of_year": day_of_year,
            "radiation_wm2": radiation,
            "temperature": round(point["temperature"], 1),
            "cloud_cover": round(point["cloud_cover"], 1),
            "humidity": round(point["humidity"], 1),
            "wind_speed": round(point["wind_speed"], 1),
            "weather_main": point.get("weather_main", "Clear"),
            "weather_icon": point.get("weather_icon", "01d"),
        })

    return results
