export class ArceusError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ArceusError";
  }
}

export class ConfigError extends ArceusError {
  public constructor(message: string) {
    super("CONFIG_ERROR", message);
    this.name = "ConfigError";
  }
}

export class ProviderError extends ArceusError {
  public readonly statusCode: number | undefined;

  public constructor(message: string, statusCode?: number) {
    super("PROVIDER_ERROR", message);
    this.name = "ProviderError";
    this.statusCode = statusCode;
  }
}

export class ToolError extends ArceusError {
  public constructor(message: string) {
    super("TOOL_ERROR", message);
    this.name = "ToolError";
  }
}
