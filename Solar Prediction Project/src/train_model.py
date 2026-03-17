import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor, VotingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import numpy as np
import joblib
import os

# Try to use XGBoost if available, otherwise fall back to GradientBoosting
try:
    from xgboost import XGBRegressor
    HAS_XGBOOST = True
    print("Using XGBoost + RandomForest ensemble")
except ImportError:
    from sklearn.ensemble import GradientBoostingRegressor
    HAS_XGBOOST = False
    print("XGBoost not available, using GradientBoosting + RandomForest ensemble")

# -----------------------------
# STEP 1: LOAD CLEAN DATASET
# -----------------------------

df = pd.read_csv("data/clean_solar_dataset.csv")

print(f"Dataset shape: {df.shape}")
print(f"Columns: {list(df.columns)}")

# -----------------------------
# STEP 2: DEFINE FEATURES & TARGET
# -----------------------------

FEATURE_COLUMNS = [
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
    "hour_of_day"
]

# Handle case where new columns might not exist yet
for col in FEATURE_COLUMNS:
    if col not in df.columns:
        if col == "longitude":
            df["longitude"] = 78.4867  # Hyderabad default
        elif col == "hour_of_day":
            df["hour_of_day"] = 12  # Daily average = noon

X = df[FEATURE_COLUMNS]
y = df["solar_radiation"]

# -----------------------------
# STEP 3: TRAIN TEST SPLIT
# -----------------------------

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

print(f"Training samples: {len(X_train)}")
print(f"Testing samples: {len(X_test)}")

# -----------------------------
# STEP 4: CREATE ENSEMBLE MODEL
# -----------------------------

rf_model = RandomForestRegressor(
    n_estimators=200,
    max_depth=20,
    min_samples_split=5,
    random_state=42,
    n_jobs=-1
)

if HAS_XGBOOST:
    boost_model = XGBRegressor(
        n_estimators=200,
        max_depth=8,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1
    )
else:
    boost_model = GradientBoostingRegressor(
        n_estimators=200,
        max_depth=8,
        learning_rate=0.1,
        subsample=0.8,
        random_state=42
    )

model = VotingRegressor(
    estimators=[
        ("rf", rf_model),
        ("boost", boost_model)
    ]
)

# -----------------------------
# STEP 5: TRAIN MODEL
# -----------------------------

print("Training ensemble model...")
model.fit(X_train, y_train)
print("Training complete!")

# -----------------------------
# STEP 6: MAKE PREDICTIONS
# -----------------------------

predictions = model.predict(X_test)

# -----------------------------
# STEP 7: EVALUATE MODEL
# -----------------------------

mae = mean_absolute_error(y_test, predictions)
rmse = np.sqrt(mean_squared_error(y_test, predictions))
r2 = r2_score(y_test, predictions)
target_mean = y.mean()

print("\n" + "=" * 50)
print("MODEL EVALUATION RESULTS")
print("=" * 50)
print(f"Mean Absolute Error (MAE):      {mae:.4f} kWh/m²/day")
print(f"Root Mean Squared Error (RMSE):  {rmse:.4f} kWh/m²/day")
print(f"R² Score:                        {r2:.4f}")
print(f"Mean of Target Variable:         {target_mean:.4f} kWh/m²/day")
print(f"MAE as % of Mean:                {(mae/target_mean)*100:.2f}%")
print("=" * 50)

# Save feature column names for reference
feature_info = {
    "feature_columns": FEATURE_COLUMNS,
    "n_features": len(FEATURE_COLUMNS),
    "target_mean": target_mean,
    "mae": mae,
    "rmse": rmse,
    "r2": r2
}

# -----------------------------
# STEP 8: SAVE MODEL
# -----------------------------

os.makedirs("models", exist_ok=True)
joblib.dump(model, "models/solar_prediction_model.pkl")
joblib.dump(feature_info, "models/model_info.pkl")

print("\nModel saved successfully!")
print(f"Feature columns: {FEATURE_COLUMNS}")