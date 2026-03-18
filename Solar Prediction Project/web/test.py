import requests
import json

url = "http://127.0.0.1:5000/predict"
payload = {
    "city": "London",
    "panel_specs": {
        "area_m2": 5.0,
        "efficiency_pct": 18.0,
        "tilt_deg": 30,
        "azimuth_deg": 180
    },
    "forecast_days": 1
}

res = requests.post(url, json=payload)
print("Status Code:", res.status_code)
print("Total Metrics Payload:", json.dumps(res.json().get("total", {}), indent=2))
print("Panel Specs Payload:", json.dumps(res.json().get("panel_specs", {}), indent=2))
