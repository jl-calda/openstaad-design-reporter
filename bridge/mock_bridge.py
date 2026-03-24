"""
Mock OpenSTAAD Bridge Server for development/testing.

This provides fake structural data so you can develop the webapp
without needing STAAD.Pro installed.

Usage:
    python mock_bridge.py [--host HOST] [--port PORT]
"""

import asyncio
import json
import argparse
import logging
import math
import random

import websockets  # type: ignore
from websockets.server import serve  # type: ignore

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("mock-bridge")

# ── Mock Data ─────────────────────────────────────────────────────

MOCK_NODES = [
    {"id": 1, "x": 0.0, "y": 0.0, "z": 0.0},
    {"id": 2, "x": 5.0, "y": 0.0, "z": 0.0},
    {"id": 3, "x": 10.0, "y": 0.0, "z": 0.0},
    {"id": 4, "x": 0.0, "y": 3.5, "z": 0.0},
    {"id": 5, "x": 5.0, "y": 3.5, "z": 0.0},
    {"id": 6, "x": 10.0, "y": 3.5, "z": 0.0},
    {"id": 7, "x": 0.0, "y": 7.0, "z": 0.0},
    {"id": 8, "x": 5.0, "y": 7.0, "z": 0.0},
    {"id": 9, "x": 10.0, "y": 7.0, "z": 0.0},
    {"id": 10, "x": 0.0, "y": 0.0, "z": 5.0},
    {"id": 11, "x": 5.0, "y": 0.0, "z": 5.0},
    {"id": 12, "x": 10.0, "y": 0.0, "z": 5.0},
    {"id": 13, "x": 0.0, "y": 3.5, "z": 5.0},
    {"id": 14, "x": 5.0, "y": 3.5, "z": 5.0},
    {"id": 15, "x": 10.0, "y": 3.5, "z": 5.0},
    {"id": 16, "x": 0.0, "y": 7.0, "z": 5.0},
    {"id": 17, "x": 5.0, "y": 7.0, "z": 5.0},
    {"id": 18, "x": 10.0, "y": 7.0, "z": 5.0},
]

MOCK_BEAMS = [
    # Columns (ground to 1st floor)
    {"id": 1, "startNode": 1, "endNode": 4},
    {"id": 2, "startNode": 2, "endNode": 5},
    {"id": 3, "startNode": 3, "endNode": 6},
    {"id": 4, "startNode": 10, "endNode": 13},
    {"id": 5, "startNode": 11, "endNode": 14},
    {"id": 6, "startNode": 12, "endNode": 15},
    # Columns (1st to 2nd floor)
    {"id": 7, "startNode": 4, "endNode": 7},
    {"id": 8, "startNode": 5, "endNode": 8},
    {"id": 9, "startNode": 6, "endNode": 9},
    {"id": 10, "startNode": 13, "endNode": 16},
    {"id": 11, "startNode": 14, "endNode": 17},
    {"id": 12, "startNode": 15, "endNode": 18},
    # Beams (1st floor, front)
    {"id": 13, "startNode": 4, "endNode": 5},
    {"id": 14, "startNode": 5, "endNode": 6},
    # Beams (1st floor, back)
    {"id": 15, "startNode": 13, "endNode": 14},
    {"id": 16, "startNode": 14, "endNode": 15},
    # Beams (1st floor, cross)
    {"id": 17, "startNode": 4, "endNode": 13},
    {"id": 18, "startNode": 6, "endNode": 15},
    # Beams (2nd floor, front)
    {"id": 19, "startNode": 7, "endNode": 8},
    {"id": 20, "startNode": 8, "endNode": 9},
    # Beams (2nd floor, back)
    {"id": 21, "startNode": 16, "endNode": 17},
    {"id": 22, "startNode": 17, "endNode": 18},
    # Beams (2nd floor, cross)
    {"id": 23, "startNode": 7, "endNode": 16},
    {"id": 24, "startNode": 9, "endNode": 18},
]

MOCK_LOAD_CASES = [
    {"id": 1, "title": "Dead Load (DL)"},
    {"id": 2, "title": "Live Load (LL)"},
    {"id": 3, "title": "Wind Load (WL)"},
    {"id": 4, "title": "Seismic Load (EQ)"},
    {"id": 5, "title": "DL + LL Combination"},
]

SUPPORT_NODES = [1, 2, 3, 10, 11, 12]

connected = False


