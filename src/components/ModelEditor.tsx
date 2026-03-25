"use client";

import { useState } from "react";
import type { OpenSTAADApi, Node, Beam, LoadCase } from "@/lib/openstaad-api";

type EditorTab =
  | "nodes"
  | "members"
  | "properties"
  | "supports"
  | "loadCases"
  | "nodeLoads"
  | "memberLoads"
  | "analysis";

interface Props {
  api: OpenSTAADApi;
  nodes: Node[];
  beams: Beam[];
  loadCases: LoadCase[];
  supportNodeIds: number[];
  onModelChanged: () => void;
}

export function ModelEditor({ api, nodes, beams, loadCases, supportNodeIds, onModelChanged }: Props) {
  const [activeTab, setActiveTab] = useState<EditorTab>("nodes");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  const tabs: { id: EditorTab; label: string }[] = [
    { id: "nodes", label: "Nodes" },
    { id: "members", label: "Members" },
    { id: "properties", label: "Properties" },
    { id: "supports", label: "Supports" },
    { id: "loadCases", label: "Load Cases" },
    { id: "nodeLoads", label: "Node Loads" },
    { id: "memberLoads", label: "Member Loads" },
    { id: "analysis", label: "Analysis" },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Model Editor</h2>

        {/* Feedback banner */}
        {feedback && (
          <div
            className={`mb-4 p-3 text-sm rounded-lg border ${
              feedback.type === "success"
                ? "text-green-700 bg-green-50 border-green-200"
                : "text-red-700 bg-red-50 border-red-200"
            }`}
          >
            {feedback.message}
          </div>
        )}

        {/* Tab bar */}
        <div className="flex flex-wrap gap-1 border-b border-gray-200 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "nodes" && (
          <CreateNodeForm api={api} onSuccess={onModelChanged} showFeedback={showFeedback} />
        )}
        {activeTab === "members" && (
          <CreateMemberForm api={api} nodes={nodes} onSuccess={onModelChanged} showFeedback={showFeedback} />
        )}
        {activeTab === "properties" && (
          <AssignPropertyForm api={api} beams={beams} onSuccess={onModelChanged} showFeedback={showFeedback} />
        )}
        {activeTab === "supports" && (
          <ManageSupportsForm api={api} nodes={nodes} supportNodeIds={supportNodeIds} onSuccess={onModelChanged} showFeedback={showFeedback} />
        )}
        {activeTab === "loadCases" && (
          <ManageLoadCasesForm api={api} loadCases={loadCases} onSuccess={onModelChanged} showFeedback={showFeedback} />
        )}
        {activeTab === "nodeLoads" && (
          <AddNodeLoadForm api={api} nodes={nodes} loadCases={loadCases} onSuccess={onModelChanged} showFeedback={showFeedback} />
        )}
        {activeTab === "memberLoads" && (
          <AddMemberLoadForm api={api} beams={beams} loadCases={loadCases} onSuccess={onModelChanged} showFeedback={showFeedback} />
        )}
        {activeTab === "analysis" && (
          <RunAnalysisForm api={api} showFeedback={showFeedback} />
        )}
      </div>
    </div>
  );
}

// ── Shared helpers ──────────────────────────────────────────────

type FeedbackFn = (type: "success" | "error", message: string) => void;

function FormRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3">{children}</div>;
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function inputClass() {
  return "px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-28";
}

function selectClass() {
  return "px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";
}

function btnClass(color: "blue" | "red" | "green" = "blue") {
  const colors = {
    blue: "text-white bg-blue-600 hover:bg-blue-700",
    red: "text-white bg-red-600 hover:bg-red-700",
    green: "text-white bg-green-600 hover:bg-green-700",
  };
  return `px-4 py-1.5 text-sm font-medium rounded-lg disabled:opacity-50 transition-colors ${colors[color]}`;
}

// ── Create Node ─────────────────────────────────────────────────

function CreateNodeForm({ api, onSuccess, showFeedback }: { api: OpenSTAADApi; onSuccess: () => void; showFeedback: FeedbackFn }) {
  const [x, setX] = useState("0");
  const [y, setY] = useState("0");
  const [z, setZ] = useState("0");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    setBusy(true);
    try {
      const res = await api.createNode(parseFloat(x), parseFloat(y), parseFloat(z));
      showFeedback("success", `Node ${res.nodeId} created at (${x}, ${y}, ${z})`);
      onSuccess();
    } catch (e) {
      showFeedback("error", e instanceof Error ? e.message : "Failed to create node");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Create a new node by specifying its coordinates.</p>
      <FormRow>
        <FormField label="X">
          <input type="number" step="any" value={x} onChange={(e) => setX(e.target.value)} className={inputClass()} />
        </FormField>
        <FormField label="Y">
          <input type="number" step="any" value={y} onChange={(e) => setY(e.target.value)} className={inputClass()} />
        </FormField>
        <FormField label="Z">
          <input type="number" step="any" value={z} onChange={(e) => setZ(e.target.value)} className={inputClass()} />
        </FormField>
        <button onClick={handleCreate} disabled={busy} className={btnClass()}>
          {busy ? "Creating..." : "Create Node"}
        </button>
      </FormRow>
    </div>
  );
}

