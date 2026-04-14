from __future__ import annotations

import json
import os
from urllib import request

from ..models import AdviceRequest, AdviceResponse


class AdviceService:
    def __init__(self) -> None:
        self.api_key = os.getenv("GEMINI_API_KEY")

    def generate(self, payload: AdviceRequest) -> AdviceResponse:
        if self.api_key:
            try:
                return self._generate_gemini(payload)
            except Exception:
                pass
        return AdviceResponse(message=self._fallback(payload), provider="fallback")

    def _generate_gemini(self, payload: AdviceRequest) -> AdviceResponse:
        prompt = (
            "You are a concise stadium navigation assistant. "
            "Give short practical advice in under 45 words.\n"
            f"Start: {payload.start}\nEnd: {payload.end}\n"
            f"Summary: {payload.route_summary}\n"
            f"Average congestion: {payload.average_congestion}\n"
            f"Phase: {payload.phase}\n"
            f"Reroute: {payload.reroute_suggestion or 'none'}"
        )
        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.4, "maxOutputTokens": 70},
        }
        req = request.Request(
            url=(
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"gemini-1.5-flash:generateContent?key={self.api_key}"
            ),
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with request.urlopen(req, timeout=5) as response:
            raw = json.loads(response.read().decode("utf-8"))
        text = raw["candidates"][0]["content"]["parts"][0]["text"].strip()
        return AdviceResponse(message=text, provider="gemini")

    def _fallback(self, payload: AdviceRequest) -> str:
        if payload.reroute_suggestion:
            return (
                f"Traffic is building during {payload.phase}. Follow the updated route now to avoid denser walkways "
                f"and keep your arrival smoother."
            )
        if payload.average_congestion > 0.55:
            return (
                f"The route is workable, but {payload.phase} congestion is rising. Stay on the highlighted path and "
                "avoid stopping near the busiest concourse hubs."
            )
        return (
            f"You have a stable route for {payload.phase}. Keep moving along the glowing path and you should reach "
            "your destination with minimal delay."
        )
