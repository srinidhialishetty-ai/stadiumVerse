from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.models import AdviceRequest
from backend.app.services.advice import AdviceService
from backend.app.services.data_loader import load_graph_data
from backend.app.services.routing import GraphError, RoutingService


def test_route_calculation_returns_path():
    service = RoutingService(load_graph_data())
    result = service.shortest_path("gate_a", "section_108")
    assert result["path"][0] == "gate_a"
    assert result["path"][-1] == "section_108"
    assert result["estimated_total_effort"] > 0


def test_recommendations_use_multiple_factors():
    service = RoutingService(load_graph_data())
    results = service.recommendations("section_103", "food")
    assert len(results) == 3
    assert all("congestion" in item for item in results)
    assert results[0]["score"] <= results[1]["score"]


def test_invalid_node_raises_error():
    service = RoutingService(load_graph_data())
    try:
        service.shortest_path("missing", "section_101")
    except GraphError as exc:
        assert "Unknown node" in str(exc)
    else:
        raise AssertionError("Expected GraphError for invalid node")


def test_accessible_route_blocks_inaccessible_destination():
    service = RoutingService(load_graph_data())
    try:
        service.shortest_path("gate_a", "section_111", accessible=True)
    except GraphError as exc:
        assert "not accessible" in str(exc)
    else:
        raise AssertionError("Expected GraphError for inaccessible destination")


def test_fallback_behavior_when_gemini_missing(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    advice = AdviceService().generate(
        AdviceRequest(
            start="gate_b",
            end="food_2",
            route_summary="Gate B to Food Stand 2",
            average_congestion=0.61,
            phase="Halftime Spike",
            reroute_suggestion=None,
        )
    )
    assert advice.provider == "fallback"
    assert advice.message


def test_reroute_logic_flags_degraded_route():
    data = load_graph_data()
    for edge in data["edges"]:
        if edge["source"] in {"concourse_ne", "food_2"} or edge["target"] in {"concourse_ne", "food_2"}:
            edge["congestion"] = 0.95
    service = RoutingService(data)
    result = service.shortest_path("gate_b", "food_2")
    assert result["reroute_suggestion"] is not None


def test_api_endpoints():
    client = TestClient(app)
    graph_response = client.get("/graph")
    assert graph_response.status_code == 200
    assert "nodes" in graph_response.json()

    route_response = client.get("/route", params={"start": "gate_a", "end": "section_102"})
    assert route_response.status_code == 200
    assert route_response.json()["path"][0] == "gate_a"

    recommendation_response = client.get("/recommendations", params={"type": "restroom", "from": "section_102"})
    assert recommendation_response.status_code == 200
    assert len(recommendation_response.json()) >= 1
