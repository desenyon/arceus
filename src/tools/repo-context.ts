import { readFile } from "node:fs/promises";
import path from "node:path";

import type { ArceusConfig, RepoContext } from "../core/types.js";
import { GitTool } from "./git-tool.js";
import { SearchTool } from "./search-tool.js";

const MAX_FILE_SIZE_BYTES = 32_000;
const MAX_FILES_TO_READ = 20;

export class RepoContextTool {
  public constructor(
    private readonly searchTool: SearchTool,
    private readonly gitTool: GitTool,
    private readonly config: ArceusConfig
  ) {}

  public async collect(cwd: string): Promise<RepoContext> {
    const [files, gitStatus] = await Promise.all([
      this.searchTool.listFiles(cwd, this.config.tools.maxSearchResults),
      this.gitTool.getStatus(cwd, this.config.tools.shell, this.config.tools.commandTimeoutMs)
    ]);

    let recentDiff: string | undefined;

    if (gitStatus.isRepo) {
      recentDiff = await this.gitTool.diff(cwd, this.config.tools.shell, this.config.tools.commandTimeoutMs);
    }

    const fileContents = await this.readSourceFiles(cwd, files);

    const context: RepoContext = {
      cwd,
      files,
      gitStatus: gitStatus.raw,
      fileContents
    };

    if (recentDiff) {
      context.recentDiff = recentDiff;
    }

    return context;
  }

  private async readSourceFiles(cwd: string, files: string[]): Promise<Record<string, string>> {
    const sourceFiles = files
      .filter((f) => isReadableSource(f))
      .slice(0, MAX_FILES_TO_READ);

    const entries = await Promise.all(
      sourceFiles.map(async (file): Promise<[string, string] | undefined> => {
        try {
          const absPath = path.join(cwd, file);
          const content = await readFile(absPath, "utf8");

          if (content.length > MAX_FILE_SIZE_BYTES || content.includes("\0")) {
            return undefined;
          }

          return [file, content];
        } catch {
          return undefined;
        }
      })
    );

    return Object.fromEntries(entries.filter((e): e is [string, string] => e !== undefined));
  }
}

function isReadableSource(file: string): boolean {
  return /\.(ts|tsx|js|jsx|mjs|cjs|json|md|yaml|yml|toml|sh|py|go|rs|rb|java|c|cpp|h|hpp|css|html|sql)$/i.test(file);
}
