/**
 * AI-powered structural model generator.
 * Takes a natural language description and generates STAAD model commands
 * executed through the OpenSTAAD API.
 */

import type { AIClient } from "./ai-client";
import type { OpenSTAADApi } from "./openstaad-api";

// ── Generated model schema ──────────────────────────────────────

export interface GeneratedModel {
  nodes: { x: number; y: number; z: number }[];
  members: { startNodeIndex: number; endNodeIndex: number }[];
  supports: { nodeIndex: number; type: "fixed" | "pinned" }[];
  loadCases: {
    title: string;
    nodeLoads: {
      nodeIndex: number;
      fx: number; fy: number; fz: number;
      mx: number; my: number; mz: number;
    }[];
    memberLoads: {
      memberIndex: number;
      loadType: "uniform";
      direction: "GY";
      w1: number;
    }[];
  }[];
  properties: {
    memberIndices: number[];
    sectionName: string;
  }[];
}

// ── Step tracking ───────────────────────────────────────────────

export interface GenerationStep {
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
}

export type StepCallback = (steps: GenerationStep[]) => void;

// ── System prompt ───────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a structural engineering AI assistant. Given a description of a structure, you generate a STAAD.Pro-compatible structural model as JSON.

RULES:
- All coordinates are in meters. Y is the vertical axis (height). X and Z are horizontal.
- Node indices are 0-based in your output (they map to creation order).
- Members connect two node indices.
- Supports are at base nodes (y=0 typically). Use "fixed" for rigid connections, "pinned" for hinges.
- Load values use kN for forces and kN-m for moments. Negative GY = downward gravity.
- For uniform member loads, w1 is intensity in kN/m. Use negative for downward gravity loads.
- Assign realistic section properties (AISC W-shapes for steel, e.g. W14X90, W12X65, W10X49).
- Always create at least one load case with realistic loads.
- Keep the model practical and structurally sound.

OUTPUT FORMAT - respond with ONLY this JSON structure, no other text:
{
  "nodes": [{"x": 0, "y": 0, "z": 0}, ...],
  "members": [{"startNodeIndex": 0, "endNodeIndex": 1}, ...],
  "supports": [{"nodeIndex": 0, "type": "fixed"}, ...],
  "loadCases": [
    {
      "title": "Dead Load",
      "nodeLoads": [{"nodeIndex": 2, "fx": 0, "fy": -50, "fz": 0, "mx": 0, "my": 0, "mz": 0}],
      "memberLoads": [{"memberIndex": 0, "loadType": "uniform", "direction": "GY", "w1": -15}]
    }
  ],
  "properties": [
    {"memberIndices": [0, 1], "sectionName": "W14X90"}
  ]
}`;

// ── Generator ───────────────────────────────────────────────────

export async function generateModel(
  ai: AIClient,
  description: string,
): Promise<GeneratedModel> {
  const response = await ai.chat([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: description },
  ]);

  const raw = response.content.trim();

  // Try to extract JSON from the response (handle markdown code blocks)
  let jsonStr = raw;
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  let parsed: GeneratedModel;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`AI returned invalid JSON. Raw response:\n${raw.slice(0, 500)}`);
  }

  // Basic validation
  if (!Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
    throw new Error("AI generated a model with no nodes");
  }
  if (!Array.isArray(parsed.members) || parsed.members.length === 0) {
    throw new Error("AI generated a model with no members");
  }

  return parsed;
}

export async function applyModelToSTAAD(
  api: OpenSTAADApi,
  model: GeneratedModel,
  onStep?: StepCallback,
): Promise<{ nodeCount: number; memberCount: number }> {
  const steps: GenerationStep[] = [
    { label: "Creating nodes", status: "pending" },
    { label: "Creating members", status: "pending" },
    { label: "Assigning supports", status: "pending" },
    { label: "Assigning section properties", status: "pending" },
    { label: "Creating load cases & loads", status: "pending" },
  ];

  const update = (index: number, patch: Partial<GenerationStep>) => {
    steps[index] = { ...steps[index], ...patch };
    onStep?.([...steps]);
  };

  // 1. Create nodes
  update(0, { status: "running", detail: `0 / ${model.nodes.length}` });
  const nodeIdMap: number[] = []; // index -> actual STAAD node ID
  for (let i = 0; i < model.nodes.length; i++) {
    const n = model.nodes[i];
    const res = await api.createNode(n.x, n.y, n.z);
    nodeIdMap.push(res.nodeId);
    update(0, { detail: `${i + 1} / ${model.nodes.length}` });
  }
  update(0, { status: "done", detail: `${model.nodes.length} nodes` });

  // 2. Create members
  update(1, { status: "running", detail: `0 / ${model.members.length}` });
  const memberIdMap: number[] = [];
  for (let i = 0; i < model.members.length; i++) {
    const m = model.members[i];
    const startId = nodeIdMap[m.startNodeIndex];
    const endId = nodeIdMap[m.endNodeIndex];
    if (startId === undefined || endId === undefined) {
      throw new Error(`Member ${i} references invalid node index (start=${m.startNodeIndex}, end=${m.endNodeIndex})`);
    }
    const res = await api.createMember(startId, endId);
    memberIdMap.push(res.memberId);
    update(1, { detail: `${i + 1} / ${model.members.length}` });
  }
  update(1, { status: "done", detail: `${model.members.length} members` });

  // 3. Assign supports
  const supList = model.supports ?? [];
  update(2, { status: "running", detail: `0 / ${supList.length}` });
  for (let i = 0; i < supList.length; i++) {
    const s = supList[i];
    const nid = nodeIdMap[s.nodeIndex];
    if (nid === undefined) {
      throw new Error(`Support references invalid node index ${s.nodeIndex}`);
    }
    await api.addSupport(nid, s.type);
    update(2, { detail: `${i + 1} / ${supList.length}` });
  }
  update(2, { status: "done", detail: `${supList.length} supports` });

  // 4. Assign properties
  const propList = model.properties ?? [];
  update(3, { status: "running" });
  let propCount = 0;
  for (const prop of propList) {
    for (const mi of prop.memberIndices) {
      const mid = memberIdMap[mi];
      if (mid !== undefined) {
        await api.assignMemberProperty(mid, prop.sectionName);
        propCount++;
      }
    }
  }
  update(3, { status: "done", detail: `${propCount} assignments` });

  // 5. Create load cases and loads
  const lcList = model.loadCases ?? [];
  update(4, { status: "running", detail: `0 / ${lcList.length} cases` });
  for (let i = 0; i < lcList.length; i++) {
    const lc = lcList[i];
    const lcRes = await api.createLoadCase(lc.title);
    const lcId = lcRes.loadCaseId;

    // Node loads
    for (const nl of lc.nodeLoads ?? []) {
      const nid = nodeIdMap[nl.nodeIndex];
      if (nid !== undefined) {
        await api.addNodeLoad(nid, lcId, {
          fx: nl.fx, fy: nl.fy, fz: nl.fz,
          mx: nl.mx, my: nl.my, mz: nl.mz,
        });
      }
    }

    // Member loads
    for (const ml of lc.memberLoads ?? []) {
      const mid = memberIdMap[ml.memberIndex];
      if (mid !== undefined) {
        await api.addMemberLoad(mid, lcId, ml.loadType, ml.direction, ml.w1);
      }
    }

    update(4, { detail: `${i + 1} / ${lcList.length} cases` });
  }
  update(4, { status: "done", detail: `${lcList.length} load cases` });

  return { nodeCount: model.nodes.length, memberCount: model.members.length };
}
