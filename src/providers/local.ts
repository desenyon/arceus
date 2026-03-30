import { ProviderError } from "../core/errors.js";
import type { ProviderRequest, ProviderResponse } from "../core/types.js";
import type { ProviderAdapter } from "./base.js";
import { extractJsonBlock, withRetry } from "./base.js";

export class LocalProviderAdapter implements ProviderAdapter {
  public readonly name = "local";

  public async invoke<TStructured>(request: ProviderRequest): Promise<ProviderResponse<TStructured>> {
    const baseUrl = request.profile.baseUrl ?? "http://127.0.0.1:11434/v1";
    const endpoint = `${baseUrl}/chat/completions`;

    return withRetry(async () => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...request.profile.headers
        },
        body: JSON.stringify({
          model: request.profile.model,
          temperature: request.profile.temperature ?? 0.2,
          messages: [
            {
              role: "system",
              content: request.systemPrompt
            },
            {
              role: "user",
              content: request.prompt
            }
          ]
        })
      }).catch((error) => {
        throw new ProviderError(
          `Local provider at ${baseUrl} is unreachable: ${String(error)}`
        );
      });

      if (!response.ok) {
        let detail = "";
        try {
          const body = (await response.json()) as { error?: { message?: string } };
          detail = body.error?.message ? `: ${body.error.message}` : "";
        } catch {
          // ignore parse errors
        }
        throw new ProviderError(
          `Local provider request failed with status ${response.status}${detail}.`,
          response.status
        );
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { completion_tokens?: number; prompt_tokens?: number };
      };
      const text = data.choices?.[0]?.message?.content ?? "";

      const responseBody: ProviderResponse<TStructured> = {
        provider: "local",
        model: request.profile.model,
        text
      };

      if (request.output === "changeset") {
        const structured = extractJsonBlock<TStructured>(text);
        if (structured !== undefined) {
          responseBody.structured = structured;
        }
      }

      if (data.usage?.prompt_tokens !== undefined || data.usage?.completion_tokens !== undefined) {
        responseBody.usage = {
          ...(data.usage?.prompt_tokens !== undefined ? { inputTokens: data.usage.prompt_tokens } : {}),
          ...(data.usage?.completion_tokens !== undefined ? { outputTokens: data.usage.completion_tokens } : {})
        };
      }

      return responseBody;
    });
  }
}
