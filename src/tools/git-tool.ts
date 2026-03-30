import { ShellTool } from "./shell-tool.js";

export interface GitStatusSummary {
  isRepo: boolean;
  branch: string;
  raw: string;
}

export class GitTool {
  public constructor(private readonly shellTool: ShellTool) {}

  public async getStatus(cwd: string, shell: string, timeoutMs: number): Promise<GitStatusSummary> {
    const result = await this.shellTool.run(`git -C ${JSON.stringify(cwd)} status --short --branch`, cwd, shell, timeoutMs);

    if (result.exitCode !== 0) {
      return {
        isRepo: false,
        branch: "n/a",
        raw: result.stderr.trim() || result.stdout.trim()
      };
    }

    const branchLine = result.stdout.split("\n").find((line) => line.startsWith("##")) ?? "## detached";

    return {
      isRepo: true,
      branch: branchLine.replace(/^##\s*/, ""),
      raw: result.stdout.trim()
    };
  }

  public async diff(cwd: string, shell: string, timeoutMs: number): Promise<string> {
    const result = await this.shellTool.run(`git -C ${JSON.stringify(cwd)} diff --stat && git -C ${JSON.stringify(cwd)} diff`, cwd, shell, timeoutMs);
    return [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
  }

  public async stageAll(cwd: string, shell: string, timeoutMs: number): Promise<GitStatusSummary> {
    await this.shellTool.run(`git -C ${JSON.stringify(cwd)} add -A`, cwd, shell, timeoutMs);
    return this.getStatus(cwd, shell, timeoutMs);
  }

  public async commit(cwd: string, shell: string, timeoutMs: number, message: string): Promise<GitStatusSummary> {
    await this.shellTool.run(`git -C ${JSON.stringify(cwd)} commit -m ${JSON.stringify(message)}`, cwd, shell, timeoutMs);
    return this.getStatus(cwd, shell, timeoutMs);
  }

  public async currentDiff(cwd: string, shell: string, timeoutMs: number): Promise<string> {
    const result = await this.shellTool.run(`git -C ${JSON.stringify(cwd)} diff --cached || git -C ${JSON.stringify(cwd)} diff`, cwd, shell, timeoutMs);
    return [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
  }

  public async push(cwd: string, shell: string, timeoutMs: number, setUpstream = true): Promise<GitStatusSummary> {
    const upstreamFlag = setUpstream ? "--set-upstream origin HEAD" : "";
    const result = await this.shellTool.run(
      `git -C ${JSON.stringify(cwd)} push ${upstreamFlag}`.trim(),
      cwd,
      shell,
      timeoutMs
    );

    return {
      isRepo: result.exitCode === 0,
      branch: "",
      raw: [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n")
    };
  }

  public async checkoutBranch(
    cwd: string,
    shell: string,
    timeoutMs: number,
    branch: string,
    create = false
  ): Promise<GitStatusSummary> {
    const flag = create ? "-b" : "";
    const result = await this.shellTool.run(
      `git -C ${JSON.stringify(cwd)} checkout ${flag} ${JSON.stringify(branch)}`.trim().replace(/\s+/g, " "),
      cwd,
      shell,
      timeoutMs
    );

    if (result.exitCode !== 0) {
      return {
        isRepo: true,
        branch,
        raw: result.stderr.trim() || result.stdout.trim()
      };
    }

    return this.getStatus(cwd, shell, timeoutMs);
  }

  public async log(cwd: string, shell: string, timeoutMs: number, limit = 10): Promise<string> {
    const result = await this.shellTool.run(
      `git -C ${JSON.stringify(cwd)} log --oneline -${limit}`,
      cwd,
      shell,
      timeoutMs
    );
    return result.stdout.trim();
  }
}
