"""
OpenSTAAD WebSocket Bridge Server

This bridge runs on a Windows machine with STAAD.Pro installed.
It connects to the running STAAD.Pro instance via COM/ActiveX (OpenSTAAD API)
and exposes the functionality over WebSocket so a web browser can communicate
with it.

Usage:
    python openstaad_bridge.py [--host HOST] [--port PORT]

Requirements:
    - Windows OS with STAAD.Pro installed and running
    - pip install websockets pywin32
"""

import asyncio
import json
import argparse
import logging
import traceback
from typing import Any

try:
    import win32com.client  # type: ignore
    HAS_WIN32 = True
except ImportError:
    HAS_WIN32 = False

import websockets  # type: ignore
from websockets.server import serve  # type: ignore

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("openstaad-bridge")


class OpenSTAADBridge:
    """Wraps the OpenSTAAD COM API and provides a JSON-RPC style interface."""

    def __init__(self):
        self._openstaad = None
        self._geometry = None
        self._output = None
        self._load = None
        self._property = None
        self._support = None

    def connect(self) -> dict:
        """Connect to the running STAAD.Pro instance via COM."""
        if not HAS_WIN32:
            raise RuntimeError(
                "pywin32 is not installed. Install with: pip install pywin32"
            )
        try:
            self._openstaad = win32com.client.GetActiveObject("StaadPro.OpenSTAAD")
            # Cache sub-objects for convenience
            self._geometry = self._openstaad.Geometry
            self._output = self._openstaad.Output
            self._load = self._openstaad.Load
            self._property = self._openstaad.Property
            self._support = self._openstaad.Support
            return {"status": "connected"}
        except Exception as e:
            raise RuntimeError(
                f"Could not connect to STAAD.Pro. Is it running? Error: {e}"
            )

    def disconnect(self) -> dict:
        """Release the COM connection."""
        self._openstaad = None
        self._geometry = None
        self._output = None
        self._load = None
        self._property = None
        self._support = None
        return {"status": "disconnected"}

    def _require_connection(self):
        if self._openstaad is None:
            raise RuntimeError("Not connected to STAAD.Pro. Call 'connect' first.")

    # ── Project Info ──────────────────────────────────────────────

    def get_project_info(self) -> dict:
        self._require_connection()
        return {
            "fileName": self._openstaad.GetSTAADFile(),
            "projectName": self._openstaad.GetProjectName() or "Untitled",
        }

    # ── Geometry ──────────────────────────────────────────────────

    def get_nodes(self) -> dict:
        self._require_connection()
        geo = self._geometry
        node_count = geo.GetNodeCount()
        nodes = []
        node_list = geo.GetNodeList()
        if node_list:
            for node_id in node_list:
                x = geo.GetNodeCoordinateX(node_id)
                y = geo.GetNodeCoordinateY(node_id)
                z = geo.GetNodeCoordinateZ(node_id)
                nodes.append({"id": node_id, "x": x, "y": y, "z": z})
        return {"count": node_count, "nodes": nodes}

    def get_beams(self) -> dict:
        self._require_connection()
        geo = self._geometry
        beam_count = geo.GetMemberCount()
        beams = []
        beam_list = geo.GetBeamList()
        if beam_list:
            for beam_id in beam_list:
                start_node = geo.GetMemberIncidence(beam_id, 0)
                end_node = geo.GetMemberIncidence(beam_id, 1)
                beams.append({
                    "id": beam_id,
                    "startNode": start_node,
                    "endNode": end_node,
                })
        return {"count": beam_count, "beams": beams}

    # ── Properties ────────────────────────────────────────────────

    def get_member_properties(self, beam_id: int) -> dict:
        self._require_connection()
        prop = self._property
        return {
            "beamId": beam_id,
            "sectionName": prop.GetMemberSectionName(beam_id),
            "material": prop.GetMemberMaterialName(beam_id),
        }

    # ── Loads ─────────────────────────────────────────────────────

    def get_load_cases(self) -> dict:
        self._require_connection()
        load = self._load
        count = load.GetLoadCaseCount()
        cases = []
        for i in range(1, count + 1):
            cases.append({
                "id": i,
                "title": load.GetLoadCaseTitle(i),
            })
        return {"count": count, "cases": cases}

    # ── Supports ──────────────────────────────────────────────────

    def get_supports(self) -> dict:
        self._require_connection()
        sup = self._support
        support_list = sup.GetSupportNodes()
        supports = []
        if support_list:
            for node_id in support_list:
                supports.append({"nodeId": node_id})
        return {"count": len(supports), "supports": supports}

    # ── Analysis Results ──────────────────────────────────────────

    def get_node_displacements(self, load_case: int) -> dict:
        self._require_connection()
        out = self._output
        geo = self._geometry
        node_list = geo.GetNodeList()
        displacements = []
        if node_list:
            for node_id in node_list:
                dx = out.GetNodeDisplacement(node_id, load_case, 0)  # X
                dy = out.GetNodeDisplacement(node_id, load_case, 1)  # Y
                dz = out.GetNodeDisplacement(node_id, load_case, 2)  # Z
                rx = out.GetNodeDisplacement(node_id, load_case, 3)  # RX
                ry = out.GetNodeDisplacement(node_id, load_case, 4)  # RY
                rz = out.GetNodeDisplacement(node_id, load_case, 5)  # RZ
                displacements.append({
                    "nodeId": node_id,
                    "dx": dx, "dy": dy, "dz": dz,
                    "rx": rx, "ry": ry, "rz": rz,
                })
        return {"loadCase": load_case, "displacements": displacements}

    def get_support_reactions(self, load_case: int) -> dict:
        self._require_connection()
        out = self._output
        sup = self._support
        support_nodes = sup.GetSupportNodes()
        reactions = []
        if support_nodes:
            for node_id in support_nodes:
                fx = out.GetSupportReaction(node_id, load_case, 0)
                fy = out.GetSupportReaction(node_id, load_case, 1)
                fz = out.GetSupportReaction(node_id, load_case, 2)
                mx = out.GetSupportReaction(node_id, load_case, 3)
                my = out.GetSupportReaction(node_id, load_case, 4)
                mz = out.GetSupportReaction(node_id, load_case, 5)
                reactions.append({
                    "nodeId": node_id,
                    "fx": fx, "fy": fy, "fz": fz,
                    "mx": mx, "my": my, "mz": mz,
                })
        return {"loadCase": load_case, "reactions": reactions}

    def get_member_forces(self, beam_id: int, load_case: int) -> dict:
        self._require_connection()
        out = self._output
        # Get forces at start and end of member
        sections = []
        for section in [0, 1]:  # 0=start, 1=end
            fx = out.GetMemberEndForces(beam_id, section, load_case, 0)
            fy = out.GetMemberEndForces(beam_id, section, load_case, 1)
            fz = out.GetMemberEndForces(beam_id, section, load_case, 2)
            mx = out.GetMemberEndForces(beam_id, section, load_case, 3)
            my = out.GetMemberEndForces(beam_id, section, load_case, 4)
            mz = out.GetMemberEndForces(beam_id, section, load_case, 5)
            sections.append({
                "section": "start" if section == 0 else "end",
                "fx": fx, "fy": fy, "fz": fz,
                "mx": mx, "my": my, "mz": mz,
            })
        return {"beamId": beam_id, "loadCase": load_case, "forces": sections}

    # ── Dispatch ──────────────────────────────────────────────────

    def dispatch(self, method: str, params: dict | None = None) -> Any:
        """Route a JSON-RPC style method to the appropriate handler."""
        params = params or {}
        handlers = {
            "connect": self.connect,
            "disconnect": self.disconnect,
            "getProjectInfo": self.get_project_info,
            "getNodes": self.get_nodes,
            "getBeams": self.get_beams,
            "getMemberProperties": lambda: self.get_member_properties(**params),
            "getLoadCases": self.get_load_cases,
            "getSupports": self.get_supports,
            "getNodeDisplacements": lambda: self.get_node_displacements(**params),
            "getSupportReactions": lambda: self.get_support_reactions(**params),
            "getMemberForces": lambda: self.get_member_forces(**params),
        }
        handler = handlers.get(method)
        if not handler:
            raise ValueError(f"Unknown method: {method}")
        return handler()


