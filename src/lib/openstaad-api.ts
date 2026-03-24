/**
 * High-level typed API for OpenSTAAD operations.
 * Wraps BridgeClient with typed methods matching the bridge's dispatch.
 */

import { BridgeClient } from "./bridge-client";

// ── Types ────────────────────────────────────────────────────────

export interface ProjectInfo {
  fileName: string;
  projectName: string;
}

export interface Node {
  id: number;
  x: number;
  y: number;
  z: number;
}

export interface NodesResult {
  count: number;
  nodes: Node[];
}

export interface Beam {
  id: number;
  startNode: number;
  endNode: number;
}

export interface BeamsResult {
  count: number;
  beams: Beam[];
}

export interface MemberProperty {
  beamId: number;
  sectionName: string;
  material: string;
}

export interface LoadCase {
  id: number;
  title: string;
}

export interface LoadCasesResult {
  count: number;
  cases: LoadCase[];
}

export interface Support {
  nodeId: number;
}

export interface SupportsResult {
  count: number;
  supports: Support[];
}

export interface NodeDisplacement {
  nodeId: number;
  dx: number;
  dy: number;
  dz: number;
  rx: number;
  ry: number;
  rz: number;
}

export interface DisplacementsResult {
  loadCase: number;
  displacements: NodeDisplacement[];
}

export interface SupportReaction {
  nodeId: number;
  fx: number;
  fy: number;
  fz: number;
  mx: number;
  my: number;
  mz: number;
}

export interface ReactionsResult {
  loadCase: number;
  reactions: SupportReaction[];
}

export interface MemberEndForce {
  section: "start" | "end";
  fx: number;
  fy: number;
  fz: number;
  mx: number;
  my: number;
  mz: number;
}

export interface MemberForcesResult {
  beamId: number;
  loadCase: number;
  forces: MemberEndForce[];
}

// ── API Class ────────────────────────────────────────────────────

export class OpenSTAADApi {
  private client: BridgeClient;
  constructor(client: BridgeClient) {
    this.client = client;
  }

  connect() {
    return this.client.request<{ status: string }>("connect");
  }

  disconnect() {
    return this.client.request<{ status: string }>("disconnect");
  }

  getProjectInfo() {
    return this.client.request<ProjectInfo>("getProjectInfo");
  }

  getNodes() {
    return this.client.request<NodesResult>("getNodes");
  }

  getBeams() {
    return this.client.request<BeamsResult>("getBeams");
  }

  getMemberProperties(beamId: number) {
    return this.client.request<MemberProperty>("getMemberProperties", { beamId });
  }

  getLoadCases() {
    return this.client.request<LoadCasesResult>("getLoadCases");
  }

  getSupports() {
    return this.client.request<SupportsResult>("getSupports");
  }

  getNodeDisplacements(loadCase: number) {
    return this.client.request<DisplacementsResult>("getNodeDisplacements", { loadCase });
  }

  getSupportReactions(loadCase: number) {
    return this.client.request<ReactionsResult>("getSupportReactions", { loadCase });
  }

  getMemberForces(beamId: number, loadCase: number) {
    return this.client.request<MemberForcesResult>("getMemberForces", { beamId, loadCase });
  }
}
