from flask import Flask, render_template, request, jsonify, Response
import os
import io
import csv
from datetime import datetime, timezone

from weather_api import geocode_city, reverse_geocode, get_current_weather, get_forecast, search_cities
from predictor import predict_radiation, predict_hourly
from metrics import compute_full_metrics, calculate_panel_power, calculate_panel_irradiance

# ── NEW ── Import billing module (place billing.py in the same folder as app.py)
from billing import calculate_bill, get_discom_list

# ── DATABASE ── Import the db engine + our 3 table models
from models import db, Session, Prediction, BillCalculation

app = Flask(__name__)

# ── DATABASE CONFIG ──
# This tells SQLAlchemy: "store everything in a file called solarvista.db
# in the same folder as app.py". SQLite creates this file automatically.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{os.path.join(BASE_DIR, 'solarvista.db')}"

# Turn off a noisy warning about tracking every object change — we don't need it
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Connect the db engine (from models.py) to this Flask app
db.init_app(app)

# Create all tables defined in models.py (sessions, predictions, bill_calculations)
# This is safe to call multiple times — it skips tables that already exist.
with app.app_context():
    db.create_all()


# ── SESSION HELPER ──
# The frontend generates a random UUID and sends it as a header on every request.
# This function finds the matching session in the DB, or creates a new one.
def _get_or_create_session():
    """
    Look up the user's session by the 'X-Session-Token' header.
    Returns a Session object, or None if no token was sent.
    """
    token = request.headers.get("X-Session-Token")
    if not token:
        return None  # no token = no history, but predictions still work fine

    session_obj = Session.query.filter_by(session_token=token).first()
    if not session_obj:
        # First time seeing this token → create a new session row
        session_obj = Session(session_token=token)
        db.session.add(session_obj)
        db.session.commit()
    else:
        # Returning user → update their "last seen" timestamp
        session_obj.last_active = datetime.now(timezone.utc)
        db.session.commit()

    return session_obj


# -----------------------------
# ROUTE: HOME PAGE
# -----------------------------
@app.route("/")
def home():
    return render_template("index.html")


