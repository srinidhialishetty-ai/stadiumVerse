from __future__ import annotations

import asyncio
import random
import time
from copy import deepcopy

from .data_loader import load_graph_data


PHASE_DURATION = 45
PHASES = ["Entry Rush", "Early Event", "Halftime Spike", "Exit Surge"]

PHASE_CLUMPS = {
    "Entry Rush": {
        "boost_nodes": {"gate_a", "gate_b", "gate_c", "gate_d", "concourse_nw", "concourse_ne"},
        "boost_types": {"gate": 0.28, "connector": 0.14},
    },
    "Early Event": {
        "boost_nodes": {"section_101", "section_102", "section_103", "section_104", "inner_ring_n"},
        "boost_types": {"seat": 0.1, "connector": 0.06},
    },
    "Halftime Spike": {
        "boost_nodes": {
            "food_1", "food_2", "food_3", "food_4",
            "restroom_1", "restroom_2", "restroom_3", "restroom_4",
            "concourse_n", "concourse_s"
        },
        "boost_types": {"food": 0.34, "restroom": 0.2, "connector": 0.16},
    },
    "Exit Surge": {
        "boost_nodes": {"gate_c", "gate_d", "concourse_s", "concourse_se", "concourse_sw"},
        "boost_types": {"gate": 0.24, "connector": 0.15},
    },
}


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
            return {
                "phase": self.current_phase(),
                "tick": self.tick,
                "nodes": deepcopy(self.current_graph["nodes"]),
                "edges": deepcopy(self.current_graph["edges"]),
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
                pulse = random.uniform(-0.04, 0.08)
                node["sim_wait_time"] = max(0.0, round(base["base_wait_time"] * (1 + boost + pulse), 1))
                node["sim_congestion"] = min(0.98, max(0.05, round(0.18 + boost + random.uniform(0, 0.2), 2)))

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

            return {
                "phase": phase,
                "tick": self.tick,
                "nodes": deepcopy(self.current_graph["nodes"]),
                "edges": deepcopy(self.current_graph["edges"]),
            }
