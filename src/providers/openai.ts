import { ProviderError } from "../core/errors.js";
import type { ProviderRequest, ProviderResponse } from "../core/types.js";
import type { ProviderAdapter } from "./base.js";
import { extractJsonBlock } from "./base.js";

export class OpenAIProviderAdapter implements ProviderAdapter {
  public readonly name = "openai";

  public async invoke<TStructured>(request: ProviderRequest): Promise<ProviderResponse<TStructured>> {
    const apiKeyEnv = request.profile.apiKeyEnv ?? "OPENAI_API_KEY";
    const apiKey = process.env[apiKeyEnv];

    if (!apiKey) {
      throw new ProviderError(`Missing ${apiKeyEnv} for model profile ${request.profile.id}.`);
    }

    const endpoint = `${request.profile.baseUrl ?? "https://api.openai.com/v1"}/chat/completions`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
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
    });

    if (!response.ok) {
      throw new ProviderError(`OpenAI request failed with status ${response.status}.`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { completion_tokens?: number; prompt_tokens?: number };
    };
    const text = data.choices?.[0]?.message?.content ?? "";

    const responseBody: ProviderResponse<TStructured> = {
      provider: "openai",
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
  }
}
