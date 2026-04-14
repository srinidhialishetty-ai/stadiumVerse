from __future__ import annotations

import json
from pathlib import Path


DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "stadium_graph.json"


def load_graph_data() -> dict:
    with DATA_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)
