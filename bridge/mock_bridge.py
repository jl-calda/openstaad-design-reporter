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

# Mutable state for write operations
mock_nodes = list(MOCK_NODES)
mock_beams = list(MOCK_BEAMS)
mock_load_cases = list(MOCK_LOAD_CASES)
mock_supports = list(SUPPORT_NODES)
mock_node_loads: list[dict] = []
mock_member_loads: list[dict] = []
mock_member_properties: dict[int, dict] = {}
next_node_id = max(n["id"] for n in MOCK_NODES) + 1
next_beam_id = max(b["id"] for b in MOCK_BEAMS) + 1
next_lc_id = max(lc["id"] for lc in MOCK_LOAD_CASES) + 1
connected = False


def dispatch(method: str, params: dict) -> dict:
    global connected, next_node_id, next_beam_id, next_lc_id

    if method == "connect":
        connected = True
        return {"status": "connected"}

    if method == "disconnect":
        connected = False
        return {"status": "disconnected"}

    if not connected:
        raise RuntimeError("Not connected. Call 'connect' first.")

    # ── Read Operations ──────────────────────────────────────────

    if method == "getProjectInfo":
        return {
            "fileName": "C:\\STAAD\\Projects\\TwoStoryFrame.std",
            "projectName": "Two-Story Steel Frame Structure",
        }

    if method == "getNodes":
        return {"count": len(mock_nodes), "nodes": list(mock_nodes)}

    if method == "getBeams":
        return {"count": len(mock_beams), "beams": list(mock_beams)}

    if method == "getMemberProperties":
        beam_id = params.get("beamId", 1)
        if beam_id in mock_member_properties:
            return mock_member_properties[beam_id]
        is_column = beam_id <= 12
        return {
            "beamId": beam_id,
            "sectionName": "W14X90" if is_column else "W12X65",
            "material": "STEEL",
        }

    if method == "getLoadCases":
        return {"count": len(mock_load_cases), "cases": list(mock_load_cases)}

    if method == "getSupports":
        return {
            "count": len(mock_supports),
            "supports": [{"nodeId": n} for n in mock_supports],
        }

    if method == "getNodeDisplacements":
        lc = params.get("loadCase", 1)
        displacements = []
        for node in mock_nodes:
            height_factor = node["y"] / 7.0 if node["y"] != 0 else 0
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
        for nid in mock_supports:
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

    # ── Write: Geometry ──────────────────────────────────────────

    if method == "createNode":
        x = params.get("x", 0.0)
        y = params.get("y", 0.0)
        z = params.get("z", 0.0)
        node_id = next_node_id
        next_node_id += 1
        new_node = {"id": node_id, "x": float(x), "y": float(y), "z": float(z)}
        mock_nodes.append(new_node)
        logger.info(f"Created node {node_id} at ({x}, {y}, {z})")
        return {"nodeId": node_id, "x": x, "y": y, "z": z}

    if method == "deleteNode":
        node_id = params["nodeId"]
        before = len(mock_nodes)
        mock_nodes[:] = [n for n in mock_nodes if n["id"] != node_id]
        if len(mock_nodes) == before:
            raise ValueError(f"Node {node_id} not found")
        # Also remove any members connected to this node
        mock_beams[:] = [
            b for b in mock_beams
            if b["startNode"] != node_id and b["endNode"] != node_id
        ]
        # Remove from supports if present
        if node_id in mock_supports:
            mock_supports.remove(node_id)
        logger.info(f"Deleted node {node_id}")
        return {"deleted": True, "nodeId": node_id}

    if method == "createMember":
        start_node = params["startNode"]
        end_node = params["endNode"]
        # Validate nodes exist
        node_ids = {n["id"] for n in mock_nodes}
        if start_node not in node_ids:
            raise ValueError(f"Start node {start_node} does not exist")
        if end_node not in node_ids:
            raise ValueError(f"End node {end_node} does not exist")
        member_id = next_beam_id
        next_beam_id += 1
        mock_beams.append({"id": member_id, "startNode": start_node, "endNode": end_node})
        logger.info(f"Created member {member_id}: {start_node} -> {end_node}")
        return {"memberId": member_id, "startNode": start_node, "endNode": end_node}

    if method == "deleteMember":
        member_id = params["memberId"]
        before = len(mock_beams)
        mock_beams[:] = [b for b in mock_beams if b["id"] != member_id]
        if len(mock_beams) == before:
            raise ValueError(f"Member {member_id} not found")
        logger.info(f"Deleted member {member_id}")
        return {"deleted": True, "memberId": member_id}

    # ── Write: Properties ────────────────────────────────────────

    if method == "assignMemberProperty":
        member_id = params["memberId"]
        section_name = params["sectionName"]
        # Verify member exists
        if not any(b["id"] == member_id for b in mock_beams):
            raise ValueError(f"Member {member_id} not found")
        mock_member_properties[member_id] = {
            "beamId": member_id,
            "sectionName": section_name,
            "material": "STEEL",
        }
        logger.info(f"Assigned {section_name} to member {member_id}")
        return {"memberId": member_id, "sectionName": section_name}

    # ── Write: Supports ──────────────────────────────────────────

    if method == "addSupport":
        node_id = params["nodeId"]
        support_type = params.get("supportType", "fixed")
        if not any(n["id"] == node_id for n in mock_nodes):
            raise ValueError(f"Node {node_id} does not exist")
        if node_id not in mock_supports:
            mock_supports.append(node_id)
        logger.info(f"Added {support_type} support at node {node_id}")
        return {"nodeId": node_id, "supportType": support_type.upper()}

    if method == "removeSupport":
        node_id = params["nodeId"]
        if node_id not in mock_supports:
            raise ValueError(f"Node {node_id} has no support")
        mock_supports.remove(node_id)
        logger.info(f"Removed support from node {node_id}")
        return {"removed": True, "nodeId": node_id}

    # ── Write: Loads ─────────────────────────────────────────────

    if method == "createLoadCase":
        title = params["title"]
        lc_id = next_lc_id
        next_lc_id += 1
        mock_load_cases.append({"id": lc_id, "title": title})
        logger.info(f"Created load case {lc_id}: {title}")
        return {"loadCaseId": lc_id, "title": title}

    if method == "deleteLoadCase":
        lc_id = params["loadCaseId"]
        before = len(mock_load_cases)
        mock_load_cases[:] = [lc for lc in mock_load_cases if lc["id"] != lc_id]
        if len(mock_load_cases) == before:
            raise ValueError(f"Load case {lc_id} not found")
        # Remove associated loads
        mock_node_loads[:] = [nl for nl in mock_node_loads if nl["loadCase"] != lc_id]
        mock_member_loads[:] = [ml for ml in mock_member_loads if ml["loadCase"] != lc_id]
        logger.info(f"Deleted load case {lc_id}")
        return {"deleted": True, "loadCaseId": lc_id}

    if method == "addNodeLoad":
        node_id = params["nodeId"]
        load_case = params["loadCase"]
        if not any(n["id"] == node_id for n in mock_nodes):
            raise ValueError(f"Node {node_id} does not exist")
        if not any(lc["id"] == load_case for lc in mock_load_cases):
            raise ValueError(f"Load case {load_case} does not exist")
        load = {
            "nodeId": node_id, "loadCase": load_case,
            "fx": params.get("fx", 0), "fy": params.get("fy", 0), "fz": params.get("fz", 0),
            "mx": params.get("mx", 0), "my": params.get("my", 0), "mz": params.get("mz", 0),
        }
        mock_node_loads.append(load)
        logger.info(f"Added node load at node {node_id}, LC {load_case}")
        return load

    if method == "addMemberLoad":
        member_id = params["memberId"]
        load_case = params["loadCase"]
        if not any(b["id"] == member_id for b in mock_beams):
            raise ValueError(f"Member {member_id} does not exist")
        if not any(lc["id"] == load_case for lc in mock_load_cases):
            raise ValueError(f"Load case {load_case} does not exist")
        load = {
            "memberId": member_id, "loadCase": load_case,
            "loadType": params.get("loadType", "uniform"),
            "direction": params.get("direction", "GY"),
            "w1": params.get("w1", 0), "w2": params.get("w2", 0),
            "d1": params.get("d1", 0), "d2": params.get("d2", 0),
        }
        mock_member_loads.append(load)
        logger.info(f"Added member load on member {member_id}, LC {load_case}")
        return load

    # ── Analysis ─────────────────────────────────────────────────

    if method == "runAnalysis":
        logger.info("Running mock analysis...")
        return {"status": "analysis_complete"}

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
