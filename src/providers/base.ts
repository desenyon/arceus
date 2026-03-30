import type { ProviderRequest, ProviderResponse } from "../core/types.js";
import { ProviderError } from "../core/errors.js";

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

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const BASE_DELAY_MS = 500;
const MAX_RETRIES = 3;

export async function withRetry<T>(fn: () => Promise<T>, maxRetries = MAX_RETRIES): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const isRetryable =
        error instanceof ProviderError &&
        typeof error.statusCode === "number" &&
        RETRYABLE_STATUS_CODES.has(error.statusCode);

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      const delayMs = BASE_DELAY_MS * 2 ** attempt + Math.random() * 100;
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
