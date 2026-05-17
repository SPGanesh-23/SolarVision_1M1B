"""
billing.py — Electricity Bill Calculator for SolarVision
---------------------------------------------------------
This module handles the core billing logic for the electricity bill calculator feature.

What it does:
  - Stores slab-based tariff data for major Indian DISCOMs (state electricity boards).
  - Calculates a user's electricity bill BEFORE and AFTER solar generation offsets their consumption.
  - Computes net metering credits when solar generation EXCEEDS consumption.
  - Returns a detailed breakdown: per-slab costs, total savings, annual savings, and payback period.

Why slabs matter:
  Solar generation offsets your MOST EXPENSIVE units first (top-down through slabs),
  so the savings are always higher than a flat ₹/unit calculation would suggest.
  This module handles that correctly.

How to integrate:
  Import and call `calculate_bill(discom, monthly_consumption, monthly_solar_kwh,
  panel_cost, user_type)` from app.py. Returns a dict ready to be JSON-serialized.
"""

# ─────────────────────────────────────────────
# DISCOM TARIFF DATABASE
# Each entry: list of (upper_limit, rate_per_unit)
# upper_limit = None means "unlimited" (top slab)
# Rates in ₹ per kWh. Data as of 2024-25 tariff orders.
# Fixed charges (₹/month) are listed separately.
# ─────────────────────────────────────────────

DISCOM_TARIFFS = {
    "TANGEDCO": {
        "name": "Tamil Nadu (TANGEDCO)",
        "domestic": {
            "slabs": [
                (100,  0.00),   # 0–100 units: FREE under Tamil Nadu scheme
                (200,  1.50),   # 101–200 units
                (500,  3.00),   # 201–500 units
                (None, 5.00),   # 501+ units
            ],
            "fixed_charge": 40,          # ₹/month fixed charge
            "net_metering_rate": 2.25,   # ₹/unit credited for export to grid
        },
        "commercial": {
            "slabs": [
                (100,  5.00),
                (300,  6.50),
                (None, 8.00),
            ],
            "fixed_charge": 200,
            "net_metering_rate": 3.50,
        },
    },

    "BESCOM": {
        "name": "Karnataka (BESCOM)",
        "domestic": {
            "slabs": [
                (30,   0.00),   # BPL: first 30 units free
                (100,  3.15),
                (200,  5.35),
                (500,  6.50),
                (None, 7.40),
            ],
            "fixed_charge": 50,
            "net_metering_rate": 3.00,
        },
        "commercial": {
            "slabs": [
                (200,  7.15),
                (None, 8.30),
            ],
            "fixed_charge": 250,
            "net_metering_rate": 4.00,
        },
    },

    "MSEDCL": {
        "name": "Maharashtra (MSEDCL)",
        "domestic": {
            "slabs": [
                (100,  1.36),
                (300,  2.85),
                (500,  4.73),
                (None, 6.57),
            ],
            "fixed_charge": 80,
            "net_metering_rate": 3.50,
        },
        "commercial": {
            "slabs": [
                (200,  6.70),
                (None, 8.90),
            ],
            "fixed_charge": 300,
            "net_metering_rate": 4.50,
        },
    },

    "TSSPDCL": {
        "name": "Telangana (TSSPDCL)",
        "domestic": {
            "slabs": [
                (50,   0.00),   # First 50 units free under Telangana scheme
                (100,  1.45),
                (200,  2.60),
                (300,  3.50),
                (500,  5.00),
                (None, 7.00),
            ],
            "fixed_charge": 35,
            "net_metering_rate": 2.50,
        },
        "commercial": {
            "slabs": [
                (100,  5.50),
                (None, 7.50),
            ],
            "fixed_charge": 180,
            "net_metering_rate": 3.50,
        },
    },

    "KSEB": {
        "name": "Kerala (KSEB)",
        "domestic": {
            "slabs": [
                (40,   2.20),
                (100,  3.25),
                (150,  4.50),
                (200,  6.10),
                (250,  6.95),
                (300,  7.50),
                (None, 8.20),
            ],
            "fixed_charge": 25,
            "net_metering_rate": 3.00,
        },
        "commercial": {
            "slabs": [
                (150,  6.40),
                (None, 7.90),
            ],
            "fixed_charge": 200,
            "net_metering_rate": 3.50,
        },
    },

    "APEPDCL": {
        "name": "Andhra Pradesh (APEPDCL)",
        "domestic": {
            "slabs": [
                (50,   0.00),
                (100,  1.45),
                (225,  3.05),
                (400,  5.60),
                (None, 7.10),
            ],
            "fixed_charge": 30,
            "net_metering_rate": 2.75,
        },
        "commercial": {
            "slabs": [
                (200,  6.00),
                (None, 8.00),
            ],
            "fixed_charge": 200,
            "net_metering_rate": 3.50,
        },
    },

    "BRPL": {
        "name": "Delhi (BRPL/BYPL)",
        "domestic": {
            "slabs": [
                (200,  3.00),   # Delhi subsidy scheme
                (400,  4.50),
                (None, 6.50),
            ],
            "fixed_charge": 125,
            "net_metering_rate": 4.00,
        },
        "commercial": {
            "slabs": [
                (200,  7.00),
                (None, 9.50),
            ],
            "fixed_charge": 400,
            "net_metering_rate": 4.50,
        },
    },
}


