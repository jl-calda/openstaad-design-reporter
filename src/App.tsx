import { useState, useCallback } from "react";
import { useBridge } from "./hooks/useBridge";
import { ConnectionPanel } from "./components/ConnectionPanel";
import { ProjectInfoCard } from "./components/ProjectInfoCard";
import { StatsBar } from "./components/StatsBar";
import { DataTable } from "./components/DataTable";
import { ResultsPanel } from "./components/ResultsPanel";
import { ModelEditor } from "./components/ModelEditor";
import { AIModelGenerator } from "./components/AIModelGenerator";
import type {
  ProjectInfo,
  NodesResult,
  BeamsResult,
  LoadCasesResult,
  SupportsResult,
} from "./lib/openstaad-api";

function App() {
  const { status, error, api, connectBridge, connectSTAAD, disconnectBridge } =
    useBridge();

  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [nodes, setNodes] = useState<NodesResult | null>(null);
  const [beams, setBeams] = useState<BeamsResult | null>(null);
  const [loadCases, setLoadCases] = useState<LoadCasesResult | null>(null);
  const [supports, setSupports] = useState<SupportsResult | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  const handleConnectSTAAD = useCallback(async () => {
    await connectSTAAD();
    // Fetch all model data after connecting to STAAD
    setLoadingData(true);
    try {
      const [pi, n, b, lc, s] = await Promise.all([
        api.getProjectInfo(),
        api.getNodes(),
        api.getBeams(),
        api.getLoadCases(),
        api.getSupports(),
      ]);
      setProjectInfo(pi);
      setNodes(n);
      setBeams(b);
      setLoadCases(lc);
      setSupports(s);
    } catch (e) {
      console.error("Failed to load model data:", e);
    } finally {
      setLoadingData(false);
    }
  }, [api, connectSTAAD]);

  const handleDisconnect = useCallback(() => {
    disconnectBridge();
    setProjectInfo(null);
    setNodes(null);
    setBeams(null);
    setLoadCases(null);
    setSupports(null);
  }, [disconnectBridge]);

  const refreshModelData = useCallback(async () => {
    try {
      const [n, b, lc, s] = await Promise.all([
        api.getNodes(),
        api.getBeams(),
        api.getLoadCases(),
        api.getSupports(),
      ]);
      setNodes(n);
      setBeams(b);
      setLoadCases(lc);
      setSupports(s);
    } catch (e) {
      console.error("Failed to refresh model data:", e);
    }
  }, [api]);

  const isConnected = status === "connected" && projectInfo !== null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                OpenSTAAD Design Reporter
              </h1>
              <p className="text-xs text-gray-500">
                Structural analysis data from STAAD.Pro via WebSocket bridge
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Connection */}
        <ConnectionPanel
          status={status}
          error={error}
          onConnectBridge={connectBridge}
          onConnectSTAAD={handleConnectSTAAD}
          onDisconnect={handleDisconnect}
        />

        {loadingData && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-gray-500">
              <svg
                className="animate-spin h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span>Loading model data from STAAD.Pro...</span>
            </div>
          </div>
        )}

        {isConnected && !loadingData && (
          <>
            {/* Project Info */}
            <ProjectInfoCard info={projectInfo} />

            {/* Stats */}
            <StatsBar
              stats={[
                { label: "Nodes", value: nodes?.count ?? 0, icon: "\u25CF" },
                { label: "Members", value: beams?.count ?? 0, icon: "\u2500" },
                {
                  label: "Load Cases",
                  value: loadCases?.count ?? 0,
                  icon: "\u2193",
                },
                {
                  label: "Supports",
                  value: supports?.count ?? 0,
                  icon: "\u25B2",
                },
              ]}
            />

            {/* Geometry Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DataTable
                title="Nodes"
                columns={[
                  { key: "id", label: "ID" },
                  { key: "x", label: "X" },
                  { key: "y", label: "Y" },
                  { key: "z", label: "Z" },
                ]}
                rows={nodes?.nodes ?? []}
                emptyMessage="No nodes loaded"
              />
              <DataTable
                title="Members"
                columns={[
                  { key: "id", label: "ID" },
                  { key: "startNode", label: "Start Node" },
                  { key: "endNode", label: "End Node" },
                ]}
                rows={beams?.beams ?? []}
                emptyMessage="No members loaded"
              />
            </div>

            {/* Load Cases */}
            <DataTable
              title="Load Cases"
              columns={[
                { key: "id", label: "ID" },
                { key: "title", label: "Title" },
              ]}
              rows={loadCases?.cases ?? []}
              emptyMessage="No load cases"
            />

            {/* AI Model Generator */}
            <AIModelGenerator api={api} onModelGenerated={refreshModelData} />

            {/* Model Editor */}
            {nodes && beams && loadCases && supports && (
              <ModelEditor
                api={api}
                nodes={nodes.nodes}
                beams={beams.beams}
                loadCases={loadCases.cases}
                supportNodeIds={supports.supports.map((s) => s.nodeId)}
                onModelChanged={refreshModelData}
              />
            )}

            {/* Analysis Results */}
            {loadCases && loadCases.cases.length > 0 && (
              <ResultsPanel api={api} loadCases={loadCases.cases} />
            )}
          </>
        )}

        {/* Empty state when not connected */}
        {!isConnected && !loadingData && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Connect to STAAD.Pro
            </h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Start the OpenSTAAD bridge server on your Windows machine, then
              click Connect to begin viewing your structural model data.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
