"""
Weather API integration module for Solar Power Prediction App.
Handles OpenWeatherMap API calls, geocoding, and caching.
"""

import requests
from geopy.geocoders import Nominatim
from datetime import datetime, timedelta
from functools import lru_cache
import time
import json

API_KEY = "11a738ef47063222b2d5e25d33034760"

# --- City coordinate cache ---
_geo_cache = {}

# --- API response cache (30-min TTL) ---
_weather_cache = {}
_CACHE_TTL = 1800  # 30 minutes


def geocode_city(city_name):
    """Get latitude and longitude for a city name."""
    city_key = city_name.strip().lower()
    if city_key in _geo_cache:
        return _geo_cache[city_key]

    try:
        geolocator = Nominatim(user_agent="solar_prediction_app_v2", timeout=10)
        location = geolocator.geocode(city_name)
        if location is None:
            return None
        result = {
            "lat": location.latitude,
            "lon": location.longitude,
            "display_name": location.address
        }
        _geo_cache[city_key] = result
        return result
    except Exception as e:
        print(f"Geocoding error: {e}")
        return None


def reverse_geocode(lat, lon):
    """Convert latitude/longitude into a city name and display address."""
    cache_key = f"rev_{lat:.4f}_{lon:.4f}"
    if cache_key in _geo_cache:
        return _geo_cache[cache_key]

    try:
        geolocator = Nominatim(user_agent="solar_prediction_app_v2", timeout=10)
        location = geolocator.reverse((lat, lon), exactly_one=True, language="en")
        if location is None:
            return {"city": f"{lat:.4f}, {lon:.4f}", "display_name": f"{lat:.4f}, {lon:.4f}"}

        address = location.raw.get("address", {})
        # Try to extract city name from address components
        city = (
            address.get("city")
            or address.get("town")
            or address.get("village")
            or address.get("county")
            or address.get("state")
            or f"{lat:.4f}, {lon:.4f}"
        )
        result = {
            "city": city,
            "display_name": location.address,
        }
        _geo_cache[cache_key] = result
        return result
    except Exception as e:
        print(f"Reverse geocoding error: {e}")
        return {"city": f"{lat:.4f}, {lon:.4f}", "display_name": f"{lat:.4f}, {lon:.4f}"}


def _get_cached(cache_key):
    """Get cached API response if it's still fresh."""
    if cache_key in _weather_cache:
        data, timestamp = _weather_cache[cache_key]
        if time.time() - timestamp < _CACHE_TTL:
            return data
        else:
            del _weather_cache[cache_key]
    return None


def _set_cache(cache_key, data):
    """Store API response in cache."""
    _weather_cache[cache_key] = (data, time.time())


def get_current_weather(lat, lon):
    """Fetch current weather data from OpenWeatherMap."""
    cache_key = f"current_{lat:.2f}_{lon:.2f}"
    cached = _get_cached(cache_key)
    if cached:
        return cached

    try:
        url = (
            f"https://api.openweathermap.org/data/2.5/weather"
            f"?lat={lat}&lon={lon}&appid={API_KEY}&units=metric"
        )
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()

        result = {
            "temperature": data["main"]["temp"],
            "humidity": data["main"]["humidity"],
            "pressure": data["main"]["pressure"],
            "wind_speed": data["wind"]["speed"],
            "cloud_cover": data["clouds"]["all"],
            "precipitation": data.get("rain", {}).get("1h", 0),
            "weather_main": data["weather"][0]["main"],
            "weather_icon": data["weather"][0]["icon"],
            "weather_description": data["weather"][0]["description"],
            "dt": data["dt"],
            "timezone_offset": data["timezone"]
        }
        _set_cache(cache_key, result)
        return result
    except requests.RequestException as e:
        print(f"Current weather API error: {e}")
        return None
    except (KeyError, IndexError) as e:
        print(f"Weather data parsing error: {e}")
        return None


def get_forecast(lat, lon):
    """
    Fetch 5-day/3-hour forecast from OpenWeatherMap free tier.
    Interpolates to hourly intervals.
    Returns list of hourly weather dicts.
    """
    cache_key = f"forecast_{lat:.2f}_{lon:.2f}"
    cached = _get_cached(cache_key)
    if cached:
        return cached

    try:
        url = (
            f"https://api.openweathermap.org/data/2.5/forecast"
            f"?lat={lat}&lon={lon}&appid={API_KEY}&units=metric"
        )
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()

        # Timezone offset in seconds
        tz_offset = data.get("city", {}).get("timezone", 0)

        # Parse 3-hour intervals
        raw_points = []
        for item in data["list"]:
            local_dt = item["dt"] + tz_offset
            raw_points.append({
                "dt": local_dt,
                "datetime": datetime.utcfromtimestamp(local_dt).strftime("%Y-%m-%d %H:%M:%S"),
                "temperature": item["main"]["temp"],
                "humidity": item["main"]["humidity"],
                "pressure": item["main"]["pressure"],
                "wind_speed": item["wind"]["speed"],
                "cloud_cover": item["clouds"]["all"],
                "precipitation": item.get("rain", {}).get("3h", 0) / 3,  # per hour
                "weather_main": item["weather"][0]["main"],
                "weather_icon": item["weather"][0]["icon"],
            })

        # Interpolate to hourly
        hourly = _interpolate_to_hourly(raw_points)
        _set_cache(cache_key, hourly)
        return hourly

    except requests.RequestException as e:
        print(f"Forecast API error: {e}")
        return None
    except (KeyError, IndexError) as e:
        print(f"Forecast data parsing error: {e}")
        return None


def _interpolate_to_hourly(raw_points):
    """Linearly interpolate 3-hour forecast data to hourly."""
    if not raw_points or len(raw_points) < 2:
        return raw_points

    numeric_fields = ["temperature", "humidity", "pressure", "wind_speed",
                       "cloud_cover", "precipitation"]
    hourly = []

    for i in range(len(raw_points) - 1):
        p1 = raw_points[i]
        p2 = raw_points[i + 1]
        dt1 = p1["dt"]
        dt2 = p2["dt"]
        gap_hours = (dt2 - dt1) // 3600

        for h in range(gap_hours):
            frac = h / gap_hours
            interpolated = {
                "dt": dt1 + h * 3600,
                "datetime": datetime.utcfromtimestamp(dt1 + h * 3600).strftime("%Y-%m-%d %H:%M:%S"),
                "weather_main": p1["weather_main"],
                "weather_icon": p1["weather_icon"],
            }
            for field in numeric_fields:
                interpolated[field] = p1[field] + frac * (p2[field] - p1[field])
            hourly.append(interpolated)

    # Add last point
    hourly.append(raw_points[-1])
    return hourly


# --- Supported cities for autocomplete ---
POPULAR_CITIES = [
    "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai",
    "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Lucknow",
    "Surat", "Nagpur", "Indore", "Bhopal", "Visakhapatnam",
    "Coimbatore", "Thiruvananthapuram", "Madurai", "Thoothukudi",
    "Chandigarh", "Guwahati", "Patna", "Ranchi", "Bhubaneswar",
    "New York", "London", "Tokyo", "Sydney", "Dubai",
    "Singapore", "Berlin", "Paris", "Los Angeles", "San Francisco",
    "Cairo", "Nairobi", "Cape Town", "São Paulo", "Toronto",
    "Beijing", "Shanghai", "Seoul", "Bangkok", "Jakarta",
]


def search_cities(query):
    """Return matching city names for autocomplete."""
    if not query or len(query) < 2:
        return []
    query_lower = query.lower()
    return [c for c in POPULAR_CITIES if query_lower in c.lower()][:10]