# -----------------------------
# ROUTE: PREDICT (JSON API)
# -----------------------------
@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Invalid or missing JSON payload"}), 400

        # Validate inputs
        city = data.get("city", "").strip()
        input_lat = data.get("lat")
        input_lon = data.get("lon")

        panel_specs = data.get("panel_specs", {})

        try:
            panel_area = float(panel_specs.get("area_m2", 1.6))
            panel_efficiency = float(panel_specs.get("efficiency_pct", 18.0))
            panel_tilt = float(panel_specs.get("tilt_deg", 30))
            panel_azimuth = float(panel_specs.get("azimuth_deg", 180))
            forecast_days = int(data.get("forecast_days", 3))
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid numeric input"}), 400

        # Validate ranges
        if not (0.1 <= panel_area <= 10000):
            return jsonify({"error": "Panel area must be between 0.1 and 10000 m²"}), 400
        if not (1 <= panel_efficiency <= 50):
            return jsonify({"error": "Panel efficiency must be between 1% and 50%"}), 400
        if not (0 <= panel_tilt <= 90):
            return jsonify({"error": "Panel tilt must be between 0° and 90°"}), 400
        if forecast_days not in [1, 3, 5]:
            forecast_days = 3

        # Determine lat/lon — prefer direct coordinates from map, fallback to geocoding city
        if input_lat is not None and input_lon is not None:
            try:
                lat = float(input_lat)
                lon = float(input_lon)
            except (ValueError, TypeError):
                return jsonify({"error": "Invalid latitude/longitude values"}), 400
            if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
                return jsonify({"error": "Latitude must be -90 to 90, longitude -180 to 180"}), 400
            # If no city name provided, reverse geocode to get one
            if not city:
                rev = reverse_geocode(lat, lon)
                city = rev["city"]
                display_name = rev["display_name"]
            else:
                display_name = city
        elif city:
            # Fallback: geocode from city name (existing behavior)
            location = geocode_city(city)
            if location is None:
                return jsonify({"error": f"City '{city}' not found. Please check the spelling."}), 404
            lat = location["lat"]
            lon = location["lon"]
            display_name = location["display_name"]
        else:
            return jsonify({"error": "Please select a location on the map or enter a city name."}), 400

        # Get current weather
        current_weather = get_current_weather(lat, lon)
        if current_weather is None:
            return jsonify({"error": "Failed to fetch weather data. Please try again."}), 502

        # Get forecast
        forecast = get_forecast(lat, lon)
        if forecast is None:
            return jsonify({"error": "Failed to fetch forecast data. Please try again."}), 502

        # Filter forecast to requested days
        max_hours = forecast_days * 24
        forecast = forecast[:max_hours]

        # Current prediction
        now = datetime.now(timezone.utc)

        # Calculate local hour, wrapping around 24 hours
        local_hour_float = (now.hour + now.minute / 60.0 + (current_weather.get("timezone_offset", 0) / 3600)) % 24

        current_radiation = predict_radiation(
            weather_data=current_weather,
            lat=lat, lon=lon,
            day_of_year=now.timetuple().tm_yday,
            month=now.month,
            hour_of_day=local_hour_float,
            city=city
        )

        current_power = calculate_panel_power(current_radiation, panel_area, panel_efficiency, panel_tilt, panel_azimuth)
        current_irradiance = calculate_panel_irradiance(current_radiation, panel_tilt, panel_azimuth)

        # Hourly predictions
        hourly_predictions = predict_hourly(forecast, lat, lon, city=city)

        # Add panel metrics to hourly
        for point in hourly_predictions:
            point["panel_power_w"] = calculate_panel_power(
                point["radiation_wm2"], panel_area, panel_efficiency, panel_tilt, panel_azimuth
            )
            point["energy_wh"] = point["panel_power_w"]  # 1-hour interval

        # Compute full metrics
        full_metrics = compute_full_metrics(
            hourly_predictions, panel_area, panel_efficiency, panel_tilt, panel_azimuth
        )

        # Override current with actual current weather data
        full_metrics["current"] = {
            "radiation_wm2": round(current_radiation, 2),
            "panel_irradiance_wm2": round(current_irradiance, 2),
            "panel_power_w": current_power,
            "weather": {
                "main": current_weather["weather_main"],
                "icon": current_weather["weather_icon"],
                "description": current_weather["weather_description"],
                "temperature": current_weather["temperature"],
            }
        }

        # Location info
        full_metrics["location"] = {
            "city": city,
            "display_name": display_name,
            "lat": round(lat, 4),
            "lon": round(lon, 4),
        }

        full_metrics["panel_specs"] = {
            "area_m2": panel_area,
            "efficiency_pct": panel_efficiency,
            "tilt_deg": panel_tilt,
            "azimuth_deg": panel_azimuth,
        }

        # ── NEW ── Extrapolate a monthly solar kWh estimate from the forecast window.
        # Divides total forecast energy (kWh) by the number of days, then scales to 30 days.
        # This is appended to the existing response so the bill calculator frontend can
        # auto-fill its "Monthly Solar Generation" field right after a prediction runs.
        total_kwh = full_metrics.get("total", {}).get("energy_kwh", 0)
        full_metrics["monthly_solar_kwh"] = round((total_kwh / forecast_days) * 30, 2)

        # ── SAVE TO DATABASE ──
        # Look up the user's session (from the X-Session-Token header).
        # If they have one, save this prediction so they can see it in history later.
        # If they don't have a token (old frontend, curl, etc.), just skip saving.
        user_session = _get_or_create_session()
        if user_session:
            prediction = Prediction(
                session_id=user_session.id,

                # What the user asked for (inputs)
                city=city,
                lat=lat,
                lon=lon,
                panel_area_m2=panel_area,
                panel_efficiency_pct=panel_efficiency,
                panel_tilt_deg=panel_tilt,
                panel_azimuth_deg=panel_azimuth,
                forecast_days=forecast_days,

                # Key results (extracted for fast queries)
                current_radiation_wm2=full_metrics["current"]["radiation_wm2"],
                current_power_w=full_metrics["current"]["panel_power_w"],
                total_energy_kwh=full_metrics.get("total", {}).get("energy_kwh", 0),
                monthly_solar_kwh=full_metrics.get("monthly_solar_kwh", 0),
                co2_savings_kg=full_metrics.get("total", {}).get("co2_savings_kg", 0),
                peak_power_w=full_metrics.get("total", {}).get("peak_power_w", 0),

                # The entire response as JSON (safety net for future features)
                hourly_data=full_metrics.get("hourly"),
                daily_data=full_metrics.get("daily"),
                full_response=full_metrics,
            )
            db.session.add(prediction)      # stage it
            db.session.commit()             # write to solarvista.db

            # Include the prediction ID in the response so the frontend
            # can reference it later (e.g., link a bill calculation to it)
            full_metrics["prediction_id"] = prediction.id

        return jsonify(full_metrics)

    except Exception as e:
        print(f"Prediction error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred. Please try again."}), 500


