/**
 * WebSocket client for communicating with the OpenSTAAD Bridge server.
 *
 * Uses a JSON-RPC style protocol:
 *   Request:  { id, method, params }
 *   Response: { id, result, error }
 */

export type BridgeStatus = "disconnected" | "connecting" | "connected" | "error";

export interface BridgeError {
  message: string;
  trace?: string;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export class BridgeClient {
  private ws: WebSocket | null = null;
  private requestId = 0;
  private pending = new Map<number, PendingRequest>();
  private statusListeners = new Set<(status: BridgeStatus) => void>();
  private _status: BridgeStatus = "disconnected";
  private url: string;
  private requestTimeout: number;

  constructor(url = "ws://localhost:8765", requestTimeout = 10000) {
    this.url = url;
    this.requestTimeout = requestTimeout;
  }

  get status(): BridgeStatus {
    return this._status;
  }

  private setStatus(status: BridgeStatus) {
    this._status = status;
    this.statusListeners.forEach((fn) => fn(status));
  }

  onStatusChange(listener: (status: BridgeStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** Open the WebSocket connection to the bridge server. */
  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.setStatus("connecting");
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.setStatus("connected");
        resolve();
      };

      this.ws.onerror = () => {
        this.setStatus("error");
        reject(new Error(`Failed to connect to bridge at ${this.url}`));
      };

      this.ws.onclose = () => {
        this.setStatus("disconnected");
        // Reject all pending requests
        for (const [, pending] of this.pending) {
          clearTimeout(pending.timeout);
          pending.reject(new Error("Connection closed"));
        }
        this.pending.clear();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const pending = this.pending.get(data.id);
          if (!pending) return;

          clearTimeout(pending.timeout);
          this.pending.delete(data.id);

          if (data.error) {
            pending.reject(new Error(data.error.message));
          } else {
            pending.resolve(data.result);
          }
        } catch {
          // Ignore malformed messages
        }
      };
    });
  }

  /** Close the WebSocket connection. */
  close() {
    this.ws?.close();
    this.ws = null;
  }

  /** Send a request to the bridge and await the response. */
  request<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("Not connected to bridge"));
        return;
      }

      const id = ++this.requestId;

      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request '${method}' timed out`));
      }, this.requestTimeout);

      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timeout,
      });

      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}
