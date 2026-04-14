from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


NodeType = Literal["gate", "food", "restroom", "seat", "vip", "connector"]


class StadiumNode(BaseModel):
    id: str
    label: str
    type: NodeType
    position: list[float]
    base_wait_time: float
    capacity: int
    accessible: bool = True
    metadata: dict[str, Any] = Field(default_factory=dict)


class StadiumEdge(BaseModel):
    source: str
    target: str
    distance: float
    congestion: float
    accessible: bool = True


class RouteResponse(BaseModel):
    path: list[str]
    labels: list[str]
    estimated_total_effort: float
    average_congestion: float
    estimated_wait_impact: float
    reroute_suggestion: str | None = None


class RecommendationItem(BaseModel):
    id: str
    label: str
    type: Literal["food", "restroom"]
    score: float
    walk_distance: float
    effective_wait_time: float
    congestion: float
    reasoning: str


class AdviceRequest(BaseModel):
    start: str
    end: str
    route_summary: str
    average_congestion: float
    phase: str
    reroute_suggestion: str | None = None


class AdviceResponse(BaseModel):
    message: str
    provider: Literal["gemini", "fallback"]
