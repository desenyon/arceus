import { spawn } from "node:child_process";

import { ToolError } from "../core/errors.js";

export interface CommandResult {
  command: string;
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

const DESTRUCTIVE_PATTERNS = [
  /\brm\s+-rf\b/,
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+checkout\s+--\b/,
  /\bmv\s+.+\s+\/dev\/null\b/
];

export class ShellTool {
  public isDestructive(command: string): boolean {
    return DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(command));
  }

  public async run(command: string, cwd: string, shell: string, timeoutMs: number): Promise<CommandResult> {
    return new Promise<CommandResult>((resolve, reject) => {
      const child = spawn(shell, ["-lc", command], {
        cwd,
        env: process.env
      });
      let stdout = "";
      let stderr = "";
      let settled = false;

      const timeout = setTimeout(() => {
        child.kill("SIGTERM");
        if (!settled) {
          settled = true;
          reject(new ToolError(`Command timed out after ${timeoutMs}ms: ${command}`));
        }
      }, timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      child.on("error", (error) => {
        clearTimeout(timeout);
        if (!settled) {
          settled = true;
          reject(new ToolError(`Failed to start command: ${String(error)}`));
        }
      });
      child.on("close", (code) => {
        clearTimeout(timeout);
        if (!settled) {
          settled = true;
          resolve({
            command,
            cwd,
            exitCode: code ?? 0,
            stdout,
            stderr
          });
        }
      });
    });
  }
}
