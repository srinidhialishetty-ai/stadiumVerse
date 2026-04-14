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
    walking_time_minutes: float
    estimated_total_effort: float
    congestion_score: float
    average_congestion: float
    estimated_wait_impact: float
    selection_reason: str
    reroute_suggestion: str | None = None
    emergency: bool = False
    avoided_zones: list[str] = Field(default_factory=list)
    severity: str | None = None
    recommended_exit: str | None = None


class DangerZone(BaseModel):
    node_id: str
    severity: Literal["moderate", "high", "critical"]
    congestion_value: float


class SeveritySummary(BaseModel):
    moderate: int = 0
    high: int = 0
    critical: int = 0


class SimulationSnapshot(BaseModel):
    phase: str
    tick: int
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    danger_zones: list[DangerZone] = Field(default_factory=list)
    severity_summary: SeveritySummary = Field(default_factory=SeveritySummary)
    recommended_exits: list[str] = Field(default_factory=list)


class RecommendationItem(BaseModel):
    id: str
    label: str
    type: Literal["food", "restroom"]
    score: float
    walk_distance: float
    walking_time_minutes: float
    effective_wait_time: float
    busyness_percent: int
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