// ── Create Member ───────────────────────────────────────────────

function CreateMemberForm({ api, nodes, onSuccess, showFeedback }: { api: OpenSTAADApi; nodes: Node[]; onSuccess: () => void; showFeedback: FeedbackFn }) {
  const [startNode, setStartNode] = useState("");
  const [endNode, setEndNode] = useState("");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!startNode || !endNode) return;
    setBusy(true);
    try {
      const res = await api.createMember(parseInt(startNode), parseInt(endNode));
      showFeedback("success", `Member ${res.memberId} created: ${startNode} -> ${endNode}`);
      onSuccess();
    } catch (e) {
      showFeedback("error", e instanceof Error ? e.message : "Failed to create member");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Create a member connecting two nodes.</p>
      <FormRow>
        <FormField label="Start Node">
          <select value={startNode} onChange={(e) => setStartNode(e.target.value)} className={selectClass()}>
            <option value="">Select...</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.id} ({n.x}, {n.y}, {n.z})
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="End Node">
          <select value={endNode} onChange={(e) => setEndNode(e.target.value)} className={selectClass()}>
            <option value="">Select...</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.id} ({n.x}, {n.y}, {n.z})
              </option>
            ))}
          </select>
        </FormField>
        <button onClick={handleCreate} disabled={busy || !startNode || !endNode} className={btnClass()}>
          {busy ? "Creating..." : "Create Member"}
        </button>
      </FormRow>
    </div>
  );
}

// ── Assign Property ─────────────────────────────────────────────

