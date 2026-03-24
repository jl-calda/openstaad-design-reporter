"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { BridgeClient } from "@/lib/bridge-client";
import type { BridgeStatus } from "@/lib/bridge-client";
import { OpenSTAADApi } from "@/lib/openstaad-api";

const DEFAULT_URL = "ws://localhost:8765";

export function useBridge(url = DEFAULT_URL) {
  const clientRef = useRef<BridgeClient | null>(null);
  const apiRef = useRef<OpenSTAADApi | null>(null);
  const [status, setStatus] = useState<BridgeStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);

  // Initialize client once
  if (!clientRef.current) {
    clientRef.current = new BridgeClient(url);
    apiRef.current = new OpenSTAADApi(clientRef.current);
  }

  useEffect(() => {
    const client = clientRef.current!;
    const unsub = client.onStatusChange(setStatus);
    return () => {
      unsub();
      client.close();
    };
  }, []);

  const connectBridge = useCallback(async () => {
    setError(null);
    try {
      await clientRef.current!.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
      throw e;
    }
  }, []);

  const connectSTAAD = useCallback(async () => {
    setError(null);
    try {
      await apiRef.current!.connect();
    } catch (e) {
      setError(e instanceof Error ? e.message : "STAAD connection failed");
      throw e;
    }
  }, []);

  const disconnectBridge = useCallback(() => {
    clientRef.current!.close();
    setError(null);
  }, []);

  return {
    status,
    error,
    api: apiRef.current!,
    connectBridge,
    connectSTAAD,
    disconnectBridge,
  };
}
