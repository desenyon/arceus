import { ProviderError } from "../core/errors.js";
import type { ProviderRequest, ProviderResponse } from "../core/types.js";
import type { ProviderAdapter } from "./base.js";
import { extractJsonBlock, withRetry } from "./base.js";

export class AnthropicProviderAdapter implements ProviderAdapter {
  public readonly name = "anthropic";

  public async invoke<TStructured>(request: ProviderRequest): Promise<ProviderResponse<TStructured>> {
    const apiKeyEnv = request.profile.apiKeyEnv ?? "ANTHROPIC_API_KEY";
    const apiKey = process.env[apiKeyEnv];

    if (!apiKey) {
      throw new ProviderError(`Missing ${apiKeyEnv} for model profile ${request.profile.id}.`);
    }

    const endpoint = request.profile.baseUrl ?? "https://api.anthropic.com/v1/messages";

    return withRetry(async () => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          ...request.profile.headers
        },
        body: JSON.stringify({
          model: request.profile.model,
          max_tokens: request.profile.capabilities.maxOutputTokens ?? 4000,
          system: request.systemPrompt,
          messages: [
            {
              role: "user",
              content: request.prompt
            }
          ]
        })
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
          `Anthropic request failed with status ${response.status}${detail}.`,
          response.status
        );
      }

      const data = (await response.json()) as {
        content?: Array<{ type?: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const text = data.content?.map((item) => item.text ?? "").join("\n") ?? "";

      const responseBody: ProviderResponse<TStructured> = {
        provider: "anthropic",
        model: request.profile.model,
        text
      };

      if (request.output === "changeset") {
        const structured = extractJsonBlock<TStructured>(text);
        if (structured !== undefined) {
          responseBody.structured = structured;
        }
      }

      if (data.usage?.input_tokens !== undefined || data.usage?.output_tokens !== undefined) {
        responseBody.usage = {
          ...(data.usage?.input_tokens !== undefined ? { inputTokens: data.usage.input_tokens } : {}),
          ...(data.usage?.output_tokens !== undefined ? { outputTokens: data.usage.output_tokens } : {})
        };
      }

      return responseBody;
    });
  }
}
