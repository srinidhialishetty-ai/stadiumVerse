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
        self.safe_exit_ids = [node["id"] for node in graph_data["nodes"] if node["type"] == "gate"]
        self.danger_zones: dict[str, dict] = {}
        self._refresh_emergency_state()

    def refresh(self, graph_data: dict) -> None:
        self.graph_data = graph_data
        self.nodes = {node["id"]: node for node in graph_data["nodes"]}
        self.edges = graph_data["edges"]
        self.safe_exit_ids = [node["id"] for node in graph_data["nodes"] if node["type"] == "gate"]
        self._refresh_emergency_state()

    def _refresh_emergency_state(self) -> None:
        self.danger_zones = {
            zone["node_id"]: zone
            for zone in self.graph_data.get("danger_zones", [])
        }

    def _node_is_dangerous(self, node_id: str) -> bool:
        return node_id in self.danger_zones

    def _validate_node(self, node_id: str) -> None:
        if node_id not in self.nodes:
            raise GraphError(f"Unknown node '{node_id}'")

    def _adjacency(
        self,
        accessible: bool,
        use_base: bool = False,
        emergency: bool = False,
        start: str | None = None,
        end: str | None = None,
    ) -> dict[str, list[dict]]:
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
            if emergency:
                blocked_nodes = {
                    node_id
                    for node_id in (edge["source"], edge["target"])
                    if self._node_is_dangerous(node_id) and node_id not in {start, end}
                }
                if blocked_nodes:
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

    def _edge_cost(self, edge: dict, end_id: str, emergency: bool = False) -> float:
        destination_wait = self.nodes[end_id].get("sim_wait_time", self.nodes[end_id]["base_wait_time"])
        accessibility_penalty = 0.0
        if not edge.get("accessible", True):
            accessibility_penalty += 25
        edge_penalty = edge["distance"] * (1 + edge["congestion"] * 1.8) + accessibility_penalty
        target_type = self.nodes[edge["target"]]["type"]
        if edge["target"] != end_id and target_type in {"food", "restroom", "vip", "gate"}:
            edge_penalty += 18
        if edge["target"] == end_id and self.nodes[end_id]["type"] in {"food", "restroom", "gate"}:
            edge_penalty += destination_wait * 2.1
        if emergency:
            target_zone = self.danger_zones.get(edge["target"])
            source_zone = self.danger_zones.get(edge["source"])
            severity_weight = {"moderate": 35, "high": 70, "critical": 120}
            if source_zone:
                edge_penalty += severity_weight[source_zone["severity"]] * 0.35
            if target_zone and edge["target"] != end_id:
                edge_penalty += severity_weight[target_zone["severity"]]
            if edge["congestion"] >= 0.85:
                edge_penalty += 120
            elif edge["congestion"] >= 0.7:
                edge_penalty += 65
            elif edge["congestion"] >= 0.55:
                edge_penalty += 25
        return edge_penalty

    def _run_path(
        self,
        start: str,
        end: str,
        accessible: bool = False,
        use_base: bool = False,
        emergency: bool = False,
    ) -> tuple[list[str], float]:
        self._validate_node(start)
        self._validate_node(end)
        if accessible and not self.nodes[end].get("accessible", True):
            raise GraphError(f"Destination '{end}' is not accessible")

        graph = self._adjacency(accessible, use_base=use_base, emergency=emergency, start=start, end=end)
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
                candidate = current_cost + self._edge_cost(edge, end, emergency=emergency)
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

    def _severity_for_path(self, path: list[str]) -> str | None:
        severity_rank = {"moderate": 1, "high": 2, "critical": 3}
        highest = None
        for node_id in path:
            severity = self.danger_zones.get(node_id, {}).get("severity")
            if severity and (highest is None or severity_rank[severity] > severity_rank[highest]):
                highest = severity
        return highest

    def shortest_path(self, start: str, end: str, accessible: bool = False, emergency: bool = False) -> dict:
        path, effort = self._run_path(start, end, accessible, emergency=emergency)
        route_edges = self._edges_for_path(path)
        total_distance = round(sum(edge["distance"] for edge in route_edges), 1)
        avg_congestion = round(sum(edge["congestion"] for edge in route_edges) / max(1, len(route_edges)), 2)
        walking_time = round(total_distance / 68, 1)
        wait_impact = round(
            self.nodes[end].get("sim_wait_time", self.nodes[end]["base_wait_time"])
            if self.nodes[end]["type"] in {"food", "restroom", "gate"}
            else 0.0,
            1,
        )
        congestion_score = round(avg_congestion * 100, 1)
        baseline_effort = 0.0
        try:
            _, baseline_effort = self._run_path(start, end, accessible, use_base=True)
        except GraphError:
            baseline_effort = 0.0
        reroute = None
        high_congestion_edges = sum(1 for edge in route_edges if edge["congestion"] >= 0.67)
        moderate_congestion_edges = sum(1 for edge in route_edges if 0.34 <= edge["congestion"] < 0.67)
        time_saved = round(max(0.0, (effort - baseline_effort) / 10), 1) if baseline_effort else 0.0
        if baseline_effort and (effort > baseline_effort * 1.2 or high_congestion_edges >= 2):
            reroute = "Heavy congestion detected ahead. Rerouting to faster path."

        explanation_parts = []
        if high_congestion_edges:
            explanation_parts.append(f"avoids {high_congestion_edges} high congestion corridor{'s' if high_congestion_edges > 1 else ''}")
        elif moderate_congestion_edges:
            explanation_parts.append(f"cuts through only {moderate_congestion_edges} moderate traffic segment{'s' if moderate_congestion_edges > 1 else ''}")
        else:
            explanation_parts.append("keeps you on clear concourses")
        if wait_impact >= 1:
            explanation_parts.append(f"saves about {wait_impact:.0f} minutes of queue exposure")
        if time_saved >= 1:
            explanation_parts.append(f"is less crowded than the shortest route by roughly {time_saved:.0f} effort-minutes")
        if accessible:
            explanation_parts.append("stays on accessible paths")
        avoided_zones = sorted(
            {
                zone_id
                for zone_id in self.danger_zones
                if zone_id not in path
                and any(zone_id in {edge["source"], edge["target"]} for edge in self.edges)
            }
        )
        if emergency:
            explanation_parts.append("steers away from active danger zones")
            explanation_parts.append("prioritizes safer, lower-pressure corridors to an exit")
        selection_reason = ". ".join(part[:1].upper() + part[1:] for part in explanation_parts) + "."

        return {
            "path": path,
            "labels": [self.nodes[node_id]["label"] for node_id in path],
            "walking_time_minutes": walking_time,
            "estimated_total_effort": effort,
            "congestion_score": congestion_score,
            "average_congestion": avg_congestion,
            "estimated_wait_impact": wait_impact,
            "selection_reason": selection_reason,
            "reroute_suggestion": reroute,
            "emergency": emergency,
            "avoided_zones": avoided_zones,
            "severity": self._severity_for_path(path),
            "recommended_exit": end if emergency and end in self.safe_exit_ids else None,
        }

    def emergency_route(self, start: str, accessible: bool = False) -> dict:
        self._validate_node(start)
        candidates = []

        for exit_id in self.safe_exit_ids:
            if accessible and not self.nodes[exit_id].get("accessible", True):
                continue
            if self._node_is_dangerous(exit_id):
                continue
            try:
                route = self.shortest_path(start, exit_id, accessible=accessible, emergency=True)
            except GraphError:
                continue
            score = (
                route["estimated_total_effort"]
                + route["average_congestion"] * 80
                + len(route["avoided_zones"]) * 3
            )
            candidates.append((score, route))

        if not candidates:
            raise GraphError("No safe emergency exit route is currently available")

        best_route = min(candidates, key=lambda item: item[0])[1]
        best_route["severity"] = best_route["severity"] or self._severity_for_path([start])
        return best_route

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
                    "walking_time_minutes": route["walking_time_minutes"],
                    "effective_wait_time": round(wait_time, 1),
                    "busyness_percent": int(round(candidate.get("sim_congestion", 0.2) * 100)),
                    "congestion": route["average_congestion"],
                    "reasoning": (
                        f"{candidate['label']} is the best option right now because it trims total effort with "
                        f"{round(wait_time, 1)} min wait and a {int(round(route['average_congestion'] * 100))}% crowd corridor."
                    ),
                }
            )

        return sorted(ranked, key=lambda item: item["score"])[:3]
