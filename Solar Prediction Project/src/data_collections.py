import requests
import pandas as pd
import os
from geopy.geocoders import Nominatim

# Create folders if they don't exist
os.makedirs("data", exist_ok=True)

# -----------------------------
# STEP 1: DEFINE CITIES
# -----------------------------

TARGET_CITIES = [
    "Hyderabad",
    "Chennai",
    "Mumbai",
    "Delhi",
    "Jaipur",
    "Bengaluru",
    "Kolkata"
]

geolocator = Nominatim(user_agent="solar_prediction_app_v3")

all_city_data = []
import time

for city in TARGET_CITIES:
    print(f"\nProcessing {city}...")
    
    try:
        # -----------------------------
        # STEP 2: GET CITY COORDINATES
        # -----------------------------
        location = geolocator.geocode(city)
        if not location:
            print(f"Skipping {city}: Could not geocode")
            continue
            
        lat = location.latitude
        lon = location.longitude
        
        print("City:", city)
        print("Latitude:", lat)
        print("Longitude:", lon)
        
        # ---------------------------------
        # STEP 3: DOWNLOAD NASA SOLAR DATA
        # ---------------------------------
        
        nasa_url = f"https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN,T2M,WS2M,RH2M,CLOUD_AMT,PRECTOTCORR,PS&community=RE&longitude={lon}&latitude={lat}&start=20140101&end=20240101&format=JSON"
        
        response = requests.get(nasa_url)
        data = response.json()
        
        solar_data = data["properties"]["parameter"]["ALLSKY_SFC_SW_DWN"]
        temp_data = data["properties"]["parameter"]["T2M"]
        wind_data = data["properties"]["parameter"]["WS2M"]
        humidity_data = data["properties"]["parameter"]["RH2M"]
        cloud_data = data["properties"]["parameter"]["CLOUD_AMT"]
        precip_data = data["properties"]["parameter"]["PRECTOTCORR"]
        pressure_data = data["properties"]["parameter"]["PS"]
        
        df = pd.DataFrame({
            "date": list(solar_data.keys()),
            "solar_radiation": list(solar_data.values()),
            "temperature": list(temp_data.values()),
            "wind_speed": list(wind_data.values()),
            "humidity": list(humidity_data.values()),
            "cloud_cover": list(cloud_data.values()),
            "precipitation": list(precip_data.values()),
            "pressure": list(pressure_data.values()),
            "latitude": lat,
            "longitude": lon,
            "city": city
        })
        
        all_city_data.append(df)
        print(f"NASA solar data collected for {city}!")
        
        time.sleep(1) # delay to avoid rate limits
        
    except Exception as e:
        print(f"Error processing {city}: {e}")

# Combine all datasets
if all_city_data:
    combined_df = pd.concat(all_city_data, ignore_index=True)
    combined_df.to_csv("data/nasa_solar_data.csv", index=False)
    print("\nAll NASA solar data saved to data/nasa_solar_data.csv!")
else:
    print("\nFailed to gather data for any city.")

# ---------------------------------
# STEP 4: GET WEATHER FORECAST (Default city for testing predict_solar.py)
# ---------------------------------

test_city = "Hyderabad"
location = geolocator.geocode(test_city)
lat = location.latitude
lon = location.longitude

from dotenv import load_dotenv
load_dotenv()
API_KEY = os.environ.get("OPENWEATHER_API_KEY")

weather_url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={API_KEY}&units=metric"

weather_response = requests.get(weather_url)
weather_data = weather_response.json()

forecast_list = []

for item in weather_data.get("list", []):
    forecast_list.append({
        "datetime": item["dt_txt"],
        "temperature": item["main"]["temp"],
        "humidity": item["main"]["humidity"],
        "cloud_cover": item["clouds"]["all"],
        "wind_speed": item["wind"]["speed"]
    })

forecast_df = pd.DataFrame(forecast_list)

forecast_df.to_csv("data/weather_forecast.csv", index=False)

print(f"Weather forecast saved for test city ({test_city})!")
print("Data collection completed!")