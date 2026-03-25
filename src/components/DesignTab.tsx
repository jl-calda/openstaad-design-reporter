/**
 * Reusable structural element design tab.
 * Used for Beam, Column, Slab, and Footing design.
 * Each presents as a calculation report with input parameters and design checks.
 */

"use client";

import { useState, useRef, useCallback } from "react";
import { AIClient, DEFAULT_AI_CONFIG } from "@/lib/ai-client";
import type { AIClientConfig } from "@/lib/ai-client";
import type { OpenSTAADApi, Beam, LoadCase } from "@/lib/openstaad-api";

// ── Types ───────────────────────────────────────────────────────

export type DesignType = "beam" | "column" | "slab" | "footing";

interface Props {
  type: DesignType;
  api: OpenSTAADApi;
  beams: Beam[];
  loadCases: LoadCase[];
}

interface DesignInput {
  // Common
  label: string;
  designCode: string;
  concreteGrade: string;
  steelGrade: string;
  // Beam / Column
  memberId?: number;
  width?: number;
  depth?: number;
  cover?: number;
  // Slab
  thickness?: number;
  spanX?: number;
  spanY?: number;
  supportCondition?: string;
  // Footing
  footingType?: string;
  columnWidth?: number;
  columnDepth?: number;
  soilBearing?: number;
  axialLoad?: number;
  momentX?: number;
  momentY?: number;
}

interface DesignResult {
  status: "pass" | "fail" | "warning";
  summary: string;
  sections: { title: string; rows: { label: string; value: string; status?: "ok" | "warn" | "fail" }[] }[];
  reinforcement?: string;
}

const TYPE_CONFIG: Record<DesignType, { title: string; color: string; bgGradient: string; description: string }> = {
  beam: {
    title: "Beam Design",
    color: "blue",
    bgGradient: "from-blue-50 to-cyan-50",
    description: "Flexural and shear design of reinforced concrete beams",
  },
  column: {
    title: "Column Design",
    color: "emerald",
    bgGradient: "from-emerald-50 to-green-50",
    description: "Axial and biaxial bending design of RC columns",
  },
  slab: {
    title: "Slab Design",
    color: "violet",
    bgGradient: "from-violet-50 to-purple-50",
    description: "One-way and two-way slab design",
  },
  footing: {
    title: "Footing Design",
    color: "orange",
    bgGradient: "from-orange-50 to-red-50",
    description: "Isolated and combined footing design",
  },
};

const DEFAULT_INPUTS: Record<DesignType, Partial<DesignInput>> = {
  beam: { designCode: "ACI 318-19", concreteGrade: "C30", steelGrade: "Grade 60", width: 300, depth: 500, cover: 40 },
  column: { designCode: "ACI 318-19", concreteGrade: "C30", steelGrade: "Grade 60", width: 400, depth: 400, cover: 40 },
  slab: { designCode: "ACI 318-19", concreteGrade: "C25", steelGrade: "Grade 60", thickness: 150, cover: 25, supportCondition: "two-way" },
  footing: { designCode: "ACI 318-19", concreteGrade: "C25", steelGrade: "Grade 60", footingType: "isolated", soilBearing: 150, cover: 75 },
};

// ── Component ───────────────────────────────────────────────────

