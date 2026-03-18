"""
Derived metrics calculation module for Solar Power Prediction App.
Handles panel output, energy, CO2 savings, and environmental equivalents.
"""

import numpy as np
import math


def calculate_panel_irradiance(radiation_wm2, tilt_deg, azimuth_deg=180.0):
    """
    Calculate effective irradiance on a tilted/oriented panel.
    Applies cosine correction for panel tilt angle and a modifier for azimuth.
    """
    tilt_rad = math.radians(tilt_deg)
    # Azimuth modifier: South=1.0, East/West=0.8, North=0.6 (rough approximation)
    az_rad = math.radians(azimuth_deg - 180)
    az_modifier = 0.8 + 0.2 * math.cos(az_rad)
    return radiation_wm2 * math.cos(tilt_rad) * az_modifier


def calculate_panel_power(radiation_wm2, area_m2, efficiency_pct, tilt_deg, azimuth_deg=180.0):
    """
    Calculate panel power output in Watts.
    
    Args:
        radiation_wm2: Solar radiation in W/m²
        area_m2: Panel area in m²
        efficiency_pct: Panel efficiency as percentage (e.g., 18 for 18%)
        tilt_deg: Panel tilt angle in degrees
        azimuth_deg: Panel orientation azimuth in degrees (180=South)
    
    Returns:
        Power output in Watts
    """
    irradiance = calculate_panel_irradiance(radiation_wm2, tilt_deg, azimuth_deg)
    efficiency = efficiency_pct / 100.0
    power = irradiance * area_m2 * efficiency
    return max(0, round(power, 2))


def calculate_hourly_energy(hourly_powers):
    """
    Calculate energy from hourly power values.
    Each value represents 1-hour interval → energy = power * 1h = Wh.
    
    Returns:
        List of hourly Wh values
    """
    return [max(0, round(p, 2)) for p in hourly_powers]


def calculate_daily_energy(hourly_wh_values):
    """
    Sum hourly energy values to get daily total in Wh.
    """
    return round(sum(hourly_wh_values), 2)


def calculate_co2_savings(energy_kwh):
    """
    Calculate CO2 savings from solar energy produced.
    Grid emission factor: 0.82 kg CO2 per kWh (India average).
    
    Returns:
        CO2 savings in kg
    """
    return round(energy_kwh * 0.82, 3)


def calculate_environmental_equivalents(co2_savings_kg):
    """
    Convert CO2 savings to relatable equivalents.
    
    Returns dict with:
        - trees_planted: equivalent trees absorbing CO2 for a year
        - cars_off_road: equivalent cars removed from road for a day
        - phone_charges: number of smartphone charges
        - led_bulb_hours: hours of 10W LED bulb usage
    """
    return {
        "trees_planted": round(co2_savings_kg / 21.77, 2),     # 1 tree absorbs ~21.77 kg CO2/year
        "cars_off_road": round(co2_savings_kg / 12.0, 3),      # avg car emits ~12 kg CO2/day
        "phone_charges": round(co2_savings_kg / 0.008, 0),     # ~8g CO2 per charge
        "led_bulb_hours": round(co2_savings_kg / 0.0082, 0),   # 10W LED ≈ 8.2g CO2/hr
    }


def find_peak_solar_hour(hourly_data):
    """
    Find the hour with maximum solar radiation.
    
    Args:
        hourly_data: list of dicts with 'hour' and 'radiation_wm2' keys
    
    Returns:
        Dict with peak hour info or None
    """
    if not hourly_data:
        return None

    peak = max(hourly_data, key=lambda x: x.get("radiation_wm2", 0))
    return {
        "hour": peak["hour"],
        "datetime": peak["datetime"],
        "radiation_wm2": peak["radiation_wm2"]
    }


def compute_full_metrics(hourly_predictions, panel_area, panel_efficiency, panel_tilt, panel_azimuth=180.0):
    """
    Compute all derived metrics from hourly radiation predictions.
    
    Returns:
        Dict with all computed metrics organized by day.
    """
    # Group by day
    from collections import defaultdict
    daily_groups = defaultdict(list)
    
    for point in hourly_predictions:
        day_key = point["datetime"][:10]  # "YYYY-MM-DD"
        
        power = calculate_panel_power(
            point["radiation_wm2"],
            panel_area,
            panel_efficiency,
            panel_tilt,
            panel_azimuth
        )
        
        point_with_metrics = {
            **point,
            "panel_power_w": power,
            "energy_wh": power,  # 1-hour interval
        }
        daily_groups[day_key].append(point_with_metrics)
    
    # Compute daily summaries
    daily_summaries = []
    total_energy_wh = 0
    
    for day, points in daily_groups.items():
        day_energy_wh = sum(p["energy_wh"] for p in points)
        day_energy_kwh = day_energy_wh / 1000
        co2_kg = calculate_co2_savings(day_energy_kwh)
        peak = find_peak_solar_hour(points)
        
        daily_summaries.append({
            "date": day,
            "daily_energy_wh": round(day_energy_wh, 2),
            "daily_energy_kwh": round(day_energy_kwh, 3),
            "co2_savings_kg": co2_kg,
            "peak_hour": peak,
            "hours_data": points,
        })
        total_energy_wh += day_energy_wh
    
    total_energy_kwh = total_energy_wh / 1000
    total_co2 = calculate_co2_savings(total_energy_kwh)
    env_equivalents = calculate_environmental_equivalents(total_co2)
    
    total_peak_radiation = max((p["radiation_wm2"] for p in hourly_predictions), default=0)
    total_peak_power = max((p["panel_power_w"] for p in hourly_predictions), default=0)
    
    # Current prediction (first daytime hour with radiation > 0)
    current_point = None
    for point in hourly_predictions:
        if point["radiation_wm2"] > 0:
            current_point = point
            break
    if not current_point and hourly_predictions:
        current_point = hourly_predictions[0]
    
    current_radiation = current_point["radiation_wm2"] if current_point else 0
    current_power = calculate_panel_power(current_radiation, panel_area, panel_efficiency, panel_tilt, panel_azimuth)
    current_irradiance = calculate_panel_irradiance(current_radiation, panel_tilt, panel_azimuth)
    
    return {
        "current": {
            "radiation_wm2": round(current_radiation, 2),
            "panel_irradiance_wm2": round(current_irradiance, 2),
            "panel_power_w": current_power,
        },
        "total": {
            "energy_wh": round(total_energy_wh, 2),
            "energy_kwh": round(total_energy_kwh, 3),
            "co2_savings_kg": total_co2,
            "environmental": env_equivalents,
            "peak_radiation_wm2": round(total_peak_radiation, 2),
            "peak_power_w": total_peak_power,
        },
        "daily": daily_summaries,
        "hourly": hourly_predictions,
    }
