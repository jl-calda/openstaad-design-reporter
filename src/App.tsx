import { useState, useCallback } from "react";
import { useBridge } from "./hooks/useBridge";
import { ConnectionPanel } from "./components/ConnectionPanel";
import { AIModelGenerator } from "./components/AIModelGenerator";
import { LoadingTab } from "./components/LoadingTab";
import { DesignTab } from "./components/DesignTab";
import type {
  ProjectInfo,
  NodesResult,
  BeamsResult,
  LoadCasesResult,
  SupportsResult,
} from "./lib/openstaad-api";

type Tab = "ai" | "loading" | "beam" | "column" | "slab" | "footing";

const TABS: { id: Tab; label: string; color: string }[] = [
  { id: "ai", label: "AI Builder", color: "purple" },
  { id: "loading", label: "Loading", color: "amber" },
  { id: "beam", label: "Beam Design", color: "blue" },
  { id: "column", label: "Column Design", color: "emerald" },
  { id: "slab", label: "Slab Design", color: "violet" },
  { id: "footing", label: "Footing Design", color: "orange" },
];

function App() {
  const { status, error, api, connectBridge, connectSTAAD, disconnectBridge } =
    useBridge();

  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [nodes, setNodes] = useState<NodesResult | null>(null);
  const [beams, setBeams] = useState<BeamsResult | null>(null);
  const [loadCases, setLoadCases] = useState<LoadCasesResult | null>(null);
  const [supports, setSupports] = useState<SupportsResult | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("ai");

  const handleConnectSTAAD = useCallback(async () => {
    await connectSTAAD();
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
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">OpenSTAAD Design Reporter</h1>
                {isConnected && (
                  <p className="text-xs text-gray-500 truncate max-w-xs">{projectInfo.projectName}</p>
                )}
              </div>
            </div>

            {/* Model stats when connected */}
            {isConnected && (
              <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500">
                <span>{nodes?.count ?? 0} nodes</span>
                <span>{beams?.count ?? 0} members</span>
                <span>{loadCases?.count ?? 0} LCs</span>
                <span>{supports?.count ?? 0} supports</span>
              </div>
            )}
          </div>
        </div>

        {/* Tab bar */}
        {isConnected && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <nav className="flex gap-0 border-t border-gray-100 -mb-px overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? "border-gray-900 text-gray-900"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 print:px-0 print:py-0 print:max-w-none">
        {/* Connection */}
        <div className="print:hidden">
          <ConnectionPanel
            status={status}
            error={error}
            onConnectBridge={connectBridge}
            onConnectSTAAD={handleConnectSTAAD}
            onDisconnect={handleDisconnect}
          />
        </div>

        {/* Loading spinner */}
        {loadingData && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-gray-500">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Loading model data from STAAD.Pro...</span>
            </div>
          </div>
        )}

        {/* Tab content */}
        {isConnected && !loadingData && (
          <>
            {/* Tab 1: AI Builder */}
            {activeTab === "ai" && (
              <AIModelGenerator api={api} onModelGenerated={refreshModelData} />
            )}

            {/* Tab 2: Loading */}
            {activeTab === "loading" && loadCases && (
              <LoadingTab
                api={api}
                loadCases={loadCases.cases}
                onDataChanged={refreshModelData}
              />
            )}

            {/* Tab 3: Beam Design */}
            {activeTab === "beam" && nodes && beams && loadCases && (
              <DesignTab
                type="beam"
                api={api}
                nodes={nodes.nodes}
                beams={beams.beams}
                loadCases={loadCases.cases}
              />
            )}

            {/* Tab 4: Column Design */}
            {activeTab === "column" && nodes && beams && loadCases && (
              <DesignTab
                type="column"
                api={api}
                nodes={nodes.nodes}
                beams={beams.beams}
                loadCases={loadCases.cases}
              />
            )}

            {/* Tab 5: Slab Design */}
            {activeTab === "slab" && nodes && beams && loadCases && (
              <DesignTab
                type="slab"
                api={api}
                nodes={nodes.nodes}
                beams={beams.beams}
                loadCases={loadCases.cases}
              />
            )}

            {/* Tab 6: Footing Design */}
            {activeTab === "footing" && nodes && beams && loadCases && (
              <DesignTab
                type="footing"
                api={api}
                nodes={nodes.nodes}
                beams={beams.beams}
                loadCases={loadCases.cases}
              />
            )}
          </>
        )}

        {/* Empty state */}
        {!isConnected && !loadingData && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Connect to STAAD.Pro</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Start the OpenSTAAD bridge server on your Windows machine, then
              click Connect to begin designing.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
