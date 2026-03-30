import path from "node:path";
import { readdir, readFile } from "node:fs/promises";

const DEFAULT_IGNORES = new Set([".arceus", ".git", "dist", "node_modules"]);

export interface ContentMatch {
  file: string;
  line: number;
  text: string;
}

export class SearchTool {
  public async listFiles(cwd: string, limit: number): Promise<string[]> {
    const results: string[] = [];

    await this.walk(cwd, cwd, results, limit);

    return results.sort((left, right) => left.localeCompare(right));
  }

  public async grepFiles(
    cwd: string,
    pattern: string,
    limit: number,
    fileGlob?: string
  ): Promise<ContentMatch[]> {
    let regex: RegExp;

    try {
      regex = new RegExp(pattern, "i");
    } catch {
      regex = new RegExp(pattern.replace(/[$()*+./?[\\\]^{|}]/g, "\\$&"), "i");
    }

    const files = await this.listFiles(cwd, limit * 10);
    const matches: ContentMatch[] = [];

    for (const file of files) {
      if (matches.length >= limit) {
        break;
      }

      if (fileGlob && !minimatch(file, fileGlob)) {
        continue;
      }

      let contents: string;

      try {
        contents = await readFile(path.join(cwd, file), "utf8");
      } catch {
        continue;
      }

      if (contents.includes("\0")) {
        continue;
      }

      const lines = contents.split("\n");

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        if (matches.length >= limit) {
          break;
        }

        const lineText = lines[lineIndex] ?? "";

        if (regex.test(lineText)) {
          matches.push({
            file,
            line: lineIndex + 1,
            text: lineText.trim()
          });
        }
      }
    }

    return matches;
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

function minimatch(file: string, glob: string): boolean {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]");
  return new RegExp(`^${escaped}$`).test(file) || new RegExp(`(^|/)${escaped}$`).test(file);
}