function AssignPropertyForm({ api, beams, onSuccess, showFeedback }: { api: OpenSTAADApi; beams: Beam[]; onSuccess: () => void; showFeedback: FeedbackFn }) {
  const [memberId, setMemberId] = useState("");
  const [sectionName, setSectionName] = useState("W14X90");
  const [busy, setBusy] = useState(false);

  const commonSections = ["W14X90", "W12X65", "W10X49", "W8X31", "W6X20", "W16X100", "W21X132", "HSS8X8X0.5", "HSS6X6X0.375"];

  const handleAssign = async () => {
    if (!memberId || !sectionName) return;
    setBusy(true);
    try {
      await api.assignMemberProperty(parseInt(memberId), sectionName);
      showFeedback("success", `Assigned ${sectionName} to member ${memberId}`);
      onSuccess();
    } catch (e) {
      showFeedback("error", e instanceof Error ? e.message : "Failed to assign property");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Assign a section property to a member.</p>
      <FormRow>
        <FormField label="Member">
          <select value={memberId} onChange={(e) => setMemberId(e.target.value)} className={selectClass()}>
            <option value="">Select...</option>
            {beams.map((b) => (
              <option key={b.id} value={b.id}>
                {b.id} ({b.startNode}-{b.endNode})
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Section">
          <select value={sectionName} onChange={(e) => setSectionName(e.target.value)} className={selectClass()}>
            {commonSections.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </FormField>
        <button onClick={handleAssign} disabled={busy || !memberId} className={btnClass()}>
          {busy ? "Assigning..." : "Assign"}
        </button>
      </FormRow>
    </div>
  );
}

// ── Manage Supports ─────────────────────────────────────────────

function ManageSupportsForm({ api, nodes, supportNodeIds, onSuccess, showFeedback }: { api: OpenSTAADApi; nodes: Node[]; supportNodeIds: number[]; onSuccess: () => void; showFeedback: FeedbackFn }) {
  const [nodeId, setNodeId] = useState("");
  const [supportType, setSupportType] = useState("fixed");
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    if (!nodeId) return;
    setBusy(true);
    try {
      await api.addSupport(parseInt(nodeId), supportType);
      showFeedback("success", `Added ${supportType} support at node ${nodeId}`);
      onSuccess();
    } catch (e) {
      showFeedback("error", e instanceof Error ? e.message : "Failed to add support");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (nid: number) => {
    setBusy(true);
    try {
      await api.removeSupport(nid);
      showFeedback("success", `Removed support from node ${nid}`);
      onSuccess();
    } catch (e) {
      showFeedback("error", e instanceof Error ? e.message : "Failed to remove support");
    } finally {
      setBusy(false);
    }
  };

  const unsupportedNodes = nodes.filter((n) => !supportNodeIds.includes(n.id));

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Add or remove supports at nodes.</p>
      <FormRow>
        <FormField label="Node">
          <select value={nodeId} onChange={(e) => setNodeId(e.target.value)} className={selectClass()}>
            <option value="">Select...</option>
            {unsupportedNodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.id} ({n.x}, {n.y}, {n.z})
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Type">
          <select value={supportType} onChange={(e) => setSupportType(e.target.value)} className={selectClass()}>
            <option value="fixed">Fixed</option>
            <option value="pinned">Pinned</option>
          </select>
        </FormField>
        <button onClick={handleAdd} disabled={busy || !nodeId} className={btnClass()}>
          {busy ? "Adding..." : "Add Support"}
        </button>
      </FormRow>

      {supportNodeIds.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Current Supports</p>
          <div className="flex flex-wrap gap-2">
            {supportNodeIds.map((nid) => (
              <span
                key={nid}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-sm bg-gray-100 rounded-lg"
              >
                Node {nid}
                <button
                  onClick={() => handleRemove(nid)}
                  disabled={busy}
                  className="text-red-500 hover:text-red-700 font-bold text-xs"
                  title="Remove support"
                >
                  x
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Manage Load Cases ───────────────────────────────────────────

function ManageLoadCasesForm({ api, loadCases, onSuccess, showFeedback }: { api: OpenSTAADApi; loadCases: LoadCase[]; onSuccess: () => void; showFeedback: FeedbackFn }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const res = await api.createLoadCase(title.trim());
      showFeedback("success", `Load case ${res.loadCaseId} created: "${title}"`);
      setTitle("");
      onSuccess();
    } catch (e) {
      showFeedback("error", e instanceof Error ? e.message : "Failed to create load case");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (lcId: number) => {
    setBusy(true);
    try {
      await api.deleteLoadCase(lcId);
      showFeedback("success", `Load case ${lcId} deleted`);
      onSuccess();
    } catch (e) {
      showFeedback("error", e instanceof Error ? e.message : "Failed to delete load case");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Create and manage load cases.</p>
      <FormRow>
        <FormField label="Title">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Wind Load X"
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
          />
        </FormField>
        <button onClick={handleCreate} disabled={busy || !title.trim()} className={btnClass()}>
          {busy ? "Creating..." : "Create Load Case"}
        </button>
      </FormRow>

      {loadCases.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Existing Load Cases</p>
          <div className="space-y-1">
            {loadCases.map((lc) => (
              <div key={lc.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">
                  <span className="font-mono font-medium">{lc.id}</span>: {lc.title}
                </span>
                <button
                  onClick={() => handleDelete(lc.id)}
                  disabled={busy}
                  className="text-xs text-red-500 hover:text-red-700 font-medium"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add Node Load ───────────────────────────────────────────────

function AddNodeLoadForm({ api, nodes, loadCases, onSuccess, showFeedback }: { api: OpenSTAADApi; nodes: Node[]; loadCases: LoadCase[]; onSuccess: () => void; showFeedback: FeedbackFn }) {
  const [nodeId, setNodeId] = useState("");
  const [loadCase, setLoadCase] = useState("");
  const [fx, setFx] = useState("0");
  const [fy, setFy] = useState("0");
  const [fz, setFz] = useState("0");
  const [mx, setMx] = useState("0");
  const [my, setMy] = useState("0");
  const [mz, setMz] = useState("0");
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    if (!nodeId || !loadCase) return;
    setBusy(true);
    try {
      await api.addNodeLoad(parseInt(nodeId), parseInt(loadCase), {
        fx: parseFloat(fx), fy: parseFloat(fy), fz: parseFloat(fz),
        mx: parseFloat(mx), my: parseFloat(my), mz: parseFloat(mz),
      });
      showFeedback("success", `Node load added at node ${nodeId}, LC ${loadCase}`);
      onSuccess();
    } catch (e) {
      showFeedback("error", e instanceof Error ? e.message : "Failed to add node load");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Apply concentrated forces/moments to a node.</p>
      <FormRow>
        <FormField label="Node">
          <select value={nodeId} onChange={(e) => setNodeId(e.target.value)} className={selectClass()}>
            <option value="">Select...</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>{n.id}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Load Case">
          <select value={loadCase} onChange={(e) => setLoadCase(e.target.value)} className={selectClass()}>
            <option value="">Select...</option>
            {loadCases.map((lc) => (
              <option key={lc.id} value={lc.id}>{lc.id}: {lc.title}</option>
            ))}
          </select>
        </FormField>
      </FormRow>
      <FormRow>
        <FormField label="Fx"><input type="number" step="any" value={fx} onChange={(e) => setFx(e.target.value)} className={inputClass()} /></FormField>
        <FormField label="Fy"><input type="number" step="any" value={fy} onChange={(e) => setFy(e.target.value)} className={inputClass()} /></FormField>
        <FormField label="Fz"><input type="number" step="any" value={fz} onChange={(e) => setFz(e.target.value)} className={inputClass()} /></FormField>
        <FormField label="Mx"><input type="number" step="any" value={mx} onChange={(e) => setMx(e.target.value)} className={inputClass()} /></FormField>
        <FormField label="My"><input type="number" step="any" value={my} onChange={(e) => setMy(e.target.value)} className={inputClass()} /></FormField>
        <FormField label="Mz"><input type="number" step="any" value={mz} onChange={(e) => setMz(e.target.value)} className={inputClass()} /></FormField>
      </FormRow>
      <button onClick={handleAdd} disabled={busy || !nodeId || !loadCase} className={btnClass()}>
        {busy ? "Adding..." : "Add Node Load"}
      </button>
    </div>
  );
}

// ── Add Member Load ─────────────────────────────────────────────

function AddMemberLoadForm({ api, beams, loadCases, onSuccess, showFeedback }: { api: OpenSTAADApi; beams: Beam[]; loadCases: LoadCase[]; onSuccess: () => void; showFeedback: FeedbackFn }) {
  const [memberId, setMemberId] = useState("");
  const [loadCase, setLoadCase] = useState("");
  const [loadType, setLoadType] = useState("uniform");
  const [direction, setDirection] = useState("GY");
  const [w1, setW1] = useState("-10");
  const [w2, setW2] = useState("0");
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    if (!memberId || !loadCase) return;
    setBusy(true);
    try {
      await api.addMemberLoad(parseInt(memberId), parseInt(loadCase), loadType, direction, parseFloat(w1), parseFloat(w2));
      showFeedback("success", `Member load added on member ${memberId}, LC ${loadCase}`);
      onSuccess();
    } catch (e) {
      showFeedback("error", e instanceof Error ? e.message : "Failed to add member load");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Apply distributed or concentrated loads to a member.</p>
      <FormRow>
        <FormField label="Member">
          <select value={memberId} onChange={(e) => setMemberId(e.target.value)} className={selectClass()}>
            <option value="">Select...</option>
            {beams.map((b) => (
              <option key={b.id} value={b.id}>{b.id} ({b.startNode}-{b.endNode})</option>
            ))}
          </select>
        </FormField>
        <FormField label="Load Case">
          <select value={loadCase} onChange={(e) => setLoadCase(e.target.value)} className={selectClass()}>
            <option value="">Select...</option>
            {loadCases.map((lc) => (
              <option key={lc.id} value={lc.id}>{lc.id}: {lc.title}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Type">
          <select value={loadType} onChange={(e) => setLoadType(e.target.value)} className={selectClass()}>
            <option value="uniform">Uniform</option>
            <option value="concentrated">Concentrated</option>
            <option value="trapezoidal">Trapezoidal</option>
          </select>
        </FormField>
        <FormField label="Direction">
          <select value={direction} onChange={(e) => setDirection(e.target.value)} className={selectClass()}>
            <option value="GX">GX (Global X)</option>
            <option value="GY">GY (Global Y)</option>
            <option value="GZ">GZ (Global Z)</option>
            <option value="X">X (Local)</option>
            <option value="Y">Y (Local)</option>
            <option value="Z">Z (Local)</option>
          </select>
        </FormField>
      </FormRow>
      <FormRow>
        <FormField label="W1 (intensity)">
          <input type="number" step="any" value={w1} onChange={(e) => setW1(e.target.value)} className={inputClass()} />
        </FormField>
        <FormField label="W2 (end intensity)">
          <input type="number" step="any" value={w2} onChange={(e) => setW2(e.target.value)} className={inputClass()} />
        </FormField>
      </FormRow>
      <button onClick={handleAdd} disabled={busy || !memberId || !loadCase} className={btnClass()}>
        {busy ? "Adding..." : "Add Member Load"}
      </button>
    </div>
  );
}

// ── Run Analysis ────────────────────────────────────────────────

function RunAnalysisForm({ api, showFeedback }: { api: OpenSTAADApi; showFeedback: FeedbackFn }) {
  const [busy, setBusy] = useState(false);

  const handleRun = async () => {
    setBusy(true);
    try {
      await api.runAnalysis();
      showFeedback("success", "Analysis completed successfully");
    } catch (e) {
      showFeedback("error", e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Run the STAAD.Pro structural analysis on the current model. Make sure all geometry, properties,
        loads, and supports are defined before running.
      </p>
      <button onClick={handleRun} disabled={busy} className={btnClass("green")}>
        {busy ? "Running Analysis..." : "Run Analysis"}
      </button>
      {busy && (
        <p className="text-xs text-gray-500">Analysis is running. This may take a moment for large models...</p>
      )}
    </div>
  );
}
