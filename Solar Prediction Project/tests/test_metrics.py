"""Unit tests for metrics.py"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'web'))

import pytest
from metrics import (
    calculate_panel_irradiance,
    calculate_panel_power,
    calculate_hourly_energy,
    calculate_daily_energy,
    calculate_co2_savings,
    calculate_environmental_equivalents,
    find_peak_solar_hour,
)


class TestPanelIrradiance:
    def test_zero_tilt(self):
        """At 0° tilt, irradiance equals input radiation."""
        assert abs(calculate_panel_irradiance(800, 0) - 800) < 0.01

    def test_90_degree_tilt(self):
        """At 90° tilt, irradiance should be ~0."""
        assert abs(calculate_panel_irradiance(800, 90)) < 0.01

    def test_30_degree_tilt(self):
        """At 30° tilt, irradiance = 800 * cos(30°) ≈ 692.82."""
        result = calculate_panel_irradiance(800, 30)
        assert abs(result - 692.82) < 1

    def test_zero_radiation(self):
        """Zero radiation gives zero irradiance."""
        assert calculate_panel_irradiance(0, 30) == 0


class TestPanelPower:
    def test_basic_calculation(self):
        """1000 W/m², 10m², 20% efficiency, 0° tilt → 2000 W."""
        result = calculate_panel_power(1000, 10, 20, 0)
        assert abs(result - 2000) < 1

    def test_with_tilt(self):
        """With tilt, power should be reduced."""
        power_0 = calculate_panel_power(1000, 10, 20, 0)
        power_30 = calculate_panel_power(1000, 10, 20, 30)
        assert power_30 < power_0

    def test_no_radiation(self):
        """Zero radiation → zero power."""
        assert calculate_panel_power(0, 10, 20, 0) == 0

    def test_negative_not_possible(self):
        """Power should never be negative."""
        result = calculate_panel_power(-5, 10, 20, 0)
        assert result >= 0


class TestEnergy:
    def test_hourly_energy(self):
        """Hourly energy values should be non-negative."""
        result = calculate_hourly_energy([100, 200, 300, 0, -5])
        assert all(v >= 0 for v in result)

    def test_daily_energy_sum(self):
        """Daily energy is sum of hourly values."""
        hourly = [100, 200, 300, 150]
        assert calculate_daily_energy(hourly) == 750


class TestCO2:
    def test_co2_savings(self):
        """1 kWh → 0.82 kg CO₂."""
        assert abs(calculate_co2_savings(1) - 0.82) < 0.001

    def test_co2_savings_10kwh(self):
        """10 kWh → 8.2 kg CO₂."""
        assert abs(calculate_co2_savings(10) - 8.2) < 0.01

    def test_zero_energy(self):
        assert calculate_co2_savings(0) == 0


class TestEnvironmental:
    def test_equivalents_structure(self):
        """Should return all expected keys."""
        result = calculate_environmental_equivalents(10)
        assert "trees_planted" in result
        assert "cars_off_road" in result
        assert "phone_charges" in result
        assert "led_bulb_hours" in result

    def test_positive_values(self):
        result = calculate_environmental_equivalents(100)
        assert all(v > 0 for v in result.values())


class TestPeakHour:
    def test_finds_peak(self):
        data = [
            {"hour": 6, "datetime": "2024-01-01 06:00:00", "radiation_wm2": 100},
            {"hour": 12, "datetime": "2024-01-01 12:00:00", "radiation_wm2": 800},
            {"hour": 18, "datetime": "2024-01-01 18:00:00", "radiation_wm2": 50},
        ]
        peak = find_peak_solar_hour(data)
        assert peak["hour"] == 12
        assert peak["radiation_wm2"] == 800

    def test_empty_data(self):
        assert find_peak_solar_hour([]) is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
