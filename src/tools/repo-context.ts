import type { ArceusConfig, RepoContext } from "../core/types.js";
import { GitTool } from "./git-tool.js";
import { SearchTool } from "./search-tool.js";

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

    const context: RepoContext = {
      cwd,
      files,
      gitStatus: gitStatus.raw
    };

    if (recentDiff) {
      context.recentDiff = recentDiff;
    }

    return context;
  }
}
