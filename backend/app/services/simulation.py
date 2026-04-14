from __future__ import annotations

import asyncio
import random
import time
from copy import deepcopy

from .data_loader import load_graph_data


PHASE_DURATION = 40
PHASES = ["Entry Rush", "Settling Phase", "Halftime Spike", "Late Match Dispersal", "Exit Surge"]

PHASE_CLUMPS = {
    "Entry Rush": {
        "boost_nodes": {"gate_a", "gate_b", "gate_c", "gate_d", "concourse_nw", "concourse_ne", "concourse_w", "concourse_e"},
        "boost_types": {"gate": 0.28, "connector": 0.14},
    },
    "Settling Phase": {
        "boost_nodes": {"section_101", "section_102", "section_103", "section_104", "section_107", "section_108", "inner_ring_n", "inner_ring_s"},
        "boost_types": {"seat": 0.11, "connector": 0.07},
    },
    "Halftime Spike": {
        "boost_nodes": {
            "food_1", "food_2", "food_3", "food_4",
            "restroom_1", "restroom_2", "restroom_3", "restroom_4",
            "concourse_n", "concourse_s", "concourse_e", "concourse_w"
        },
        "boost_types": {"food": 0.34, "restroom": 0.2, "connector": 0.16},
    },
    "Late Match Dispersal": {
        "boost_nodes": {"concourse_e", "concourse_w", "inner_ring_s", "section_105", "section_106", "section_111", "section_112"},
        "boost_types": {"seat": 0.08, "connector": 0.12},
    },
    "Exit Surge": {
        "boost_nodes": {"gate_c", "gate_d", "concourse_s", "concourse_se", "concourse_sw", "concourse_w", "concourse_e"},
        "boost_types": {"gate": 0.24, "connector": 0.15},
    },
}

DENSITY_THRESHOLDS = {
    "moderate": 0.55,
    "high": 0.72,
    "critical": 0.88,
}


def _severity_for_density(density: float) -> str | None:
    if density >= DENSITY_THRESHOLDS["critical"]:
        return "critical"
    if density >= DENSITY_THRESHOLDS["high"]:
        return "high"
    if density >= DENSITY_THRESHOLDS["moderate"]:
        return "moderate"
    return None


class SimulationEngine:
    def __init__(self) -> None:
        base_data = load_graph_data()
        self.base_graph = base_data
        self.current_graph = deepcopy(base_data)
        self.tick = 0
        self.started_at = time.time()
        self._lock = asyncio.Lock()

    def current_phase(self) -> str:
        index = int((time.time() - self.started_at) // PHASE_DURATION) % len(PHASES)
        return PHASES[index]

    async def snapshot(self) -> dict:
        async with self._lock:
            return self._build_snapshot(self.current_phase())

    def _build_snapshot(self, phase: str) -> dict:
        danger_zones = []
        severity_summary = {"moderate": 0, "high": 0, "critical": 0}

        for node in self.current_graph["nodes"]:
            severity = node.get("severity_level")
            if not severity:
                continue
            danger_zones.append(
                {
                    "node_id": node["id"],
                    "severity": severity,
                    "congestion_value": node.get("sim_congestion", 0.0),
                }
            )
            severity_summary[severity] += 1

        recommended_exits = [
            node["id"]
            for node in sorted(
                (
                    node for node in self.current_graph["nodes"]
                    if node["type"] == "gate" and not node.get("danger_zone", False)
                ),
                key=lambda item: (item.get("sim_congestion", 0.0), item.get("sim_wait_time", item["base_wait_time"])),
            )
        ]

        return {
            "phase": phase,
            "tick": self.tick,
            "nodes": deepcopy(self.current_graph["nodes"]),
            "edges": deepcopy(self.current_graph["edges"]),
            "danger_zones": danger_zones,
            "severity_summary": severity_summary,
            "recommended_exits": recommended_exits,
        }

    async def advance(self) -> dict:
        async with self._lock:
            self.tick += 1
            phase = self.current_phase()
            clump = PHASE_CLUMPS[phase]
            base_nodes = {node["id"]: node for node in self.base_graph["nodes"]}
            base_edges = {
                tuple(sorted((edge["source"], edge["target"]))): edge
                for edge in self.base_graph["edges"]
            }
            node_lookup = {node["id"]: node for node in self.current_graph["nodes"]}

            for node in self.current_graph["nodes"]:
                base = base_nodes[node["id"]]
                boost = clump["boost_types"].get(node["type"], 0.0)
                if node["id"] in clump["boost_nodes"]:
                    boost += 0.14
                neighborhood = 0.0
                if node["type"] == "connector":
                    neighborhood = 0.08
                elif node["type"] in {"food", "restroom"}:
                    neighborhood = 0.12
                pulse = random.uniform(-0.03, 0.06)
                node["sim_wait_time"] = max(0.0, round(base["base_wait_time"] * (1 + boost + neighborhood + pulse), 1))
                node["sim_congestion"] = min(0.98, max(0.05, round(0.16 + boost + neighborhood + random.uniform(0, 0.16), 2)))
                node["busyness_percent"] = int(round(node["sim_congestion"] * 100))
                density = min(
                    0.99,
                    round(
                        node["sim_congestion"] * 0.7
                        + min(0.28, node["sim_wait_time"] / max(1, base["capacity"])) * 4
                        + (0.06 if node["type"] == "connector" else 0.0),
                        2,
                    ),
                )
                severity = _severity_for_density(density)
                node["crowd_density"] = density
                node["severity_level"] = severity
                node["danger_zone"] = severity is not None

            for edge in self.current_graph["edges"]:
                key = tuple(sorted((edge["source"], edge["target"])))
                base = base_edges[key]
                source_boost = node_lookup[edge["source"]].get("sim_congestion", 0.2)
                target_boost = node_lookup[edge["target"]].get("sim_congestion", 0.2)
                area_bonus = 0.08 if edge["source"] in clump["boost_nodes"] or edge["target"] in clump["boost_nodes"] else 0.0
                edge["congestion"] = min(
                    0.99,
                    max(0.05, round(base["congestion"] * 0.55 + ((source_boost + target_boost) / 2) * 0.45 + area_bonus, 2)),
                )
                edge["heat_percent"] = int(round(edge["congestion"] * 100))

            return self._build_snapshot(phase)
