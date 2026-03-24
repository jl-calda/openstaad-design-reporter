import { useState, useEffect, useCallback, useRef } from "react";
import { AIClient, DEFAULT_AI_CONFIG } from "../lib/ai-client";
import type { AIClientConfig } from "../lib/ai-client";
import { generateModel, applyModelToSTAAD } from "../lib/model-generator";
import type { GenerationStep, GeneratedModel } from "../lib/model-generator";
import type { OpenSTAADApi } from "../lib/openstaad-api";

interface Props {
  api: OpenSTAADApi;
  onModelGenerated: () => void;
}

const EXAMPLE_PROMPTS = [
  "Simple 2D portal frame: 2 columns 4m tall, 6m span beam on top, fixed base supports, dead load -20 kN/m on beam",
  "3-story 2-bay steel frame, 3.5m story height, 5m bay width, fixed supports, dead + live loads",
  "Steel truss bridge: 20m span, 3m depth, Warren truss pattern, pinned supports",
  "Single story warehouse: 4 bays at 8m, 6m height, braced frame with lateral loads",
];

export function AIModelGenerator({ api, onModelGenerated }: Props) {
  const aiRef = useRef<AIClient>(new AIClient());
  const [config, setConfig] = useState<AIClientConfig>(DEFAULT_AI_CONFIG);
  const [aiConnected, setAiConnected] = useState<boolean | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<"idle" | "generating" | "preview" | "applying" | "done" | "error">("idle");
  const [generatedModel, setGeneratedModel] = useState<GeneratedModel | null>(null);
  const [steps, setSteps] = useState<GenerationStep[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [resultSummary, setResultSummary] = useState("");

  // Check AI connectivity on config change
  const checkConnection = useCallback(async () => {
    setAiConnected(null);
    aiRef.current.updateConfig(config);
    const ok = await aiRef.current.ping();
    setAiConnected(ok);
    if (ok) {
      const models = await aiRef.current.listModels();
      setAvailableModels(models);
    } else {
      setAvailableModels([]);
    }
  }, [config]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setPhase("generating");
    setErrorMsg("");
    setGeneratedModel(null);
    setSteps([]);

    try {
      const model = await generateModel(aiRef.current, prompt);
      setGeneratedModel(model);
      setPhase("preview");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Generation failed");
      setPhase("error");
    }
  };

  const handleApply = async () => {
    if (!generatedModel) return;
    setPhase("applying");
    setErrorMsg("");

    try {
      const result = await applyModelToSTAAD(api, generatedModel, setSteps);
      setResultSummary(`Created ${result.nodeCount} nodes and ${result.memberCount} members`);
      setPhase("done");
      onModelGenerated();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to apply model");
      setPhase("error");
    }
  };

  const handleReset = () => {
    setPhase("idle");
    setGeneratedModel(null);
    setSteps([]);
    setErrorMsg("");
    setResultSummary("");
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-blue-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">AI Model Generator</h2>
              <p className="text-xs text-gray-500">Describe a structure, AI generates the STAAD model</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* AI status */}
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${
                aiConnected === null ? "bg-yellow-400 animate-pulse" :
                aiConnected ? "bg-green-500" : "bg-red-500"
              }`} />
              <span className="text-xs text-gray-500">
                {aiConnected === null ? "Checking..." : aiConnected ? "AI Connected" : "AI Offline"}
              </span>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white/60 transition-colors"
              title="AI Settings"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Settings panel */}
        {showSettings && (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
            <h3 className="text-sm font-medium text-gray-700">AI Connection Settings</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">API Format</label>
                <select
                  value={config.apiFormat}
                  onChange={(e) => setConfig({ ...config, apiFormat: e.target.value as "ollama" | "openai" })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="ollama">Ollama</option>
                  <option value="openai">OpenAI-compatible (LM Studio, vLLM)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Base URL</label>
                <input
                  type="text"
                  value={config.baseUrl}
                  onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Model</label>
                {availableModels.length > 0 ? (
                  <select
                    value={config.model}
                    onChange={(e) => setConfig({ ...config, model: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {availableModels.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={config.model}
                    onChange={(e) => setConfig({ ...config, model: e.target.value })}
                    placeholder="e.g. llama3.1"
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={checkConnection}
                className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-100 rounded-lg hover:bg-purple-200 transition-colors"
              >
                Test Connection
              </button>
              {aiConnected === false && (
                <span className="text-xs text-red-600">
                  Cannot reach AI server. Make sure it's running.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Prompt input */}
        {(phase === "idle" || phase === "error") && (
          <>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Describe the structure you want to create:
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="e.g. 2-story steel frame with 3 bays at 6m spacing, 3.5m story height, fixed supports, with dead and live loads..."
                className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg resize-none
                           focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Example prompts */}
            <div>
              <p className="text-xs text-gray-500 mb-2">Examples:</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setPrompt(ex)}
                    className="px-2.5 py-1 text-xs text-purple-700 bg-purple-50 rounded-lg
                               hover:bg-purple-100 transition-colors text-left"
                  >
                    {ex.length > 60 ? ex.slice(0, 60) + "..." : ex}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || !aiConnected}
              className="px-5 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg
                         hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              Generate Model
            </button>
          </>
        )}

        {/* Generating spinner */}
        {phase === "generating" && (
          <div className="flex items-center gap-3 py-4">
            <svg className="animate-spin h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm text-gray-600">AI is generating your structural model...</span>
          </div>
        )}

        {/* Preview */}
        {phase === "preview" && generatedModel && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h3 className="text-sm font-medium text-green-800 mb-2">Model Generated Successfully</h3>
              <ModelPreview model={generatedModel} />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleApply}
                className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg
                           hover:bg-green-700 transition-colors"
              >
                Apply to STAAD
              </button>
              <button
                onClick={handleGenerate}
                className="px-5 py-2 text-sm font-medium text-purple-700 bg-purple-100 rounded-lg
                           hover:bg-purple-200 transition-colors"
              >
                Regenerate
              </button>
              <button
                onClick={handleReset}
                className="px-5 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg
                           hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Applying progress */}
        {phase === "applying" && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Applying model to STAAD...</p>
            <StepProgress steps={steps} />
          </div>
        )}

        {/* Done */}
        {phase === "done" && (
          <div className="space-y-3">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-800 font-medium">Model applied successfully!</p>
              <p className="text-xs text-green-700 mt-1">{resultSummary}</p>
            </div>
            <StepProgress steps={steps} />
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-100 rounded-lg
                         hover:bg-purple-200 transition-colors"
            >
              Generate Another
            </button>
          </div>
        )}

        {/* Error */}
        {phase === "error" && errorMsg && (
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <p className="text-sm text-red-800 font-medium">Generation failed</p>
            <p className="text-xs text-red-700 mt-1 font-mono whitespace-pre-wrap">{errorMsg}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function ModelPreview({ model }: { model: GeneratedModel }) {
  const totalNodeLoads = model.loadCases?.reduce((sum, lc) => sum + (lc.nodeLoads?.length ?? 0), 0) ?? 0;
  const totalMemberLoads = model.loadCases?.reduce((sum, lc) => sum + (lc.memberLoads?.length ?? 0), 0) ?? 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
      <Stat label="Nodes" value={model.nodes.length} />
      <Stat label="Members" value={model.members.length} />
      <Stat label="Supports" value={model.supports?.length ?? 0} />
      <Stat label="Load Cases" value={model.loadCases?.length ?? 0} />
      <Stat label="Node Loads" value={totalNodeLoads} />
      <Stat label="Member Loads" value={totalMemberLoads} />
      <Stat label="Property Groups" value={model.properties?.length ?? 0} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function StepProgress({ steps }: { steps: GenerationStep[] }) {
  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-5 h-5 flex items-center justify-center">
            {step.status === "pending" && (
              <div className="w-2 h-2 bg-gray-300 rounded-full" />
            )}
            {step.status === "running" && (
              <svg className="animate-spin w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {step.status === "done" && (
              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
            {step.status === "error" && (
              <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          <span className={`text-sm ${step.status === "done" ? "text-gray-600" : step.status === "running" ? "text-purple-700 font-medium" : "text-gray-400"}`}>
            {step.label}
          </span>
          {step.detail && (
            <span className="text-xs text-gray-400 font-mono">{step.detail}</span>
          )}
        </div>
      ))}
    </div>
  );
}
