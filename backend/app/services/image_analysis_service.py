"""
image_analysis_service.py
Uses Google Gemini Vision via the google-genai SDK
to analyze a road photo and detect whether the road is blocked, partially
blocked, or clear with structured JSON output.

Returns:
    {
        "road_status": "blocked" | "partial" | "clear" | "unknown",
        "confidence": "high" | "medium" | "low",
        "reason": "<short explanation>",
        "hazard_type": "<debris|landslide|flooding|crack|boulder|other|none>",
        "suggested_severity": "critical" | "high" | "medium" | "low"
    }
"""
from __future__ import annotations

import json
import re
from typing import Optional, Literal
from pydantic import BaseModel, Field

from app.core.config import settings


class RoadAnalysisSchema(BaseModel):
    road_status: Literal["blocked", "partial", "clear", "unknown"] = Field(
        description="Whether the road in the photo is blocked, partially blocked, clear, or unknown"
    )
    confidence: Literal["high", "medium", "low"] = Field(
        description="Confidence level of the assessment"
    )
    reason: str = Field(
        description="One sentence explanation of what hazard or road condition was detected"
    )
    hazard_type: Literal["debris", "landslide", "flooding", "crack", "boulder", "other", "none"] = Field(
        description="Primary hazard type observed in the image"
    )
    suggested_severity: Literal["critical", "high", "medium", "low"] = Field(
        description="Suggested severity rating for emergency responders"
    )


_PROMPT = """
You are an expert geotechnical and road safety AI for the Landslide Early Warning System in Northeast India.
Analyze the provided photograph carefully.

Task:
Determine whether the road or transportation corridor in the image is blocked, partially obstructed, or clear.

Rules:
- "blocked": Road is completely impassable due to landslides, fallen rock boulders, mudslides, large slope failure debris, or deep road cut cracks.
- "partial": Road has visible hazard, shoulder collapse, debris, or partial obstruction, but single-lane or restricted movement might be possible.
- "clear": Road corridor is open and clear of hazardous slope movement.
- "unknown": Image does not show a road/slope scene or is too blurry/unrelated.

Set confidence to "high", "medium", or "low", and provide a concise, factual reason in 1-2 sentences.
"""


def analyze_road_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    """
    Analyze a road image using Gemini Vision (google-genai SDK).
    
    Args:
        image_bytes: Raw image bytes
        mime_type: MIME type of the image (default: image/jpeg)
    
    Returns:
        dict with road_status, confidence, reason, hazard_type, suggested_severity
    """
    default = {
        "road_status": "unknown",
        "confidence": "low",
        "reason": "AI analysis unavailable.",
        "hazard_type": "other",
        "suggested_severity": "medium",
    }

    if not settings.gemini_api_key:
        return {**default, "reason": "Gemini API key not configured."}

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.gemini_api_key)

        models_to_try = ["gemini-2.5-flash", "gemini-flash-latest"]
        response = None
        last_err = None

        for model_name in models_to_try:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=[
                        _PROMPT,
                        types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                    ],
                    config=types.GenerateContentConfig(
                        temperature=0.1,
                        response_mime_type="application/json",
                        response_schema=RoadAnalysisSchema,
                    ),
                )
                if response and response.text:
                    break
            except Exception as e:
                last_err = e
                continue

        if not response or not response.text:
            raise last_err or RuntimeError("No response from Gemini Vision models")

        raw_text = response.text.strip()
        result = json.loads(raw_text)

        # Validate with Pydantic model for clean typing
        parsed = RoadAnalysisSchema(**result)

        return {
            "road_status": parsed.road_status,
            "confidence": parsed.confidence,
            "reason": parsed.reason[:300],
            "hazard_type": parsed.hazard_type,
            "suggested_severity": parsed.suggested_severity,
        }

    except Exception as e:
        print(f"[IMAGE_ANALYSIS] Error: {e}")
        return {**default, "reason": f"Analysis error: {str(e)[:100]}"}
