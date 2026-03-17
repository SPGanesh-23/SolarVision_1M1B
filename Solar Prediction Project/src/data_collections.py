import requests
import pandas as pd
import os
from geopy.geocoders import Nominatim

# Create folders if they don't exist
os.makedirs("data", exist_ok=True)

# -----------------------------
# STEP 1: GET CITY COORDINATES
# -----------------------------

city = "Hyderabad"

geolocator = Nominatim(user_agent="solar_prediction_app")
location = geolocator.geocode(city)

lat = location.latitude
lon = location.longitude

print("City:", city)
print("Latitude:", lat)
print("Longitude:", lon)

# ---------------------------------
# STEP 2: DOWNLOAD NASA SOLAR DATA
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
    "date": solar_data.keys(),
    "solar_radiation": solar_data.values(),
    "temperature": temp_data.values(),
    "wind_speed": wind_data.values(),
    "humidity": humidity_data.values(),
    "cloud_cover": cloud_data.values(),
    "precipitation": precip_data.values(),
    "pressure": pressure_data.values(),
    "latitude": lat,
    "longitude": lon
})

df.to_csv("data/nasa_solar_data.csv", index=False)

print("NASA solar data saved!")

# ---------------------------------
# STEP 3: GET WEATHER FORECAST
# ---------------------------------

API_KEY = "11a738ef47063222b2d5e25d33034760"

weather_url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={API_KEY}&units=metric"

weather_response = requests.get(weather_url)
weather_data = weather_response.json()

forecast_list = []

for item in weather_data["list"]:
    forecast_list.append({
        "datetime": item["dt_txt"],
        "temperature": item["main"]["temp"],
        "humidity": item["main"]["humidity"],
        "cloud_cover": item["clouds"]["all"],
        "wind_speed": item["wind"]["speed"]
    })

forecast_df = pd.DataFrame(forecast_list)

forecast_df.to_csv("data/weather_forecast.csv", index=False)

print("Weather forecast saved!")
print("Data collection completed!")