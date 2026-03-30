import { loadConfig } from "../config/load.js";
import { ModelRouter } from "../agents/router.js";
import { AgentRuntime } from "../agents/runtime.js";
import { ProviderRegistry } from "../providers/index.js";
import { SearchTool } from "../tools/search-tool.js";
import { ShellTool } from "../tools/shell-tool.js";
import { GitTool } from "../tools/git-tool.js";
import { RepoContextTool } from "../tools/repo-context.js";
import { SessionStore } from "../storage/session-store.js";

export async function createAppContext(cwd: string) {
  const configResolution = await loadConfig(cwd);
  const searchTool = new SearchTool();
  const shellTool = new ShellTool();
  const gitTool = new GitTool(shellTool);
  const repoContextTool = new RepoContextTool(searchTool, gitTool, configResolution.config);
  const router = new ModelRouter(configResolution.config);
  const providers = new ProviderRegistry();
  const runtime = new AgentRuntime(configResolution.config, router, providers, repoContextTool);
  const store = new SessionStore(cwd, configResolution.config.live.persistenceDir);

  return {
    configResolution,
    searchTool,
    shellTool,
    gitTool,
    repoContextTool,
    router,
    providers,
    runtime,
    store
  };
}
