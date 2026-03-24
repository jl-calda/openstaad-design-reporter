import { useState } from "react";
import { OpenSTAADApi } from "../lib/openstaad-api";
import type { LoadCase, DisplacementsResult, ReactionsResult } from "../lib/openstaad-api";
import { DataTable } from "./DataTable";

interface Props {
  api: OpenSTAADApi;
  loadCases: LoadCase[];
}

export function ResultsPanel({ api, loadCases }: Props) {
  const [selectedLC, setSelectedLC] = useState<number>(1);
  const [displacements, setDisplacements] = useState<DisplacementsResult | null>(null);
  const [reactions, setReactions] = useState<ReactionsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"displacements" | "reactions">("displacements");

  const fetchResults = async (lc: number) => {
    setSelectedLC(lc);
    setLoading(true);
    try {
      const [d, r] = await Promise.all([
        api.getNodeDisplacements(lc),
        api.getSupportReactions(lc),
      ]);
      setDisplacements(d);
      setReactions(r);
    } catch (e) {
      console.error("Failed to fetch results:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Analysis Results</h2>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <label className="text-sm text-gray-600">Load Case:</label>
          <select
            value={selectedLC}
            onChange={(e) => fetchResults(Number(e.target.value))}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {loadCases.map((lc) => (
              <option key={lc.id} value={lc.id}>
                {lc.id}: {lc.title}
              </option>
            ))}
          </select>
          <button
            onClick={() => fetchResults(selectedLC)}
            disabled={loading}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg
                       hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Loading..." : "Fetch Results"}
          </button>
        </div>

        <div className="flex gap-1 border-b border-gray-200">
          {(["displacements", "reactions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "displacements" ? "Node Displacements" : "Support Reactions"}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "displacements" && displacements && (
        <DataTable
          title={`Node Displacements - LC ${displacements.loadCase}`}
          columns={[
            { key: "nodeId", label: "Node" },
            { key: "dx", label: "dX" },
            { key: "dy", label: "dY" },
            { key: "dz", label: "dZ" },
            { key: "rx", label: "rX" },
            { key: "ry", label: "rY" },
            { key: "rz", label: "rZ" },
          ]}
          rows={displacements.displacements}
        />
      )}

      {activeTab === "reactions" && reactions && (
        <DataTable
          title={`Support Reactions - LC ${reactions.loadCase}`}
          columns={[
            { key: "nodeId", label: "Node" },
            { key: "fx", label: "Fx" },
            { key: "fy", label: "Fy" },
            { key: "fz", label: "Fz" },
            { key: "mx", label: "Mx" },
            { key: "my", label: "My" },
            { key: "mz", label: "Mz" },
          ]}
          rows={reactions.reactions}
        />
      )}

      {!displacements && !reactions && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-400">
          Select a load case and click "Fetch Results" to view analysis data.
        </div>
      )}
    </div>
  );
}
