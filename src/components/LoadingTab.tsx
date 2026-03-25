/**
 * Tab 2: Loading
 * Define load cases and load combinations with a calculation-style presentation.
 */

"use client";

import { useState, useCallback } from "react";
import type { OpenSTAADApi, LoadCase } from "@/lib/openstaad-api";

interface Props {
  api: OpenSTAADApi;
  loadCases: LoadCase[];
  onDataChanged: () => void;
}

interface LoadCombination {
  id: string;
  name: string;
  factors: { loadCaseId: number; factor: number }[];
}

export function LoadingTab({ api, loadCases, onDataChanged }: Props) {
  const [newCaseTitle, setNewCaseTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [combinations, setCombinations] = useState<LoadCombination[]>([]);
  const [showCombEditor, setShowCombEditor] = useState(false);
  const [combName, setCombName] = useState("");
  const [combFactors, setCombFactors] = useState<{ loadCaseId: number; factor: number }[]>([]);

  const handleCreateCase = useCallback(async () => {
    if (!newCaseTitle.trim()) return;
    setCreating(true);
    try {
      await api.createLoadCase(newCaseTitle.trim());
      setNewCaseTitle("");
      onDataChanged();
    } catch (e) {
      console.error("Failed to create load case:", e);
    } finally {
      setCreating(false);
    }
  }, [api, newCaseTitle, onDataChanged]);

  const handleDeleteCase = useCallback(async (id: number) => {
    try {
      await api.deleteLoadCase(id);
      onDataChanged();
    } catch (e) {
      console.error("Failed to delete load case:", e);
    }
  }, [api, onDataChanged]);

  const addCombination = () => {
    if (!combName.trim() || combFactors.length === 0) return;
    const comb: LoadCombination = {
      id: `COMB-${combinations.length + 1}`,
      name: combName.trim(),
      factors: combFactors.filter((f) => f.factor !== 0),
    };
    setCombinations([...combinations, comb]);
    setCombName("");
    setCombFactors([]);
    setShowCombEditor(false);
  };

  const removeCombination = (id: string) => {
    setCombinations(combinations.filter((c) => c.id !== id));
  };

  const initCombFactors = () => {
    setCombFactors(loadCases.map((lc) => ({ loadCaseId: lc.id, factor: 0 })));
    setShowCombEditor(true);
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50">
          <h2 className="text-lg font-semibold text-gray-900">Loading</h2>
          <p className="text-xs text-gray-500">Define load cases and load combinations</p>
        </div>

        <div className="p-6 space-y-6">
          {/* ── Load Cases ── */}
          <div>
            <SectionHead text="Load Cases" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-800">
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase w-20">LC</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase">Title</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-700 uppercase w-20">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadCases.map((lc) => (
                    <tr key={lc.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900">{lc.id}</td>
                      <td className="px-3 py-2 text-gray-700">{lc.title}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => handleDeleteCase(lc.id)}
                          className="text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {loadCases.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-gray-400 text-sm">
                        No load cases defined
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Add load case */}
            <div className="flex gap-2 mt-3">
              <input
                type="text"
                value={newCaseTitle}
                onChange={(e) => setNewCaseTitle(e.target.value)}
                placeholder="New load case title (e.g. Dead Load, Live Load, Wind X...)"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                onKeyDown={(e) => e.key === "Enter" && handleCreateCase()}
              />
              <button
                onClick={handleCreateCase}
                disabled={!newCaseTitle.trim() || creating}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {creating ? "..." : "Add"}
              </button>
            </div>
          </div>

          {/* ── Load Combinations ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <SectionHead text="Load Combinations" />
              <button
                onClick={initCombFactors}
                disabled={loadCases.length === 0}
                className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 rounded-lg hover:bg-amber-200 disabled:opacity-50 transition-colors"
              >
                + Add Combination
              </button>
            </div>

            {/* Combination editor */}
            {showCombEditor && (
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-3 mb-4">
                <input
                  type="text"
                  value={combName}
                  onChange={(e) => setCombName(e.target.value)}
                  placeholder="Combination name (e.g. 1.2D + 1.6L)"
                  className="w-full px-3 py-2 text-sm border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-600 uppercase">Factors</p>
                  {combFactors.map((cf, i) => {
                    const lc = loadCases.find((l) => l.id === cf.loadCaseId);
                    return (
                      <div key={cf.loadCaseId} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 w-48 truncate">
                          LC {cf.loadCaseId}: {lc?.title ?? ""}
                        </span>
                        <input
                          type="number"
                          step="0.1"
                          value={cf.factor}
                          onChange={(e) => {
                            const updated = [...combFactors];
                            updated[i] = { ...cf, factor: parseFloat(e.target.value) || 0 };
                            setCombFactors(updated);
                          }}
                          className="w-24 px-2 py-1 text-sm border border-gray-300 rounded-lg text-right font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={addCombination}
                    disabled={!combName.trim()}
                    className="px-4 py-1.5 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
                  >
                    Save Combination
                  </button>
                  <button
                    onClick={() => setShowCombEditor(false)}
                    className="px-4 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Combinations table */}
            {combinations.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-800">
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase w-32">ID</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase">Name</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase">Expression</th>
                      <th className="px-3 py-2 text-right text-xs font-bold text-gray-700 uppercase w-20">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinations.map((comb) => (
                      <tr key={comb.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900 font-mono text-xs">{comb.id}</td>
                        <td className="px-3 py-2 text-gray-700">{comb.name}</td>
                        <td className="px-3 py-2 text-gray-600 font-mono text-xs">
                          {comb.factors
                            .map((f) => {
                              const lc = loadCases.find((l) => l.id === f.loadCaseId);
                              return `${f.factor}${lc?.title ?? `LC${f.loadCaseId}`}`;
                            })
                            .join(" + ")}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => removeCombination(comb.id)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {combinations.length === 0 && !showCombEditor && (
              <p className="text-sm text-gray-400 py-4 text-center">No load combinations defined</p>
            )}
          </div>
        </div>
      </div>

      {/* Calculation presentation */}
      {(loadCases.length > 0 || combinations.length > 0) && (
        <CalcPresentation loadCases={loadCases} combinations={combinations} />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function SectionHead({ text }: { text: string }) {
  return <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">{text}</h3>;
}

function CalcPresentation({ loadCases, combinations }: { loadCases: LoadCase[]; combinations: LoadCombination[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
      <div className="border-b-2 border-gray-800 pb-2">
        <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">
          Loading Summary
        </h2>
      </div>

      {/* Primary Load Cases */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Primary Load Cases</h3>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="px-3 py-1.5 text-left text-xs font-bold text-gray-600 uppercase w-20">LC</th>
              <th className="px-3 py-1.5 text-left text-xs font-bold text-gray-600 uppercase">Description</th>
            </tr>
          </thead>
          <tbody>
            {loadCases.map((lc) => (
              <tr key={lc.id} className="border-b border-gray-200">
                <td className="px-3 py-1.5 font-medium text-gray-900">{lc.id}</td>
                <td className="px-3 py-1.5 text-gray-700">{lc.title}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Load Combinations */}
      {combinations.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Load Combinations</h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="px-3 py-1.5 text-left text-xs font-bold text-gray-600 uppercase w-32">Combination</th>
                <th className="px-3 py-1.5 text-left text-xs font-bold text-gray-600 uppercase">Name</th>
                {loadCases.map((lc) => (
                  <th key={lc.id} className="px-3 py-1.5 text-right text-xs font-bold text-gray-600 uppercase w-20">
                    LC {lc.id}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {combinations.map((comb) => (
                <tr key={comb.id} className="border-b border-gray-200">
                  <td className="px-3 py-1.5 font-medium text-gray-900 font-mono text-xs">{comb.id}</td>
                  <td className="px-3 py-1.5 text-gray-700">{comb.name}</td>
                  {loadCases.map((lc) => {
                    const f = comb.factors.find((cf) => cf.loadCaseId === lc.id);
                    return (
                      <td key={lc.id} className="px-3 py-1.5 text-right font-mono text-xs text-gray-600">
                        {f && f.factor !== 0 ? f.factor.toFixed(1) : "-"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