# ─────────────────────────────────────────────
# CORE BILLING FUNCTION
# ─────────────────────────────────────────────

def _apply_slabs(units, slabs):
    """
    Internal helper: apply progressive slab rates to a given unit consumption.
    Returns total energy charge (₹) and a list of per-slab breakdown dicts.

    Works by walking through slabs from cheapest to most expensive,
    calculating how many units fall in each band and multiplying by that band's rate.
    """
    breakdown = []
    total_charge = 0.0
    prev_limit = 0

    for upper_limit, rate in slabs:
        if units <= 0:
            break

        # How many units are in THIS slab band?
        if upper_limit is None:
            units_in_slab = units          # All remaining units
        else:
            slab_capacity = upper_limit - prev_limit
            units_in_slab = min(units, slab_capacity)

        slab_charge = units_in_slab * rate
        total_charge += slab_charge

        breakdown.append({
            "range": f"{prev_limit + 1}–{upper_limit if upper_limit else '∞'}",
            "units": round(units_in_slab, 2),
            "rate": rate,
            "charge": round(slab_charge, 2),
        })

        units -= units_in_slab
        prev_limit = upper_limit if upper_limit else prev_limit

    return round(total_charge, 2), breakdown


def calculate_bill(
    discom: str,
    monthly_consumption_kwh: float,
    monthly_solar_kwh: float,
    panel_cost: float = 0,
    user_type: str = "domestic"
):
    """
    Main entry point. Called from app.py with user inputs.

    Parameters:
      discom                 — Key from DISCOM_TARIFFS dict (e.g. "TANGEDCO")
      monthly_consumption_kwh — User's baseline monthly consumption in kWh (from electricity bill)
      monthly_solar_kwh      — Predicted monthly solar generation from SolarVision ML pipeline
      panel_cost             — Total installation cost in ₹ (for payback period calculation)
      user_type              — "domestic" or "commercial"

    Returns a dict with:
      - bill_without_solar: full breakdown before solar
      - bill_with_solar: full breakdown after solar offsets consumption
      - net_metering_credit: ₹ credit if solar > consumption
      - monthly_savings: ₹ saved per month
      - annual_savings: ₹ saved per year
      - payback_years: how many years to recover panel cost
      - slab_breakdown_before / after: per-slab unit & charge tables for the UI chart
    """

    if discom not in DISCOM_TARIFFS:
        return {"error": f"DISCOM '{discom}' not found. Available: {list(DISCOM_TARIFFS.keys())}"}

    tariff = DISCOM_TARIFFS[discom][user_type]
    slabs = tariff["slabs"]
    fixed_charge = tariff["fixed_charge"]
    net_metering_rate = tariff["net_metering_rate"]

    # ── Bill WITHOUT solar ──────────────────────
    energy_charge_before, breakdown_before = _apply_slabs(monthly_consumption_kwh, slabs)
    total_before = energy_charge_before + fixed_charge

    # ── Net consumption after solar offset ─────
    # Solar offsets grid draw first; excess is exported
    net_consumption = max(0, monthly_consumption_kwh - monthly_solar_kwh)
    excess_solar = max(0, monthly_solar_kwh - monthly_consumption_kwh)

    # ── Bill WITH solar ─────────────────────────
    energy_charge_after, breakdown_after = _apply_slabs(net_consumption, slabs)
    net_metering_credit = round(excess_solar * net_metering_rate, 2)
    total_after = max(0, energy_charge_after + fixed_charge - net_metering_credit)

    # ── Savings ─────────────────────────────────
    monthly_savings = round(total_before - total_after, 2)
    annual_savings = round(monthly_savings * 12, 2)

    # ── Payback Period ───────────────────────────
    # How many years until annual savings cover panel installation cost
    if annual_savings > 0 and panel_cost > 0:
        payback_years = round(panel_cost / annual_savings, 1)
    else:
        payback_years = None

    # ── Percentage saving ────────────────────────
    savings_percent = round((monthly_savings / total_before) * 100, 1) if total_before > 0 else 0

    return {
        "discom_name": DISCOM_TARIFFS[discom]["name"],
        "user_type": user_type,
        "monthly_consumption_kwh": monthly_consumption_kwh,
        "monthly_solar_kwh": round(monthly_solar_kwh, 2),
        "net_consumption_kwh": round(net_consumption, 2),
        "excess_solar_kwh": round(excess_solar, 2),

        # Bill totals
        "bill_without_solar": round(total_before, 2),
        "bill_with_solar": round(total_after, 2),
        "energy_charge_before": energy_charge_before,
        "energy_charge_after": round(energy_charge_after, 2),
        "fixed_charge": fixed_charge,
        "net_metering_credit": net_metering_credit,

        # Savings summary
        "monthly_savings": monthly_savings,
        "annual_savings": annual_savings,
        "savings_percent": savings_percent,
        "payback_years": payback_years,
        "panel_cost": panel_cost,

        # Per-slab breakdowns for frontend chart rendering
        "slab_breakdown_before": breakdown_before,
        "slab_breakdown_after": breakdown_after,
    }


def get_discom_list():
    """Returns a list of {key, name} dicts for populating the frontend dropdown."""
    return [{"key": k, "name": v["name"]} for k, v in DISCOM_TARIFFS.items()]