def dispatch(method: str, params: dict) -> dict:
    global connected

    if method == "connect":
        connected = True
        return {"status": "connected"}

    if method == "disconnect":
        connected = False
        return {"status": "disconnected"}

    if not connected:
        raise RuntimeError("Not connected. Call 'connect' first.")

    if method == "getProjectInfo":
        return {
            "fileName": "C:\\STAAD\\Projects\\TwoStoryFrame.std",
            "projectName": "Two-Story Steel Frame Structure",
        }

    if method == "getNodes":
        return {"count": len(MOCK_NODES), "nodes": MOCK_NODES}

    if method == "getBeams":
        return {"count": len(MOCK_BEAMS), "beams": MOCK_BEAMS}

    if method == "getMemberProperties":
        beam_id = params.get("beamId", 1)
        is_column = beam_id <= 12
        return {
            "beamId": beam_id,
            "sectionName": "W14X90" if is_column else "W12X65",
            "material": "STEEL",
        }

    if method == "getLoadCases":
        return {"count": len(MOCK_LOAD_CASES), "cases": MOCK_LOAD_CASES}

    if method == "getSupports":
        return {
            "count": len(SUPPORT_NODES),
            "supports": [{"nodeId": n} for n in SUPPORT_NODES],
        }

    if method == "getNodeDisplacements":
        lc = params.get("loadCase", 1)
        displacements = []
        for node in MOCK_NODES:
            # Generate realistic-ish displacements (smaller near supports)
            height_factor = node["y"] / 7.0
            base_disp = 0.002 * height_factor * lc
            displacements.append({
                "nodeId": node["id"],
                "dx": round(base_disp * random.uniform(0.5, 1.5), 6),
                "dy": round(-base_disp * random.uniform(0.8, 2.0), 6),
                "dz": round(base_disp * random.uniform(0.2, 0.8), 6),
                "rx": round(base_disp * 0.001 * random.uniform(-1, 1), 8),
                "ry": round(base_disp * 0.001 * random.uniform(-1, 1), 8),
                "rz": round(base_disp * 0.001 * random.uniform(-1, 1), 8),
            })
        return {"loadCase": lc, "displacements": displacements}

    if method == "getSupportReactions":
        lc = params.get("loadCase", 1)
        reactions = []
        for nid in SUPPORT_NODES:
            reactions.append({
                "nodeId": nid,
                "fx": round(random.uniform(-5, 5) * lc, 2),
                "fy": round(random.uniform(20, 80) * lc, 2),
                "fz": round(random.uniform(-3, 3) * lc, 2),
                "mx": round(random.uniform(-10, 10) * lc, 2),
                "my": round(random.uniform(-5, 5) * lc, 2),
                "mz": round(random.uniform(-15, 15) * lc, 2),
            })
        return {"loadCase": lc, "reactions": reactions}

    if method == "getMemberForces":
        beam_id = params.get("beamId", 1)
        lc = params.get("loadCase", 1)
        sections = []
        for sec in ["start", "end"]:
            sign = 1 if sec == "start" else -1
            sections.append({
                "section": sec,
                "fx": round(sign * random.uniform(5, 50) * lc, 2),
                "fy": round(sign * random.uniform(10, 80) * lc, 2),
                "fz": round(sign * random.uniform(2, 20) * lc, 2),
                "mx": round(sign * random.uniform(1, 15) * lc, 2),
                "my": round(sign * random.uniform(5, 40) * lc, 2),
                "mz": round(sign * random.uniform(5, 60) * lc, 2),
            })
        return {"beamId": beam_id, "loadCase": lc, "forces": sections}

    raise ValueError(f"Unknown method: {method}")


async def handle_client(websocket):
    client_addr = websocket.remote_address
    logger.info(f"Client connected: {client_addr}")
    try:
        async for raw_message in websocket:
            try:
                message = json.loads(raw_message)
                msg_id = message.get("id")
                method = message.get("method")
                params = message.get("params", {})
                logger.info(f"<- {method}({json.dumps(params)[:200]})")

                result = dispatch(method, params)
                response = {"id": msg_id, "result": result, "error": None}
            except Exception as e:
                logger.error(f"Error: {e}")
                response = {
                    "id": message.get("id") if isinstance(message, dict) else None,
                    "result": None,
                    "error": {"message": str(e)},
                }
            await websocket.send(json.dumps(response))
    except websockets.exceptions.ConnectionClosed:
        logger.info(f"Client disconnected: {client_addr}")


async def main(host: str, port: int):
    logger.info(f"Mock OpenSTAAD Bridge on ws://{host}:{port}")
    logger.info("Serving fake structural data for development...")
    async with serve(handle_client, host, port):
        await asyncio.Future()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Mock OpenSTAAD Bridge")
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    asyncio.run(main(args.host, args.port))
