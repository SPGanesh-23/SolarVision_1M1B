from flask import Flask, render_template, request, jsonify, Response
import os
import io
import csv
from datetime import datetime, timezone

from weather_api import geocode_city, reverse_geocode, get_current_weather, get_forecast, search_cities
from predictor import predict_radiation, predict_hourly
from metrics import compute_full_metrics, calculate_panel_power, calculate_panel_irradiance

app = Flask(__name__)


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
        data = request.get_json()
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


if __name__ == "__main__":
    app.run(debug=True)