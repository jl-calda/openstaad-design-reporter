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

// ── Write Result Types ───────────────────────────────────────────

export interface CreateNodeResult {
  nodeId: number;
  x: number;
  y: number;
  z: number;
}

export interface DeleteResult {
  deleted: boolean;
}

export interface CreateMemberResult {
  memberId: number;
  startNode: number;
  endNode: number;
}

export interface AssignPropertyResult {
  memberId: number;
  sectionName: string;
}

export interface SupportResult {
  nodeId: number;
  supportType: string;
}

export interface CreateLoadCaseResult {
  loadCaseId: number;
  title: string;
}

export interface NodeLoadResult {
  nodeId: number;
  loadCase: number;
  fx: number;
  fy: number;
  fz: number;
  mx: number;
  my: number;
  mz: number;
}

export interface MemberLoadResult {
  memberId: number;
  loadCase: number;
  loadType: string;
  direction: string;
  w1: number;
  w2: number;
  d1: number;
  d2: number;
}

export interface AnalysisResult {
  status: string;
}

// ── API Class ────────────────────────────────────────────────────

export class OpenSTAADApi {
  private client: BridgeClient;
  constructor(client: BridgeClient) {
    this.client = client;
  }

  // ── Connection ──────────────────────────────────────────────

  connect() {
    return this.client.request<{ status: string }>("connect");
  }

  disconnect() {
    return this.client.request<{ status: string }>("disconnect");
  }

  // ── Read Operations ─────────────────────────────────────────

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

  // ── Write: Geometry ─────────────────────────────────────────

  createNode(x: number, y: number, z: number) {
    return this.client.request<CreateNodeResult>("createNode", { x, y, z });
  }

  deleteNode(nodeId: number) {
    return this.client.request<DeleteResult>("deleteNode", { nodeId });
  }

  createMember(startNode: number, endNode: number) {
    return this.client.request<CreateMemberResult>("createMember", { startNode, endNode });
  }

  deleteMember(memberId: number) {
    return this.client.request<DeleteResult>("deleteMember", { memberId });
  }

  // ── Write: Properties ───────────────────────────────────────

  assignMemberProperty(memberId: number, sectionName: string) {
    return this.client.request<AssignPropertyResult>("assignMemberProperty", { memberId, sectionName });
  }

  // ── Write: Supports ─────────────────────────────────────────

  addSupport(nodeId: number, supportType: string) {
    return this.client.request<SupportResult>("addSupport", { nodeId, supportType });
  }

  removeSupport(nodeId: number) {
    return this.client.request<DeleteResult>("removeSupport", { nodeId });
  }

  // ── Write: Loads ────────────────────────────────────────────

  createLoadCase(title: string) {
    return this.client.request<CreateLoadCaseResult>("createLoadCase", { title });
  }

  deleteLoadCase(loadCaseId: number) {
    return this.client.request<DeleteResult>("deleteLoadCase", { loadCaseId });
  }

  addNodeLoad(nodeId: number, loadCase: number, forces: { fx?: number; fy?: number; fz?: number; mx?: number; my?: number; mz?: number }) {
    return this.client.request<NodeLoadResult>("addNodeLoad", { nodeId, loadCase, ...forces });
  }

  addMemberLoad(memberId: number, loadCase: number, loadType: string, direction: string, w1: number, w2?: number, d1?: number, d2?: number) {
    return this.client.request<MemberLoadResult>("addMemberLoad", { memberId, loadCase, loadType, direction, w1, w2: w2 ?? 0, d1: d1 ?? 0, d2: d2 ?? 0 });
  }

  // ── Analysis ────────────────────────────────────────────────

  runAnalysis() {
    return this.client.request<AnalysisResult>("runAnalysis");
  }
}
