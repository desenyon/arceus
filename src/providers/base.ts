import type { ProviderRequest, ProviderResponse } from "../core/types.js";

export interface ProviderAdapter {
  readonly name: string;
  invoke<TStructured>(request: ProviderRequest): Promise<ProviderResponse<TStructured>>;
}

export function extractJsonBlock<T>(text: string): T | undefined {
  const fencedMatch = text.match(/```json\s*([\s\S]+?)```/i);
  const candidate = fencedMatch?.[1] ?? text.trim();

  try {
    return JSON.parse(candidate) as T;
  } catch {
    return undefined;
  }
}