# -----------------------------
# ROUTE: CITY AUTOCOMPLETE
# -----------------------------
@app.route("/cities")
def cities():
    query = request.args.get("q", "")
    results = search_cities(query)
    return jsonify(results)


# -----------------------------
# ROUTE: CSV DOWNLOAD
# -----------------------------
@app.route("/download/csv", methods=["POST"])
def download_csv():
    try:
        data = request.get_json(silent=True) or {}
        hourly = data.get("hourly", [])
        daily = data.get("daily", [])
        city = data.get("city", "Unknown")
        total = data.get("total", {})

        output = io.StringIO()
        writer = csv.writer(output)

        # Header info
        writer.writerow(["Solar Power Prediction Report"])
        writer.writerow([f"City: {city}"])
        writer.writerow([f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"])
        writer.writerow([f"Total Energy: {total.get('energy_kwh', 0)} kWh"])
        writer.writerow([f"CO2 Savings: {total.get('co2_savings_kg', 0)} kg"])
        writer.writerow([])

        # Hourly data
        writer.writerow(["Hourly Forecast"])
        writer.writerow(["DateTime", "Radiation (W/m²)", "Panel Power (W)",
                          "Energy (Wh)", "Temperature (°C)", "Cloud Cover (%)",
                          "Weather"])

        for point in hourly:
            writer.writerow([
                point.get("datetime", ""),
                point.get("radiation_wm2", 0),
                point.get("panel_power_w", 0),
                point.get("energy_wh", 0),
                point.get("temperature", ""),
                point.get("cloud_cover", ""),
                point.get("weather_main", ""),
            ])

        writer.writerow([])

        # Daily summary
        writer.writerow(["Daily Summary"])
        writer.writerow(["Date", "Energy (Wh)", "Energy (kWh)", "CO2 Savings (kg)", "Peak Hour"])

        for day in daily:
            peak = day.get("peak_hour", {})
            writer.writerow([
                day.get("date", ""),
                day.get("daily_energy_wh", 0),
                day.get("daily_energy_kwh", 0),
                day.get("co2_savings_kg", 0),
                f"{peak.get('hour', 'N/A')}:00" if peak else "N/A",
            ])

        csv_content = output.getvalue()
        output.close()

        return Response(
            csv_content,
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment; filename=solar_forecast_{city.replace(' ', '_')}.csv"}
        )

    except Exception as e:
        print(f"CSV download error: {e}")
        return jsonify({"error": "Failed to generate CSV"}), 500


# ── NEW ──────────────────────────────────────────────────────────────
# ROUTE: DISCOM LIST
# Returns available electricity boards for the bill calculator dropdown.
# ── NEW ──────────────────────────────────────────────────────────────
@app.route("/discoms", methods=["GET"])
def discoms():
    """
    Called once on page load by the frontend to populate the
    'Select your electricity board' dropdown in the bill calculator.

    Response: [{"key": "TANGEDCO", "name": "Tamil Nadu (TANGEDCO)"}, ...]
    """
    return jsonify(get_discom_list())


# ── NEW ──────────────────────────────────────────────────────────────
# ROUTE: BILL CALCULATOR
# Accepts billing inputs, returns full slab-based bill breakdown.
# ── NEW ──────────────────────────────────────────────────────────────
@app.route("/bill", methods=["POST"])
def bill():
    """
    Core billing endpoint. Takes the user's monthly consumption and their
    predicted solar generation, then returns a full slab-by-slab breakdown
    of what they pay before and after solar — including net metering credits
    and payback period if panel cost is provided.

    Expected JSON body:
      {
        "discom":              "TANGEDCO",   ← electricity board key from /discoms
        "monthly_consumption": 350,          ← units from user's actual electricity bill
        "monthly_solar_kwh":   120.5,        ← auto-filled from /predict, or entered manually
        "panel_cost":          150000,       ← optional; needed for payback period
        "user_type":           "domestic"    ← "domestic" or "commercial"
      }
    """
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Invalid or missing JSON payload"}), 400

        discom = data.get("discom", "").strip()
        monthly_consumption = data.get("monthly_consumption")

        if not discom:
            return jsonify({"error": "Please select your electricity board (DISCOM)."}), 400
        if monthly_consumption is None:
            return jsonify({"error": "monthly_consumption is required."}), 400

        try:
            monthly_consumption = float(monthly_consumption)
            monthly_solar_kwh   = float(data.get("monthly_solar_kwh", 0))
            panel_cost          = float(data.get("panel_cost", 0))
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid numeric value in billing inputs."}), 400

        if monthly_consumption < 0:
            return jsonify({"error": "Monthly consumption cannot be negative."}), 400

        user_type = data.get("user_type", "domestic")
        if user_type not in ("domestic", "commercial"):
            user_type = "domestic"

        result = calculate_bill(
            discom=discom,
            monthly_consumption_kwh=monthly_consumption,
            monthly_solar_kwh=monthly_solar_kwh,
            panel_cost=panel_cost,
            user_type=user_type,
        )

        # calculate_bill returns {"error": ...} when the DISCOM key is unrecognised
        if "error" in result:
            return jsonify(result), 400

        # ── SAVE TO DATABASE ──
        # Same pattern as /predict — only saves if the browser sent a session token.
        # Also links this bill to a prediction if the frontend sent prediction_id
        # (which it gets from the /predict response we modified in Step 3).
        user_session = _get_or_create_session()
        if user_session:
            bill_record = BillCalculation(
                session_id=user_session.id,
                prediction_id=data.get("prediction_id"),  # links bill ↔ prediction

                # Inputs
                discom=discom,
                monthly_consumption_kwh=monthly_consumption,
                monthly_solar_kwh=monthly_solar_kwh,
                user_type=user_type,

                # Results
                bill_without_solar=result.get("bill_without_solar"),
                bill_with_solar=result.get("bill_with_solar"),
                monthly_savings=result.get("monthly_savings"),
                panel_cost=panel_cost,
                payback_years=result.get("payback_years"),
            )
            db.session.add(bill_record)
            db.session.commit()

        return jsonify(result)

    except Exception as e:
        print(f"Billing error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred in billing. Please try again."}), 500


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ROUTE: PREDICTION HISTORY (list)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Returns a lightweight list of the user's past predictions.
# Think of it like an email inbox — you see sender, subject, date,
# but not the full email body. That keeps it fast.
#
# Example: GET /history?limit=10&city=Chennai
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@app.route("/history", methods=["GET"])
def history():
    user_session = _get_or_create_session()
    if not user_session:
        return jsonify({"error": "No session token provided."}), 400

    # Optional filters from query string
    limit = request.args.get("limit", 20, type=int)       # how many to return
    city_filter = request.args.get("city", "").strip()     # filter by city name

    # Start building the query: "all predictions for THIS user"
    query = Prediction.query.filter_by(session_id=user_session.id)

    # If they passed ?city=Chennai, add a WHERE clause
    # ilike = case-insensitive LIKE (so "chennai" matches "Chennai")
    if city_filter:
        query = query.filter(Prediction.city.ilike(f"%{city_filter}%"))

    # Most recent first, capped at the limit
    predictions = query.order_by(Prediction.created_at.desc()).limit(limit).all()

    return jsonify({
        "count": len(predictions),
        "predictions": [p.to_summary_dict() for p in predictions],
        #                ^^^^^^^^^^^^^^^^ uses the lightweight method from models.py
        #                (returns city, energy, date — NOT the huge hourly JSON blob)
    })


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ROUTE: PREDICTION DETAIL (single)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Returns the FULL stored response for one specific past prediction.
# This is like clicking on an email to see the whole thing.
# Use case: user clicks a row in their history → reload the full charts.
#
# Example: GET /history/7
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@app.route("/history/<int:prediction_id>", methods=["GET"])
def history_detail(prediction_id):
    user_session = _get_or_create_session()
    if not user_session:
        return jsonify({"error": "No session token provided."}), 400

    # Look up the prediction — but ONLY if it belongs to this user's session.
    # This prevents User A from seeing User B's predictions by guessing IDs.
    prediction = Prediction.query.filter_by(
        id=prediction_id,
        session_id=user_session.id,
    ).first()

    if not prediction:
        return jsonify({"error": "Prediction not found."}), 404

    # Return the entire JSON blob we saved in Step 3
    return jsonify(prediction.full_response)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ROUTE: COMPARE TWO PREDICTIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# "Compare today's forecast vs yesterday's" — the user picks two
# predictions from their history, and this returns them side by side
# with the difference calculated.
#
# Example: POST /compare   body: {"prediction_ids": [7, 12]}
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@app.route("/compare", methods=["POST"])
def compare():
    user_session = _get_or_create_session()
    if not user_session:
        return jsonify({"error": "No session token provided."}), 400

    data = request.get_json(silent=True) or {}
    ids = data.get("prediction_ids", [])

    if len(ids) != 2:
        return jsonify({"error": "Provide exactly 2 prediction IDs to compare."}), 400

    # Fetch both predictions (only if they belong to this user)
    predictions = Prediction.query.filter(
        Prediction.id.in_(ids),
        Prediction.session_id == user_session.id,
    ).all()

    if len(predictions) != 2:
        return jsonify({"error": "One or both predictions not found."}), 404

    # Sort so the older one comes first
    predictions.sort(key=lambda p: p.created_at)
    older, newer = predictions

    # Build the comparison response with deltas (newer - older)
    older_dict = older.to_summary_dict()
    newer_dict = newer.to_summary_dict()

    delta = {
        "energy_kwh": round((newer.total_energy_kwh or 0) - (older.total_energy_kwh or 0), 2),
        "radiation_wm2": round((newer.current_radiation_wm2 or 0) - (older.current_radiation_wm2 or 0), 2),
        "peak_power_w": round((newer.peak_power_w or 0) - (older.peak_power_w or 0), 2),
        # positive delta = newer prediction is higher
        # negative delta = newer prediction is lower
    }

    # Add bill savings delta if both predictions have linked bill calculations
    older_bill = older_dict.get("bill")
    newer_bill = newer_dict.get("bill")
    if older_bill and newer_bill:
        delta["monthly_savings"] = round(
            (newer_bill.get("monthly_savings") or 0) - (older_bill.get("monthly_savings") or 0), 2
        )
        delta["bill_without_solar"] = round(
            (newer_bill.get("bill_without_solar") or 0) - (older_bill.get("bill_without_solar") or 0), 2
        )
        delta["bill_with_solar"] = round(
            (newer_bill.get("bill_with_solar") or 0) - (older_bill.get("bill_with_solar") or 0), 2
        )

    return jsonify({
        "older": older_dict,
        "newer": newer_dict,
        "delta": delta,
    })


if __name__ == "__main__":
    app.run(debug=False)