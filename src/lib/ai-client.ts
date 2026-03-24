/**
 * Client for local AI APIs (Ollama, LM Studio, or any OpenAI-compatible endpoint).
 * Sends structured prompts and parses JSON responses for model generation.
 */

export interface AIClientConfig {
  /** Base URL of the AI server. Default: http://localhost:11434 (Ollama) */
  baseUrl: string;
  /** Model name to use. Default: llama3.1 */
  model: string;
  /** API format: "ollama" or "openai" (LM Studio, vLLM, etc.) */
  apiFormat: "ollama" | "openai";
}

export const DEFAULT_AI_CONFIG: AIClientConfig = {
  baseUrl: "http://localhost:11434",
  model: "llama3.1",
  apiFormat: "ollama",
};

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIResponse {
  content: string;
}

export class AIClient {
  private config: AIClientConfig;

  constructor(config: Partial<AIClientConfig> = {}) {
    this.config = { ...DEFAULT_AI_CONFIG, ...config };
  }

  get currentConfig(): AIClientConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<AIClientConfig>) {
    this.config = { ...this.config, ...config };
  }

  async chat(messages: AIMessage[]): Promise<AIResponse> {
    if (this.config.apiFormat === "ollama") {
      return this.chatOllama(messages);
    }
    return this.chatOpenAI(messages);
  }

  private async chatOllama(messages: AIMessage[]): Promise<AIResponse> {
    const res = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        stream: false,
        format: "json",
        options: {
          temperature: 0.1,
          num_predict: 4096,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama API error (${res.status}): ${text}`);
    }

    const data = await res.json();
    return { content: data.message?.content ?? "" };
  }

  private async chatOpenAI(messages: AIMessage[]): Promise<AIResponse> {
    const res = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI-compatible API error (${res.status}): ${text}`);
    }

    const data = await res.json();
    return { content: data.choices?.[0]?.message?.content ?? "" };
  }

  /** Quick connectivity check */
  async ping(): Promise<boolean> {
    try {
      if (this.config.apiFormat === "ollama") {
        const res = await fetch(`${this.config.baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
        return res.ok;
      } else {
        const res = await fetch(`${this.config.baseUrl}/v1/models`, { signal: AbortSignal.timeout(3000) });
        return res.ok;
      }
    } catch {
      return false;
    }
  }

  /** List available models */
  async listModels(): Promise<string[]> {
    try {
      if (this.config.apiFormat === "ollama") {
        const res = await fetch(`${this.config.baseUrl}/api/tags`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.models ?? []).map((m: { name: string }) => m.name);
      } else {
        const res = await fetch(`${this.config.baseUrl}/v1/models`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.data ?? []).map((m: { id: string }) => m.id);
      }
    } catch {
      return [];
    }
  }
}
