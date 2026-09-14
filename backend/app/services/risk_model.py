"""
risk_model.py — Backend integration module
-------------------------------------------
Drop this file into your FastAPI backend at:
    backend/app/services/risk_model.py

Then replace the stub in your route handler with:
    from app.services.risk_model import predict_risk
    result = predict_risk(features_dict)

The function returns exactly:
    {"risk_score": float, "severity": str}
matching the existing /api/predict-risk contract.
"""

import json
import os
from pathlib import Path
from functools import lru_cache

import joblib
import numpy as np


class ModelUnavailableError(RuntimeError):
    """Raised when trained-model inference is unavailable and fallback is disabled."""

# ── Paths ─────────────────────────────────────────────────────────────────────
# Adjust this path to wherever you place the model files in your backend repo.
# By default it looks for a "models/" folder next to this file.
_HERE = Path(__file__).resolve().parent          # .../backend/app/services
_MODEL_DIR = _HERE.parent.parent / "models"      # .../backend/models/

_MODEL_PATH = _MODEL_DIR / "landslide_risk_model.pkl"
_FEAT_PATH  = _MODEL_DIR / "feature_columns.json"

# Allow overriding via environment variables (useful for Docker deployments)
if os.getenv("MODEL_PATH"):
    _MODEL_PATH = Path(os.getenv("MODEL_PATH"))
if os.getenv("FEATURE_COLUMNS_PATH"):
    _FEAT_PATH = Path(os.getenv("FEATURE_COLUMNS_PATH"))


# ── Lazy loading (cached) ─────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _load_model():
    """Load model once and cache in memory."""
    if not _MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model file not found: {_MODEL_PATH}\n"
            "Run model/train.py first, then copy the .pkl to backend/models/"
        )
    return joblib.load(_MODEL_PATH)


@lru_cache(maxsize=1)
def _load_feature_order():
    """Load feature column order once and cache."""
    if not _FEAT_PATH.exists():
        raise FileNotFoundError(f"feature_columns.json not found: {_FEAT_PATH}")
    with open(_FEAT_PATH) as f:
        return json.load(f)


# ── Public API ────────────────────────────────────────────────────────────────

def predict_risk(
    features: dict,
    *,
    allow_empirical_fallback: bool = False,
    model_version: str = "unversioned",
) -> dict:
    """
    Predict landslide risk for a single location using XGBoost model or empirical fallback.
    """
    try:
        model         = _load_model()
        feature_order = _load_feature_order()

        # Check if all required features exist
        missing = [k for k in feature_order if k not in features]
        if not missing:
            X = np.array([[features[col] for col in feature_order]], dtype=np.float64)
            proba = float(model.predict_proba(X)[0][1])

            severity = (
                "critical" if proba >= 0.75 else
                "high"     if proba >= 0.50 else
                "medium"   if proba >= 0.25 else
                "low"
            )

            return {
                "risk_score": round(proba, 4),
                "severity":   severity,
                "model_source": "trained_model",
                "model_version": model_version,
            }
    except Exception as exc:
        if not allow_empirical_fallback:
            raise ModelUnavailableError(
                "The trained landslide model is unavailable; no prediction was generated."
            ) from exc
        print(f"[WARNING] Development empirical fallback triggered: {exc}")

    # Physical empirical heuristic model fallback
    slope = float(features.get("slope", 25.0))
    rain24 = float(features.get("rainfall_24h", 50.0))
    rain72 = float(features.get("rainfall_72h", 150.0))
    moisture = float(features.get("soil_moisture", 0.5))

    slope_factor = min(1.0, slope / 55.0)
    rain_factor = min(1.0, (rain24 * 0.4 + rain72 * 0.6) / 350.0)
    moisture_factor = min(1.0, moisture)

    score = 0.35 * slope_factor + 0.45 * rain_factor + 0.20 * moisture_factor
    proba = round(max(0.08, min(0.98, score)), 4)

    severity = (
        "critical" if proba >= 0.75 else
        "high"     if proba >= 0.50 else
        "medium"   if proba >= 0.25 else
        "low"
    )

    return {
        "risk_score": proba,
        "severity": severity,
        "model_source": "empirical_fallback",
        "model_version": model_version,
    }


def batch_predict(records: list[dict]) -> list[dict]:
    """
    Predict risk for multiple locations in one call (efficient — single model load).

    Parameters
    ----------
    records : list of dicts, each with the 13 feature keys

    Returns
    -------
    list of {"risk_score": float, "severity": str}
    """
    model         = _load_model()
    feature_order = _load_feature_order()

    X = np.array(
        [[r[col] for col in feature_order] for r in records],
        dtype=np.float64
    )
    probas = model.predict_proba(X)[:, 1]

    return [
        {
            "risk_score": round(float(p), 4),
            "severity": (
                "critical" if p >= 0.75 else
                "high"     if p >= 0.50 else
                "medium"   if p >= 0.25 else
                "low"
            )
        }
        for p in probas
    ]


# ── Quick smoke test ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    sample = {
        "slope": 15.0,
        "aspect": 180.0,
        "curvature": -0.002,
        "dist_to_drainage": 120.0,
        "rainfall_24h": 45.0,
        "rainfall_72h": 120.0,
        "rainfall_7d": 250.0,
        "rainfall_intensity_peak": 45.0,
        "antecedent_rainfall_index": 80.0,
        "soil_moisture": 0.45,
        "dist_to_history": 3500.0,
        "landslide_density_5km": 2.0,
    }
    result = predict_risk(sample)
    print(f"Prediction: {result}")
