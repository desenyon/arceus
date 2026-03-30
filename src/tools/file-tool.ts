import path from "node:path";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";

import type { ChangeOperation, ChangeSet, FileValidationIssue } from "../core/types.js";

async function readIfExists(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

function isDestructive(operation: ChangeOperation): boolean {
  return operation.type === "delete" || operation.type === "rename";
}

export class FileTool {
  public async readFile(cwd: string, targetPath: string): Promise<string | undefined> {
    return readIfExists(path.join(cwd, targetPath));
  }

  public async validateChangeSet(cwd: string, changeSet: ChangeSet): Promise<FileValidationIssue[]> {
    const issues: FileValidationIssue[] = [];

    for (const operation of changeSet.operations) {
      const absolutePath = path.join(cwd, operation.path);
      const current = await readIfExists(absolutePath);

      if (operation.type === "create" && current !== undefined) {
        issues.push({
          level: "warning",
          path: operation.path,
          message: "Create operation targets a file that already exists."
        });
      }

      if ((operation.type === "update" || operation.type === "delete" || operation.type === "rename") && current === undefined) {
        issues.push({
          level: "error",
          path: operation.path,
          message: "Operation expects an existing file, but none was found."
        });
      }

      if (
        current !== undefined &&
        operation.before !== undefined &&
        (operation.type === "update" || operation.type === "delete" || operation.type === "rename") &&
        current !== operation.before
      ) {
        issues.push({
          level: "warning",
          path: operation.path,
          message: "File contents changed since the change set was generated."
        });
      }
    }

    return issues;
  }

  public async applyChangeSet(cwd: string, changeSet: ChangeSet): Promise<string[]> {
    const touched: string[] = [];

    for (const operation of changeSet.operations) {
      const absolutePath = path.join(cwd, operation.path);

      if (operation.type === "create" || operation.type === "update") {
        await mkdir(path.dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, operation.after ?? "", "utf8");
        touched.push(operation.path);
        continue;
      }

      if (operation.type === "delete") {
        await rm(absolutePath);
        touched.push(operation.path);
        continue;
      }

      if (operation.type === "rename") {
        const fromPath = path.join(cwd, operation.fromPath ?? "");
        await mkdir(path.dirname(absolutePath), { recursive: true });
        await rename(fromPath, absolutePath);
        if (operation.after !== undefined) {
          await writeFile(absolutePath, operation.after, "utf8");
        }
        touched.push(operation.fromPath ?? operation.path, operation.path);
      }
    }

    return touched;
  }

  public hasDestructiveOperations(changeSet: ChangeSet): boolean {
    return changeSet.operations.some(isDestructive);
  }
}