bridge = OpenSTAADBridge()


async def handle_client(websocket):
    """Handle a single WebSocket client connection."""
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

                result = bridge.dispatch(method, params)

                response = {
                    "id": msg_id,
                    "result": result,
                    "error": None,
                }
            except Exception as e:
                logger.error(f"Error handling {message.get('method', '?')}: {e}")
                response = {
                    "id": message.get("id") if isinstance(message, dict) else None,
                    "result": None,
                    "error": {"message": str(e), "trace": traceback.format_exc()},
                }

            await websocket.send(json.dumps(response))
            logger.info(f"-> response for {message.get('method', '?')}")

    except websockets.exceptions.ConnectionClosed:
        logger.info(f"Client disconnected: {client_addr}")


async def main(host: str, port: int):
    logger.info(f"OpenSTAAD Bridge starting on ws://{host}:{port}")
    logger.info("Waiting for webapp connections...")
    if not HAS_WIN32:
        logger.warning(
            "pywin32 not available - running in mock mode. "
            "Install pywin32 on Windows to connect to STAAD.Pro."
        )

    async with serve(handle_client, host, port):
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OpenSTAAD WebSocket Bridge")
    parser.add_argument("--host", default="localhost", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8765, help="Port to bind to")
    args = parser.parse_args()

    asyncio.run(main(args.host, args.port))
