import pandas as pd
import numpy as np

# Load NASA dataset
df = pd.read_csv("data/nasa_solar_data.csv")

# Convert date column
df["date"] = pd.to_datetime(df["date"], format="%Y%m%d")

# -----------------------------
# CREATE TIME FEATURES
# -----------------------------

df["day_of_year"] = df["date"].dt.dayofyear
df["month"] = df["date"].dt.month

# Add hour_of_day feature (daily data = noon average, set to 12)
df["hour_of_day"] = 12

# Add longitude if not present (Hyderabad default)
if "longitude" not in df.columns:
    df["longitude"] = 78.4867

# Replace missing values
df.replace(-999, None, inplace=True)

# Drop missing rows
df = df.dropna()

# Select features
df = df[[
    "solar_radiation",
    "temperature",
    "wind_speed",
    "humidity",
    "cloud_cover",
    "precipitation",
    "pressure",
    "latitude",
    "longitude",
    "day_of_year",
    "month",
    "hour_of_day",
    "city"
]]

df.to_csv("data/clean_solar_dataset.csv", index=False)

print(f"Dataset prepared! Shape: {df.shape}")
print(f"Features: {list(df.columns)}")
print("Dataset prepared for machine learning!")