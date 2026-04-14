from __future__ import annotations

import asyncio
import contextlib
import json
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .models import AdviceRequest, AdviceResponse, RecommendationItem, RouteResponse
from .services.advice import AdviceService
from .services.data_loader import load_graph_data
from .services.routing import GraphError, RoutingService
from .services.simulation import SimulationEngine


simulation = SimulationEngine()
router = RoutingService(load_graph_data())
advice_service = AdviceService()
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


@asynccontextmanager
async def lifespan(_: FastAPI):
    async def updater():
        while True:
            snapshot = await simulation.advance()
            router.refresh(snapshot)
            await asyncio.sleep(4)

    task = asyncio.create_task(updater())
    try:
        yield
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="StadiumVerse", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/graph")
async def get_graph():
    return await simulation.snapshot()


@app.get("/route", response_model=RouteResponse)
async def get_route(start: str = Query(...), end: str = Query(...), accessible: bool = Query(False)):
    try:
        return router.shortest_path(start, end, accessible)
    except GraphError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/recommendations", response_model=list[RecommendationItem])
async def get_recommendations(
    type: str = Query(..., pattern="^(food|restroom)$"),
    from_node: str = Query(..., alias="from"),
    accessible: bool = Query(False),
):
    try:
        return router.recommendations(from_node, type, accessible)
    except GraphError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/ai_advice", response_model=AdviceResponse)
async def ai_advice(request: AdviceRequest):
    return advice_service.generate(request)


@app.websocket("/ws/simulation")
async def simulation_socket(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            snapshot = await simulation.snapshot()
            await websocket.send_text(json.dumps(snapshot))
            await asyncio.sleep(4)
    except WebSocketDisconnect:
        return


if FRONTEND_DIST.exists():
    assets_path = FRONTEND_DIST / "assets"
    if assets_path.exists():
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.exists() and candidate.is_file():
            return FileResponse(candidate)
        index_path = FRONTEND_DIST / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        raise HTTPException(status_code=404, detail="Frontend build not found")
