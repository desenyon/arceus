import path from "node:path";
import { watch } from "node:fs";

export interface FileWatchHandle {
  close(): void;
}

export function watchWorkspace(
  cwd: string,
  onChange: (relativePath: string, eventType: "rename" | "update") => void
): FileWatchHandle {
  const watcher = watch(
    cwd,
    {
      recursive: true
    },
    (eventType, filename) => {
      if (!filename) {
        return;
      }

      const normalized = filename.toString();

      if (normalized.startsWith(".arceus") || normalized.startsWith(".git") || normalized.includes("node_modules")) {
        return;
      }

      onChange(path.normalize(normalized), eventType === "rename" ? "rename" : "update");
    }
  );

  return {
    close() {
      watcher.close();
    }
  };
}
