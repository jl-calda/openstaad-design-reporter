/**
 * Structural Calculation Report
 *
 * A professional engineering calculation presentation that displays:
 * - Title block with project info, engineer, date, revision
 * - Table of contents
 * - Design basis & assumptions
 * - Structural geometry (nodes, members)
 * - Member properties & materials
 * - Support conditions
 * - Loading summary (load cases, applied loads)
 * - Analysis results (displacements, reactions, member forces)
 *
 * Designed for print: clean typography, page breaks, no UI chrome.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  OpenSTAADApi,
  ProjectInfo,
  Node,
  Beam,
  LoadCase,
  Support,
  MemberProperty,
  NodeDisplacement,
  SupportReaction,
  MemberForcesResult,
} from "@/lib/openstaad-api";

interface Props {
  api: OpenSTAADApi;
  projectInfo: ProjectInfo;
  nodes: Node[];
  beams: Beam[];
  loadCases: LoadCase[];
  supports: Support[];
}

interface ReportMeta {
  engineer: string;
  checker: string;
  revision: string;
  date: string;
  jobNumber: string;
  designCode: string;
  notes: string;
}

interface ReportData {
  memberProperties: Map<number, MemberProperty>;
  displacements: Map<number, NodeDisplacement[]>;
  reactions: Map<number, SupportReaction[]>;
  memberForces: Map<string, MemberForcesResult>;
}

const DEFAULT_META: ReportMeta = {
  engineer: "",
  checker: "",
  revision: "0",
  date: new Date().toISOString().split("T")[0],
  jobNumber: "",
  designCode: "",
  notes: "",
};

export function CalculationReport({ api, projectInfo, nodes, beams, loadCases, supports }: Props) {
  const [meta, setMeta] = useState<ReportMeta>(DEFAULT_META);
  const [showMetaEditor, setShowMetaEditor] = useState(true);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [selectedLoadCases, setSelectedLoadCases] = useState<number[]>([]);

  // Default: select all load cases
  useEffect(() => {
    setSelectedLoadCases(loadCases.map((lc) => lc.id));
  }, [loadCases]);

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch member properties for all members
      const propResults = await Promise.all(
        beams.map((b) => api.getMemberProperties(b.id).catch(() => null))
      );
      const memberProperties = new Map<number, MemberProperty>();
      propResults.forEach((p) => {
        if (p) memberProperties.set(p.beamId, p);
      });

      // Fetch displacements and reactions for selected load cases
      const displacements = new Map<number, NodeDisplacement[]>();
      const reactions = new Map<number, SupportReaction[]>();
      for (const lcId of selectedLoadCases) {
        const [d, r] = await Promise.all([
          api.getNodeDisplacements(lcId).catch(() => null),
          api.getSupportReactions(lcId).catch(() => null),
        ]);
        if (d) displacements.set(lcId, d.displacements);
        if (r) reactions.set(lcId, r.reactions);
      }

      // Fetch member forces for all members, all selected load cases
      const memberForces = new Map<string, MemberForcesResult>();
      for (const lcId of selectedLoadCases) {
        for (const b of beams) {
          try {
            const mf = await api.getMemberForces(b.id, lcId);
            memberForces.set(`${b.id}-${lcId}`, mf);
          } catch {
            // skip
          }
        }
      }

      setReportData({ memberProperties, displacements, reactions, memberForces });
    } catch (e) {
      console.error("Failed to fetch report data:", e);
    } finally {
      setLoading(false);
    }
  }, [api, beams, selectedLoadCases]);

  const handlePrint = () => {
    window.print();
  };

  const toggleLoadCase = (lcId: number) => {
    setSelectedLoadCases((prev) =>
      prev.includes(lcId) ? prev.filter((id) => id !== lcId) : [...prev, lcId]
    );
  };

  return (
    <div className="space-y-6">
      {/* Controls (hidden in print) */}
      <div className="print:hidden space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Calculation Report</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowMetaEditor(!showMetaEditor)}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {showMetaEditor ? "Hide" : "Edit"} Details
              </button>
              <button
                onClick={fetchReportData}
                disabled={loading || selectedLoadCases.length === 0}
                className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "Loading..." : "Generate Report"}
              </button>
              {reportData && (
                <button
                  onClick={handlePrint}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-900 transition-colors"
                >
                  Print / PDF
                </button>
              )}
            </div>
          </div>

          {showMetaEditor && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetaField label="Engineer" value={meta.engineer} onChange={(v) => setMeta({ ...meta, engineer: v })} />
                <MetaField label="Checker" value={meta.checker} onChange={(v) => setMeta({ ...meta, checker: v })} />
                <MetaField label="Job Number" value={meta.jobNumber} onChange={(v) => setMeta({ ...meta, jobNumber: v })} />
                <MetaField label="Revision" value={meta.revision} onChange={(v) => setMeta({ ...meta, revision: v })} />
                <MetaField label="Date" value={meta.date} onChange={(v) => setMeta({ ...meta, date: v })} type="date" />
                <MetaField label="Design Code" value={meta.designCode} onChange={(v) => setMeta({ ...meta, designCode: v })} placeholder="e.g. AISC 360-22" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1">Notes / Assumptions</label>
                <textarea
                  value={meta.notes}
                  onChange={(e) => setMeta({ ...meta, notes: e.target.value })}
                  rows={2}
                  placeholder="Design assumptions, loading basis, material grades..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2">Include Load Cases</label>
                <div className="flex flex-wrap gap-2">
                  {loadCases.map((lc) => (
                    <label key={lc.id} className="inline-flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedLoadCases.includes(lc.id)}
                        onChange={() => toggleLoadCase(lc.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {lc.id}: {lc.title}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* The printable report */}
      {reportData && (
        <div className="calc-report bg-white print:shadow-none shadow-sm border border-gray-200 print:border-0 rounded-xl print:rounded-none">
          {/* Title Block */}
          <section className="p-8 border-b-2 border-gray-900 print:break-after-avoid">
            <div className="border-2 border-gray-900 p-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <h1 className="text-2xl font-bold text-gray-900 mb-1">STRUCTURAL CALCULATION</h1>
                  <h2 className="text-lg font-semibold text-gray-700">{projectInfo.projectName}</h2>
                  <p className="text-sm text-gray-500 font-mono mt-1">{projectInfo.fileName}</p>
                </div>
                <div className="text-right">
                  <TitleBlockField label="Job No." value={meta.jobNumber || "-"} />
                  <TitleBlockField label="Rev" value={meta.revision} />
                  <TitleBlockField label="Date" value={meta.date} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-400">
                <TitleBlockField label="Designed By" value={meta.engineer || "-"} />
                <TitleBlockField label="Checked By" value={meta.checker || "-"} />
                <TitleBlockField label="Design Code" value={meta.designCode || "-"} />
                <TitleBlockField label="Software" value="STAAD.Pro (OpenSTAAD)" />
              </div>
            </div>
          </section>

          {/* Table of Contents */}
          <ReportSection number="0" title="TABLE OF CONTENTS">
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
              <li>Design Basis & Assumptions</li>
              <li>Structural Geometry</li>
              <li>Member Properties</li>
              <li>Support Conditions</li>
              <li>Loading</li>
              <li>Analysis Results — Displacements</li>
              <li>Analysis Results — Support Reactions</li>
              <li>Analysis Results — Member Forces</li>
            </ol>
          </ReportSection>

          {/* 1. Design Basis */}
          <ReportSection number="1" title="DESIGN BASIS & ASSUMPTIONS">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <SectionSubhead text="Model Summary" />
                  <InfoRow label="Total Nodes" value={String(nodes.length)} />
                  <InfoRow label="Total Members" value={String(beams.length)} />
                  <InfoRow label="Support Nodes" value={String(supports.length)} />
                  <InfoRow label="Load Cases" value={String(loadCases.length)} />
                </div>
                <div>
                  <SectionSubhead text="Design Parameters" />
                  <InfoRow label="Design Code" value={meta.designCode || "Not specified"} />
                  <InfoRow label="Analysis Software" value="STAAD.Pro via OpenSTAAD" />
                  <InfoRow label="Analysis Type" value="Linear Static" />
                </div>
              </div>
              {meta.notes && (
                <div>
                  <SectionSubhead text="Notes & Assumptions" />
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{meta.notes}</p>
                </div>
              )}
            </div>
          </ReportSection>

          {/* 2. Geometry */}
          <ReportSection number="2" title="STRUCTURAL GEOMETRY" pageBreak>
            <div className="space-y-6">
              <div>
                <SectionSubhead text="2.1 Node Coordinates" />
                <CalcTable
                  columns={["Node", "X (m)", "Y (m)", "Z (m)"]}
                  rows={nodes.map((n) => [String(n.id), fmt(n.x), fmt(n.y), fmt(n.z)])}
                />
              </div>
              <div>
                <SectionSubhead text="2.2 Member Incidences" />
                <CalcTable
                  columns={["Member", "Start Node", "End Node"]}
                  rows={beams.map((b) => [String(b.id), String(b.startNode), String(b.endNode)])}
                />
              </div>
            </div>
          </ReportSection>

          {/* 3. Properties */}
          <ReportSection number="3" title="MEMBER PROPERTIES" pageBreak>
            <SectionSubhead text="Section Assignments" />
            <CalcTable
              columns={["Member", "Section", "Material"]}
              rows={beams.map((b) => {
                const p = reportData.memberProperties.get(b.id);
                return [String(b.id), p?.sectionName ?? "-", p?.material ?? "-"];
              })}
            />
          </ReportSection>

          {/* 4. Supports */}
          <ReportSection number="4" title="SUPPORT CONDITIONS" pageBreak>
            <SectionSubhead text="Supported Nodes" />
            <CalcTable
              columns={["Node", "X (m)", "Y (m)", "Z (m)"]}
              rows={supports.map((s) => {
                const n = nodes.find((nd) => nd.id === s.nodeId);
                return [String(s.nodeId), n ? fmt(n.x) : "-", n ? fmt(n.y) : "-", n ? fmt(n.z) : "-"];
              })}
            />
          </ReportSection>

          {/* 5. Loading */}
          <ReportSection number="5" title="LOADING" pageBreak>
            <SectionSubhead text="Load Cases" />
            <CalcTable
              columns={["LC", "Title"]}
              rows={loadCases
                .filter((lc) => selectedLoadCases.includes(lc.id))
                .map((lc) => [String(lc.id), lc.title])}
            />
          </ReportSection>

          {/* 6. Displacements */}
          {selectedLoadCases.map((lcId) => {
            const disps = reportData.displacements.get(lcId);
            const lc = loadCases.find((l) => l.id === lcId);
            if (!disps) return null;
            return (
              <ReportSection
                key={`disp-${lcId}`}
                number="6"
                title={`ANALYSIS RESULTS — NODE DISPLACEMENTS`}
                subtitle={`Load Case ${lcId}: ${lc?.title ?? ""}`}
                pageBreak
              >
                <CalcTable
                  columns={["Node", "dX", "dY", "dZ", "rX", "rY", "rZ"]}
                  rows={disps.map((d) => [
                    String(d.nodeId),
                    fmtSci(d.dx), fmtSci(d.dy), fmtSci(d.dz),
                    fmtSci(d.rx), fmtSci(d.ry), fmtSci(d.rz),
                  ])}
                  mono
                />
                <MaxSummary label="Max Displacement" items={[
                  { dir: "dX", value: maxAbs(disps, "dx"), node: maxAbsNode(disps, "dx") },
                  { dir: "dY", value: maxAbs(disps, "dy"), node: maxAbsNode(disps, "dy") },
                  { dir: "dZ", value: maxAbs(disps, "dz"), node: maxAbsNode(disps, "dz") },
                ]} />
              </ReportSection>
            );
          })}

          {/* 7. Reactions */}
          {selectedLoadCases.map((lcId) => {
            const rxns = reportData.reactions.get(lcId);
            const lc = loadCases.find((l) => l.id === lcId);
            if (!rxns) return null;
            return (
              <ReportSection
                key={`rxn-${lcId}`}
                number="7"
                title={`ANALYSIS RESULTS — SUPPORT REACTIONS`}
                subtitle={`Load Case ${lcId}: ${lc?.title ?? ""}`}
                pageBreak
              >
                <CalcTable
                  columns={["Node", "Fx (kN)", "Fy (kN)", "Fz (kN)", "Mx (kN-m)", "My (kN-m)", "Mz (kN-m)"]}
                  rows={rxns.map((r) => [
                    String(r.nodeId),
                    fmtF(r.fx), fmtF(r.fy), fmtF(r.fz),
                    fmtF(r.mx), fmtF(r.my), fmtF(r.mz),
                  ])}
                  mono
                />
                <MaxSummary label="Max Reaction" items={[
                  { dir: "Fy", value: maxAbs(rxns, "fy"), node: maxAbsNode(rxns, "fy") },
                  { dir: "Fx", value: maxAbs(rxns, "fx"), node: maxAbsNode(rxns, "fx") },
                ]} />
              </ReportSection>
            );
          })}

          {/* 8. Member Forces */}
          {selectedLoadCases.map((lcId) => {
            const lc = loadCases.find((l) => l.id === lcId);
            const rows: string[][] = [];
            for (const b of beams) {
              const mf = reportData.memberForces.get(`${b.id}-${lcId}`);
              if (!mf) continue;
              for (const f of mf.forces) {
                rows.push([
                  String(b.id),
                  f.section === "start" ? "Start" : "End",
                  fmtF(f.fx), fmtF(f.fy), fmtF(f.fz),
                  fmtF(f.mx), fmtF(f.my), fmtF(f.mz),
                ]);
              }
            }
            if (rows.length === 0) return null;
            return (
              <ReportSection
                key={`mf-${lcId}`}
                number="8"
                title={`ANALYSIS RESULTS — MEMBER END FORCES`}
                subtitle={`Load Case ${lcId}: ${lc?.title ?? ""}`}
                pageBreak
              >
                <CalcTable
                  columns={["Member", "End", "Fx (kN)", "Fy (kN)", "Fz (kN)", "Mx (kN-m)", "My (kN-m)", "Mz (kN-m)"]}
                  rows={rows}
                  mono
                />
              </ReportSection>
            );
          })}

          {/* Footer */}
          <section className="px-8 py-6 border-t-2 border-gray-900 text-center">
            <p className="text-xs text-gray-500">
              Generated by OpenSTAAD Design Reporter &mdash; {meta.date} &mdash; Rev {meta.revision}
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function MetaField({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? label}
        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function TitleBlockField({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-1">
      <span className="text-xs font-medium text-gray-500 uppercase">{label}: </span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function ReportSection({ number, title, subtitle, children, pageBreak }: {
  number: string; title: string; subtitle?: string; children: React.ReactNode; pageBreak?: boolean;
}) {
  return (
    <section className={`px-8 py-6 ${pageBreak ? "print:break-before-page" : ""}`}>
      <div className="border-b-2 border-gray-800 pb-2 mb-4">
        <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">
          <span className="text-gray-500 mr-2">{number}.</span>{title}
        </h2>
        {subtitle && <p className="text-sm text-gray-600 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function SectionSubhead({ text }: { text: string }) {
  return <h3 className="text-sm font-semibold text-gray-800 mb-2 mt-4 first:mt-0">{text}</h3>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-gray-100 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

function CalcTable({ columns, rows, mono }: { columns: string[]; rows: string[][]; mono?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-800">
            {columns.map((col, i) => (
              <th
                key={i}
                className={`px-3 py-1.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider ${
                  i > 0 && mono ? "text-right" : ""
                }`}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-gray-200 hover:bg-gray-50 print:hover:bg-transparent">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-3 py-1 text-gray-800 ${
                    ci > 0 && mono ? "text-right font-mono text-xs" : ""
                  } ${ci === 0 ? "font-medium" : ""}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MaxSummary({ label, items }: { label: string; items: { dir: string; value: number; node: number }[] }) {
  return (
    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg print:bg-transparent print:border-amber-300">
      <p className="text-xs font-bold text-amber-800 uppercase mb-1">{label}</p>
      <div className="flex flex-wrap gap-4">
        {items.map((item) => (
          <span key={item.dir} className="text-sm text-amber-900">
            <span className="font-medium">{item.dir}:</span>{" "}
            <span className="font-mono">{fmtSci(item.value)}</span>{" "}
            <span className="text-xs text-amber-700">(Node {item.node})</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Formatting helpers ──────────────────────────────────────────

function fmt(v: number): string {
  return v.toFixed(3);
}

function fmtF(v: number): string {
  return v.toFixed(2);
}

function fmtSci(v: number): string {
  if (Math.abs(v) < 0.0001 && v !== 0) return v.toExponential(3);
  return v.toFixed(6);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function maxAbs(arr: any[], key: string): number {
  let max = 0;
  for (const item of arr) {
    const val = Math.abs(item[key] ?? 0);
    if (val > max) max = val;
  }
  return max;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function maxAbsNode(arr: any[], key: string): number {
  let max = 0;
  let nodeId = 0;
  for (const item of arr) {
    const val = Math.abs(item[key] ?? 0);
    if (val > max) {
      max = val;
      nodeId = item["nodeId"] ?? 0;
    }
  }
  return nodeId;
}
