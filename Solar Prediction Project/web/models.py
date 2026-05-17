"""
Database models for SolarVista prediction history.

Uses Flask-SQLAlchemy (an ORM) so we define tables as Python classes
instead of writing raw SQL. SQLite is the default backend — the entire
database lives in a single file called 'solarvista.db'.
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone

# ─── This is the database "engine" object ───
# We create it here but connect it to the Flask app later in app.py
# using db.init_app(app). This pattern is called the "application factory".
db = SQLAlchemy()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TABLE 1: sessions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# WHY: Your app has no login system, but you still need to know
#      "which predictions belong to the same person" so they can
#      see their own history. Solution: the browser generates a
#      random token (UUID) and sends it with every request.
#      This table maps that token to a numeric ID.
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class Session(db.Model):
    __tablename__ = "sessions"                  # ← actual table name in SQLite

    id = db.Column(db.Integer, primary_key=True)                        # auto-increment ID
    session_token = db.Column(db.String(64), unique=True, nullable=False, index=True)
    #                                         ^^^^^^      ^^^^^^^^      ^^^^^
    #                                         no dupes    required      fast lookups

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    last_active = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                            onupdate=lambda: datetime.now(timezone.utc))
    #                       ^^^^^^^^ auto-updates every time this row is modified

    # Relationships — these don't create columns, they create convenient
    # Python shortcuts like: session.predictions → list of all predictions
    predictions = db.relationship("Prediction", backref="session", lazy="dynamic")
    bills = db.relationship("BillCalculation", backref="session", lazy="dynamic")

    def __repr__(self):
        return f"<Session {self.session_token[:8]}...>"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TABLE 2: predictions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# WHY: This is the main table. Every time someone hits /predict,
#      we save the inputs AND outputs here. This unlocks:
#        - "Show me my last 10 predictions"
#        - "Compare today vs yesterday for Chennai"
#        - "What was my peak power estimate last week?"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class Prediction(db.Model):
    __tablename__ = "predictions"

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey("sessions.id"), nullable=False, index=True)
    #                                  ^^^^^^^^^^^^^^^^^^^^^^^^^^
    #                                  Links each prediction to a session (user)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # ── INPUTS (what the user asked for) ──
    city = db.Column(db.String(200))
    lat = db.Column(db.Float)
    lon = db.Column(db.Float)
    panel_area_m2 = db.Column(db.Float)
    panel_efficiency_pct = db.Column(db.Float)
    panel_tilt_deg = db.Column(db.Float)
    panel_azimuth_deg = db.Column(db.Float)
    forecast_days = db.Column(db.Integer)

    # ── OUTPUTS (key results, extracted for fast querying) ──
    # We pull these out so you can do things like:
    #   "SELECT * FROM predictions WHERE city='Chennai' ORDER BY total_energy_kwh DESC"
    # without parsing JSON every time.
    current_radiation_wm2 = db.Column(db.Float)
    current_power_w = db.Column(db.Float)
    total_energy_kwh = db.Column(db.Float)
    monthly_solar_kwh = db.Column(db.Float)
    co2_savings_kg = db.Column(db.Float)
    peak_power_w = db.Column(db.Float)

    # ── FULL RESPONSE (the entire JSON blob) ──
    # This is your safety net. Even if you forgot to extract a field above,
    # you can always dig into this later. JSON columns store Python dicts directly.
    hourly_data = db.Column(db.JSON)
    daily_data = db.Column(db.JSON)
    full_response = db.Column(db.JSON)

    # Relationship to bill calculations
    bills = db.relationship("BillCalculation", backref="prediction", lazy="dynamic")

    def to_summary_dict(self):
        """Lightweight dict for history list views (doesn't include huge JSON blobs)."""
        summary = {
            "id": self.id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "city": self.city,
            "lat": self.lat,
            "lon": self.lon,
            "total_energy_kwh": self.total_energy_kwh,
            "monthly_solar_kwh": self.monthly_solar_kwh,
            "current_radiation_wm2": self.current_radiation_wm2,
            "peak_power_w": self.peak_power_w,
            "forecast_days": self.forecast_days,
            "bill": None,  # populated below if a bill calc exists for this prediction
        }
        # Attach the most recent bill calculation linked to this prediction
        latest_bill = self.bills.order_by(BillCalculation.created_at.desc()).first()
        if latest_bill:
            summary["bill"] = latest_bill.to_summary_dict()
        return summary

    def __repr__(self):
        return f"<Prediction {self.id} — {self.city}>"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TABLE 3: bill_calculations
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# WHY: Tracks every bill calculation. Optionally linked to a prediction
#      (if the user ran a prediction first, then calculated the bill).
#      Enables: "How much have I saved over the last 6 months?"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class BillCalculation(db.Model):
    __tablename__ = "bill_calculations"

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey("sessions.id"), nullable=False, index=True)
    prediction_id = db.Column(db.Integer, db.ForeignKey("predictions.id"), nullable=True)
    #                                                                      ^^^^^^^^^^^^
    #                                                    nullable=True because someone might
    #                                                    use the bill calculator WITHOUT
    #                                                    running a prediction first
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # ── INPUTS ──
    discom = db.Column(db.String(50))               # electricity board (e.g., "TANGEDCO")
    monthly_consumption_kwh = db.Column(db.Float)   # from their actual bill
    monthly_solar_kwh = db.Column(db.Float)          # from prediction or manual entry
    user_type = db.Column(db.String(20))             # "domestic" or "commercial"

    # ── RESULTS ──
    bill_without_solar = db.Column(db.Float)
    bill_with_solar = db.Column(db.Float)
    monthly_savings = db.Column(db.Float)
    panel_cost = db.Column(db.Float)
    payback_years = db.Column(db.Float)

    def to_summary_dict(self):
        """Lightweight dict for history views."""
        return {
            "id": self.id,
            "discom": self.discom,
            "monthly_consumption_kwh": self.monthly_consumption_kwh,
            "monthly_solar_kwh": self.monthly_solar_kwh,
            "user_type": self.user_type,
            "bill_without_solar": self.bill_without_solar,
            "bill_with_solar": self.bill_with_solar,
            "monthly_savings": self.monthly_savings,
            "panel_cost": self.panel_cost,
            "payback_years": self.payback_years,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<BillCalc {self.id} — ₹{self.monthly_savings} saved>"
