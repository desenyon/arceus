import path from "node:path";
import { readdir } from "node:fs/promises";

const DEFAULT_IGNORES = new Set([".arceus", ".git", "dist", "node_modules"]);

export class SearchTool {
  public async listFiles(cwd: string, limit: number): Promise<string[]> {
    const results: string[] = [];

    await this.walk(cwd, cwd, results, limit);

    return results.sort((left, right) => left.localeCompare(right));
  }

  private async walk(root: string, current: string, results: string[], limit: number): Promise<void> {
    if (results.length >= limit) {
      return;
    }

    const entries = await readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      if (results.length >= limit) {
        return;
      }

      if (DEFAULT_IGNORES.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        await this.walk(root, fullPath, results, limit);
      } else {
        results.push(path.relative(root, fullPath));
      }
    }
  }
}
