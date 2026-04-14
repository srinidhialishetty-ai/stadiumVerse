from __future__ import annotations

import heapq
from collections import defaultdict
from math import inf


class GraphError(ValueError):
    pass


class RoutingService:
    def __init__(self, graph_data: dict):
        self.graph_data = graph_data
        self.base_edges = [dict(edge) for edge in graph_data["edges"]]
        self.nodes = {node["id"]: node for node in graph_data["nodes"]}
        self.edges = graph_data["edges"]

    def refresh(self, graph_data: dict) -> None:
        self.graph_data = graph_data
        self.nodes = {node["id"]: node for node in graph_data["nodes"]}
        self.edges = graph_data["edges"]

    def _validate_node(self, node_id: str) -> None:
        if node_id not in self.nodes:
            raise GraphError(f"Unknown node '{node_id}'")

    def _adjacency(self, accessible: bool, use_base: bool = False) -> dict[str, list[dict]]:
        graph = defaultdict(list)
        edges = self.base_edges if use_base else self.edges
        for edge in edges:
            if accessible and not edge.get("accessible", True):
                continue
            if accessible:
                if not self.nodes[edge["source"]].get("accessible", True):
                    continue
                if not self.nodes[edge["target"]].get("accessible", True):
                    continue
            graph[edge["source"]].append(edge)
            graph[edge["target"]].append(
                {
                    "source": edge["target"],
                    "target": edge["source"],
                    "distance": edge["distance"],
                    "congestion": edge["congestion"],
                    "accessible": edge.get("accessible", True),
                }
            )
        return graph

    def _edge_cost(self, edge: dict, end_id: str) -> float:
        destination_wait = self.nodes[end_id].get("sim_wait_time", self.nodes[end_id]["base_wait_time"])
        edge_penalty = edge["distance"] * (1 + edge["congestion"] * 1.8)
        target_type = self.nodes[edge["target"]]["type"]
        if edge["target"] != end_id and target_type in {"food", "restroom", "vip", "gate"}:
            edge_penalty += 18
        if edge["target"] == end_id and self.nodes[end_id]["type"] in {"food", "restroom", "gate"}:
            edge_penalty += destination_wait * 2.1
        return edge_penalty

    def _run_path(self, start: str, end: str, accessible: bool = False, use_base: bool = False) -> tuple[list[str], float]:
        self._validate_node(start)
        self._validate_node(end)
        if accessible and not self.nodes[end].get("accessible", True):
            raise GraphError(f"Destination '{end}' is not accessible")

        graph = self._adjacency(accessible, use_base=use_base)
        heap = [(0.0, start)]
        costs = {start: 0.0}
        previous: dict[str, str | None] = {start: None}

        while heap:
            current_cost, node_id = heapq.heappop(heap)
            if node_id == end:
                break
            if current_cost > costs.get(node_id, inf):
                continue
            for edge in graph.get(node_id, []):
                candidate = current_cost + self._edge_cost(edge, end)
                if candidate < costs.get(edge["target"], inf):
                    costs[edge["target"]] = candidate
                    previous[edge["target"]] = node_id
                    heapq.heappush(heap, (candidate, edge["target"]))

        if end not in previous and start != end:
            raise GraphError(f"No route found between '{start}' and '{end}'")

        path = [end]
        while path[-1] != start:
            prev = previous.get(path[-1])
            if prev is None:
                break
            path.append(prev)
        path.reverse()
        return path, round(costs.get(end, 0.0), 1)

    def shortest_path(self, start: str, end: str, accessible: bool = False) -> dict:
        path, effort = self._run_path(start, end, accessible)
        route_edges = self._edges_for_path(path)
        avg_congestion = round(sum(edge["congestion"] for edge in route_edges) / max(1, len(route_edges)), 2)
        wait_impact = round(
            self.nodes[end].get("sim_wait_time", self.nodes[end]["base_wait_time"])
            if self.nodes[end]["type"] in {"food", "restroom", "gate"}
            else 0.0,
            1,
        )
        baseline_effort = 0.0
        try:
            _, baseline_effort = self._run_path(start, end, accessible, use_base=True)
        except GraphError:
            baseline_effort = 0.0
        reroute = None
        if baseline_effort and effort > baseline_effort * 1.2:
            reroute = "Current route has degraded. Switching to a less crowded path is recommended."

        return {
            "path": path,
            "labels": [self.nodes[node_id]["label"] for node_id in path],
            "estimated_total_effort": effort,
            "average_congestion": avg_congestion,
            "estimated_wait_impact": wait_impact,
            "reroute_suggestion": reroute,
        }

    def _edges_for_path(self, path: list[str]) -> list[dict]:
        found = []
        for source, target in zip(path, path[1:]):
            for edge in self.edges:
                if {edge["source"], edge["target"]} == {source, target}:
                    found.append(edge)
                    break
        return found

    def recommendations(self, start: str, amenity_type: str, accessible: bool = False) -> list[dict]:
        self._validate_node(start)
        if amenity_type not in {"food", "restroom"}:
            raise GraphError("Recommendation type must be 'food' or 'restroom'")

        candidates = [node for node in self.nodes.values() if node["type"] == amenity_type]
        ranked = []
        for candidate in candidates:
            if accessible and not candidate.get("accessible", True):
                continue
            route = self.shortest_path(start, candidate["id"], accessible)
            wait_time = candidate.get("sim_wait_time", candidate["base_wait_time"])
            score = round(
                route["estimated_total_effort"] * 0.45
                + wait_time * 2.7
                + route["average_congestion"] * 28,
                2,
            )
            ranked.append(
                {
                    "id": candidate["id"],
                    "label": candidate["label"],
                    "type": candidate["type"],
                    "score": score,
                    "walk_distance": round(sum(edge["distance"] for edge in self._edges_for_path(route["path"])), 1),
                    "effective_wait_time": round(wait_time, 1),
                    "congestion": route["average_congestion"],
                    "reasoning": f"{candidate['label']} balances travel effort, queue time, and corridor congestion better than nearby options.",
                }
            )

        return sorted(ranked, key=lambda item: item["score"])[:3]
