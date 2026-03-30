import type { ChangeOperation, ChangeSet } from "../core/types.js";

function computeDiffLines(beforeText: string, afterText: string): string[] {
  const before = beforeText.split("\n");
  const after = afterText.split("\n");
  const dp: number[][] = Array.from({ length: before.length + 1 }, () => Array<number>(after.length + 1).fill(0));

  for (let beforeIndex = before.length - 1; beforeIndex >= 0; beforeIndex -= 1) {
    for (let afterIndex = after.length - 1; afterIndex >= 0; afterIndex -= 1) {
      const row = dp[beforeIndex];
      if (before[beforeIndex] === after[afterIndex]) {
        const next = dp[beforeIndex + 1]?.[afterIndex + 1] ?? 0;
        if (row) {
          row[afterIndex] = next + 1;
        }
      } else {
        const down = dp[beforeIndex + 1]?.[afterIndex] ?? 0;
        const right = row?.[afterIndex + 1] ?? 0;
        if (row) {
          row[afterIndex] = Math.max(down, right);
        }
      }
    }
  }

  const lines: string[] = [];
  let beforeIndex = 0;
  let afterIndex = 0;

  while (beforeIndex < before.length && afterIndex < after.length) {
    if (before[beforeIndex] === after[afterIndex]) {
      lines.push(` ${before[beforeIndex]}`);
      beforeIndex += 1;
      afterIndex += 1;
      continue;
    }

    const down = dp[beforeIndex + 1]?.[afterIndex] ?? 0;
    const right = dp[beforeIndex]?.[afterIndex + 1] ?? 0;

    if (down >= right) {
      lines.push(`-${before[beforeIndex]}`);
      beforeIndex += 1;
    } else {
      lines.push(`+${after[afterIndex]}`);
      afterIndex += 1;
    }
  }

  while (beforeIndex < before.length) {
    lines.push(`-${before[beforeIndex]}`);
    beforeIndex += 1;
  }

  while (afterIndex < after.length) {
    lines.push(`+${after[afterIndex]}`);
    afterIndex += 1;
  }

  return lines;
}

function renderOperation(operation: ChangeOperation): string {
  if (operation.type === "delete") {
    return [
      `--- a/${operation.path}`,
      `+++ /dev/null`,
      ...computeDiffLines(operation.before ?? "", "")
    ].join("\n");
  }

  if (operation.type === "create") {
    return [
      `--- /dev/null`,
      `+++ b/${operation.path}`,
      ...computeDiffLines("", operation.after ?? "")
    ].join("\n");
  }

  if (operation.type === "rename") {
    return [
      `rename from ${operation.fromPath ?? operation.path}`,
      `rename to ${operation.path}`,
      ...computeDiffLines(operation.before ?? "", operation.after ?? "")
    ].join("\n");
  }

  return [
    `--- a/${operation.path}`,
    `+++ b/${operation.path}`,
    ...computeDiffLines(operation.before ?? "", operation.after ?? "")
  ].join("\n");
}

export class DiffTool {
  public renderChangeSet(changeSet: ChangeSet): string {
    return changeSet.operations
      .map((operation) => `# ${operation.type.toUpperCase()} ${operation.path}\n${renderOperation(operation)}`)
      .join("\n\n");
  }
}
