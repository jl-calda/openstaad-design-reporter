"use client";

import { useState } from "react";
import type { BridgeStatus } from "@/lib/bridge-client";

interface Props {
  status: BridgeStatus;
  error: string | null;
  onConnectBridge: () => Promise<void>;
  onConnectSTAAD: () => Promise<void>;
  onDisconnect: () => void;
}

const STATUS_CONFIG: Record<BridgeStatus, { color: string; label: string }> = {
  disconnected: { color: "bg-gray-400", label: "Disconnected" },
  connecting: { color: "bg-yellow-400 animate-pulse", label: "Connecting..." },
  connected: { color: "bg-green-500", label: "Connected" },
  error: { color: "bg-red-500", label: "Error" },
};

export function ConnectionPanel({
  status,
  error,
  onConnectBridge,
  onConnectSTAAD,
  onDisconnect,
}: Props) {
  const [bridgeUrl, setBridgeUrl] = useState("ws://localhost:8765");
  const [loading, setLoading] = useState(false);
  const cfg = STATUS_CONFIG[status];

  const handleConnect = async () => {
    setLoading(true);
    try {
      await onConnectBridge();
      await onConnectSTAAD();
    } catch {
      // error is set in the hook
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Bridge Connection</h2>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${cfg.color}`} />
          <span className="text-sm text-gray-600">{cfg.label}</span>
        </div>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          value={bridgeUrl}
          onChange={(e) => setBridgeUrl(e.target.value)}
          placeholder="ws://localhost:8765"
          disabled={status === "connected"}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     disabled:bg-gray-50 disabled:text-gray-500"
        />
        {status === "connected" ? (
          <button
            onClick={onDisconnect}
            className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg
                       hover:bg-red-100 transition-colors"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg
                       hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Connecting..." : "Connect"}
          </button>
        )}
      </div>

      {error && (
        <div className="mt-3 p-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {status === "disconnected" && !error && (
        <p className="mt-3 text-xs text-gray-500">
          Start the bridge server first:{" "}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">
            python bridge/mock_bridge.py
          </code>
        </p>
      )}
    </div>
  );
}