export function DesignTab({ type, api, beams, loadCases }: Props) {
  const config = TYPE_CONFIG[type];
  const aiRef = useRef<AIClient>(new AIClient());
  const [aiConfig, setAiConfig] = useState<AIClientConfig>(DEFAULT_AI_CONFIG);

  const [inputs, setInputs] = useState<DesignInput>({
    label: "",
    ...DEFAULT_INPUTS[type],
  } as DesignInput);

  const [designing, setDesigning] = useState(false);
  const [result, setResult] = useState<DesignResult | null>(null);
  const [error, setError] = useState("");
  const [selectedLC, setSelectedLC] = useState<number>(loadCases[0]?.id ?? 1);

  const updateInput = (key: keyof DesignInput, value: string | number) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const runDesign = useCallback(async () => {
    setDesigning(true);
    setError("");
    setResult(null);

    try {
      aiRef.current.updateConfig(aiConfig);

      // Fetch forces from STAAD if a member is selected
      let forceData = "";
      if (inputs.memberId && (type === "beam" || type === "column")) {
        try {
          const mf = await api.getMemberForces(inputs.memberId, selectedLC);
          forceData = `Member ${inputs.memberId} forces (LC ${selectedLC}): ${JSON.stringify(mf.forces)}`;
        } catch {
          forceData = "No analysis results available - using manual input.";
        }
      }

      const prompt = buildDesignPrompt(type, inputs, forceData);
      const response = await aiRef.current.chat([
        { role: "system", content: DESIGN_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ]);

      const parsed = JSON.parse(response.content) as DesignResult;
      setResult(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Design calculation failed");
    } finally {
      setDesigning(false);
    }
  }, [aiConfig, api, inputs, selectedLC, type]);

  return (
    <div className="space-y-6">
      {/* Header + Input Panel */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className={`px-6 py-4 border-b border-gray-100 bg-gradient-to-r ${config.bgGradient}`}>
          <h2 className="text-lg font-semibold text-gray-900">{config.title}</h2>
          <p className="text-xs text-gray-500">{config.description}</p>
        </div>

        <div className="p-6 space-y-4">
          {/* AI connection compact */}
          <AISettingsCompact config={aiConfig} onChange={setAiConfig} client={aiRef.current} />

          {/* Design label */}
          <div>
            <InputLabel text="Element Label" />
            <input
              type="text"
              value={inputs.label}
              onChange={(e) => updateInput("label", e.target.value)}
              placeholder={`e.g. ${type === "beam" ? "B1" : type === "column" ? "C1" : type === "slab" ? "S1" : "F1"}`}
              className="w-48 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Member selection for beam/column */}
          {(type === "beam" || type === "column") && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <InputLabel text="Member" />
                <select
                  value={inputs.memberId ?? ""}
                  onChange={(e) => updateInput("memberId", Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  {beams.map((b) => (
                    <option key={b.id} value={b.id}>
                      Member {b.id} ({b.startNode}-{b.endNode})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <InputLabel text="Load Case" />
                <select
                  value={selectedLC}
                  onChange={(e) => setSelectedLC(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {loadCases.map((lc) => (
                    <option key={lc.id} value={lc.id}>
                      {lc.id}: {lc.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Geometry inputs */}
          <div>
            <SectionHead text="Section Properties" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <InputLabel text="Design Code" />
                <input type="text" value={inputs.designCode} onChange={(e) => updateInput("designCode", e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <InputLabel text="Concrete Grade" />
                <input type="text" value={inputs.concreteGrade} onChange={(e) => updateInput("concreteGrade", e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <InputLabel text="Steel Grade" />
                <input type="text" value={inputs.steelGrade} onChange={(e) => updateInput("steelGrade", e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <InputLabel text="Cover (mm)" />
                <input type="number" value={inputs.cover ?? ""} onChange={(e) => updateInput("cover", Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* Type-specific inputs */}
          {(type === "beam" || type === "column") && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <InputLabel text="Width b (mm)" />
                <input type="number" value={inputs.width ?? ""} onChange={(e) => updateInput("width", Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <InputLabel text="Depth h (mm)" />
                <input type="number" value={inputs.depth ?? ""} onChange={(e) => updateInput("depth", Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          )}

          {type === "slab" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <InputLabel text="Thickness (mm)" />
                <input type="number" value={inputs.thickness ?? ""} onChange={(e) => updateInput("thickness", Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <InputLabel text="Span X (m)" />
                <input type="number" step="0.1" value={inputs.spanX ?? ""} onChange={(e) => updateInput("spanX", Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <InputLabel text="Span Y (m)" />
                <input type="number" step="0.1" value={inputs.spanY ?? ""} onChange={(e) => updateInput("spanY", Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <InputLabel text="Support Type" />
                <select value={inputs.supportCondition ?? "two-way"} onChange={(e) => updateInput("supportCondition", e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="one-way">One-way</option>
                  <option value="two-way">Two-way</option>
                  <option value="cantilever">Cantilever</option>
                </select>
              </div>
            </div>
          )}

          {type === "footing" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <InputLabel text="Footing Type" />
                <select value={inputs.footingType ?? "isolated"} onChange={(e) => updateInput("footingType", e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="isolated">Isolated</option>
                  <option value="combined">Combined</option>
                  <option value="strip">Strip</option>
                </select>
              </div>
              <div>
                <InputLabel text="Column Size (mm)" />
                <input type="number" value={inputs.columnWidth ?? ""} onChange={(e) => updateInput("columnWidth", Number(e.target.value))}
                  placeholder="Width"
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <InputLabel text="Soil Bearing (kPa)" />
                <input type="number" value={inputs.soilBearing ?? ""} onChange={(e) => updateInput("soilBearing", Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <InputLabel text="Axial Load (kN)" />
                <input type="number" value={inputs.axialLoad ?? ""} onChange={(e) => updateInput("axialLoad", Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          )}

          {/* Run button */}
          <button
            onClick={runDesign}
            disabled={designing}
            className={`px-6 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${
              type === "beam" ? "bg-blue-600 hover:bg-blue-700" :
              type === "column" ? "bg-emerald-600 hover:bg-emerald-700" :
              type === "slab" ? "bg-violet-600 hover:bg-violet-700" :
              "bg-orange-600 hover:bg-orange-700"
            }`}
          >
            {designing ? "Calculating..." : "Run Design Check"}
          </button>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Design Calculation Output ── */}
      {result && (
        <DesignReport type={type} inputs={inputs} result={result} selectedLC={selectedLC} />
      )}
    </div>
  );
}

// ── Design Report (Calc Sheet Presentation) ─────────────────────

function DesignReport({ type, inputs, result, selectedLC }: {
  type: DesignType; inputs: DesignInput; result: DesignResult; selectedLC: number;
}) {
  const config = TYPE_CONFIG[type];
  const statusColor = result.status === "pass" ? "green" : result.status === "fail" ? "red" : "amber";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-0">
      {/* Title */}
      <div className="p-6 border-b-2 border-gray-900">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 uppercase">{config.title}</h2>
            <p className="text-sm text-gray-600">
              Element: <span className="font-semibold">{inputs.label || "-"}</span>
              {inputs.memberId ? ` | Member ${inputs.memberId}` : ""}
              {` | LC ${selectedLC}`}
            </p>
          </div>
          <div className={`px-4 py-2 rounded-lg font-bold text-sm uppercase bg-${statusColor}-100 text-${statusColor}-800 border border-${statusColor}-300`}>
            {result.status === "pass" ? "ADEQUATE" : result.status === "fail" ? "INADEQUATE" : "CHECK"}
          </div>
        </div>
      </div>

      {/* Design parameters */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">Design Parameters</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1">
          <ParamRow label="Design Code" value={inputs.designCode} />
          <ParamRow label="Concrete" value={inputs.concreteGrade} />
          <ParamRow label="Steel" value={inputs.steelGrade} />
          <ParamRow label="Cover" value={`${inputs.cover ?? "-"} mm`} />
          {(type === "beam" || type === "column") && (
            <>
              <ParamRow label="Width b" value={`${inputs.width ?? "-"} mm`} />
              <ParamRow label="Depth h" value={`${inputs.depth ?? "-"} mm`} />
            </>
          )}
          {type === "slab" && (
            <>
              <ParamRow label="Thickness" value={`${inputs.thickness ?? "-"} mm`} />
              <ParamRow label="Span X" value={`${inputs.spanX ?? "-"} m`} />
              <ParamRow label="Span Y" value={`${inputs.spanY ?? "-"} m`} />
              <ParamRow label="Support" value={inputs.supportCondition ?? "-"} />
            </>
          )}
          {type === "footing" && (
            <>
              <ParamRow label="Type" value={inputs.footingType ?? "-"} />
              <ParamRow label="Soil Bearing" value={`${inputs.soilBearing ?? "-"} kPa`} />
              <ParamRow label="Axial Load" value={`${inputs.axialLoad ?? "-"} kN`} />
            </>
          )}
        </div>
      </div>

      {/* Calculation sections */}
      {result.sections.map((section, si) => (
        <div key={si} className="p-6 border-b border-gray-200">
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">
            {si + 1}. {section.title}
          </h3>
          <div className="space-y-1">
            {section.rows.map((row, ri) => (
              <div key={ri} className="flex justify-between py-1.5 border-b border-gray-100 text-sm">
                <span className="text-gray-600">{row.label}</span>
                <span className={`font-mono font-medium ${
                  row.status === "fail" ? "text-red-700" :
                  row.status === "warn" ? "text-amber-700" :
                  "text-gray-900"
                }`}>
                  {row.value}
                  {row.status === "ok" && <span className="text-green-600 ml-2">OK</span>}
                  {row.status === "fail" && <span className="text-red-600 ml-2">NG</span>}
                  {row.status === "warn" && <span className="text-amber-600 ml-2">!</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Reinforcement summary */}
      {result.reinforcement && (
        <div className="p-6 border-b border-gray-200 bg-blue-50 print:bg-transparent">
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-2">Reinforcement</h3>
          <p className="text-sm text-gray-800 whitespace-pre-wrap font-mono">{result.reinforcement}</p>
        </div>
      )}

      {/* Summary */}
      <div className={`p-6 bg-${statusColor}-50 print:bg-transparent`}>
        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-2">Design Summary</h3>
        <p className="text-sm text-gray-800">{result.summary}</p>
      </div>
    </div>
  );
}

// ── AI Settings Compact ─────────────────────────────────────────

function AISettingsCompact({ config, onChange, client }: {
  config: AIClientConfig; onChange: (c: AIClientConfig) => void; client: AIClient;
}) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<boolean | null>(null);

  const testConnection = async () => {
    setStatus(null);
    client.updateConfig(config);
    const ok = await client.ping();
    setStatus(ok);
  };

  return (
    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            status === null ? "bg-gray-400" : status ? "bg-green-500" : "bg-red-500"
          }`} />
          <span className="text-xs text-gray-500">AI Engine: {config.model}</span>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-xs text-blue-600 hover:text-blue-800">
          {expanded ? "Hide" : "Settings"}
        </button>
      </div>
      {expanded && (
        <div className="grid grid-cols-3 gap-2 mt-3">
          <input type="text" value={config.baseUrl} onChange={(e) => onChange({ ...config, baseUrl: e.target.value })}
            placeholder="Base URL" className="px-2 py-1 text-xs border border-gray-300 rounded" />
          <input type="text" value={config.model} onChange={(e) => onChange({ ...config, model: e.target.value })}
            placeholder="Model" className="px-2 py-1 text-xs border border-gray-300 rounded" />
          <button onClick={testConnection} className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300">
            Test
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function InputLabel({ text }: { text: string }) {
  return <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1">{text}</label>;
}

function SectionHead({ text }: { text: string }) {
  return <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">{text}</h3>;
}

function ParamRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-gray-100 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

// ── AI Prompt Builders ──────────────────────────────────────────

const DESIGN_SYSTEM_PROMPT = `You are a structural engineering design calculator. You perform design checks per the specified code and return results as JSON.

Return ONLY valid JSON with this schema:
{
  "status": "pass" | "fail" | "warning",
  "summary": "Brief design summary sentence",
  "sections": [
    {
      "title": "Section title (e.g. Flexural Design, Shear Check)",
      "rows": [
        { "label": "Parameter name", "value": "Computed value with units", "status": "ok" | "warn" | "fail" }
      ]
    }
  ],
  "reinforcement": "Optional reinforcement summary (e.g. 4-T20 top, 2-T16 bottom, T10@200 stirrups)"
}

Show step-by-step calculations. Include code clause references. Be precise with units. Mark each check row with status.`;

function buildDesignPrompt(type: DesignType, inputs: DesignInput, forceData: string): string {
  const common = `Design Code: ${inputs.designCode}\nConcrete: ${inputs.concreteGrade}\nSteel: ${inputs.steelGrade}\nCover: ${inputs.cover}mm`;

  switch (type) {
    case "beam":
      return `Design a reinforced concrete beam.
${common}
Section: b=${inputs.width}mm x h=${inputs.depth}mm
${forceData}

Perform: flexural design (Mu), shear design (Vu), deflection check, crack width check.
Show all intermediate calculations with clause references.`;

    case "column":
      return `Design a reinforced concrete column.
${common}
Section: b=${inputs.width}mm x h=${inputs.depth}mm
${forceData}

Perform: axial capacity, moment capacity (uniaxial/biaxial), slenderness check, interaction diagram check.
Show all intermediate calculations with clause references.`;

    case "slab":
      return `Design a reinforced concrete ${inputs.supportCondition} slab.
${common}
Thickness: ${inputs.thickness}mm
Span X: ${inputs.spanX}m, Span Y: ${inputs.spanY}m
Support condition: ${inputs.supportCondition}

Perform: flexural design both directions, punching shear check (if applicable), deflection check, minimum reinforcement.
Show all intermediate calculations with clause references.`;

    case "footing":
      return `Design a ${inputs.footingType} reinforced concrete footing.
${common}
Column size: ${inputs.columnWidth}mm
Allowable soil bearing pressure: ${inputs.soilBearing} kPa
Applied axial load: ${inputs.axialLoad} kN
${inputs.momentX ? `Moment X: ${inputs.momentX} kN-m` : ""}
${inputs.momentY ? `Moment Y: ${inputs.momentY} kN-m` : ""}

Perform: footing sizing, bearing pressure check, flexural design, one-way shear, punching shear, development length.
Show all intermediate calculations with clause references.`;
  }
}
