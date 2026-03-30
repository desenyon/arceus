import { ProviderError } from "../core/errors.js";
import type { ModelProfile, ProviderName } from "../core/types.js";
import { AnthropicProviderAdapter } from "./anthropic.js";
import type { ProviderAdapter } from "./base.js";
import { LocalProviderAdapter } from "./local.js";
import { MockProviderAdapter } from "./mock.js";
import { OpenAIProviderAdapter } from "./openai.js";

export class ProviderRegistry {
  private readonly providers: Map<ProviderName, ProviderAdapter>;

  public constructor() {
    this.providers = new Map<ProviderName, ProviderAdapter>([
      ["anthropic", new AnthropicProviderAdapter()],
      ["local", new LocalProviderAdapter()],
      ["mock", new MockProviderAdapter()],
      ["openai", new OpenAIProviderAdapter()]
    ]);
  }

  public get(profile: ModelProfile): ProviderAdapter {
    const adapter = this.providers.get(profile.provider);

    if (!adapter) {
      throw new ProviderError(`No provider adapter registered for ${profile.provider}.`);
    }

    return adapter;
  }
}
