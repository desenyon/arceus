import path from "node:path";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";

import type { SessionEvent } from "../core/events.js";

export interface SessionDescriptor {
  sessionId: string;
  cwd: string;
  host: string;
  port: number;
  createdAt: string;
}

export class SessionStore {
  public constructor(private readonly cwd: string, private readonly persistenceDir: string) {}

  private get absoluteDir(): string {
    return path.join(this.cwd, this.persistenceDir);
  }

  private descriptorPath(sessionId: string): string {
    return path.join(this.absoluteDir, `${sessionId}.meta.json`);
  }

  private eventLogPath(sessionId: string): string {
    return path.join(this.absoluteDir, `${sessionId}.events.jsonl`);
  }

  public async ensure(): Promise<void> {
    await mkdir(this.absoluteDir, { recursive: true });
  }

  public async writeDescriptor(descriptor: SessionDescriptor): Promise<void> {
    await this.ensure();
    await writeFile(this.descriptorPath(descriptor.sessionId), `${JSON.stringify(descriptor, null, 2)}\n`, "utf8");
  }

  public async readDescriptor(sessionId: string): Promise<SessionDescriptor | undefined> {
    try {
      const contents = await readFile(this.descriptorPath(sessionId), "utf8");
      return JSON.parse(contents) as SessionDescriptor;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return undefined;
      }

      throw error;
    }
  }

  public async appendEvent(event: SessionEvent): Promise<void> {
    await this.ensure();
    const filePath = this.eventLogPath(event.sessionId);
    const line = `${JSON.stringify(event)}\n`;
    let contents = "";

    try {
      contents = await readFile(filePath, "utf8");
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
    }

    await writeFile(filePath, `${contents}${line}`, "utf8");
  }

  public async readEvents(sessionId: string): Promise<SessionEvent[]> {
    try {
      const contents = await readFile(this.eventLogPath(sessionId), "utf8");

      return contents
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as SessionEvent);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return [];
      }

      throw error;
    }
  }

  public async deleteSession(sessionId: string): Promise<void> {
    const metaPath = this.descriptorPath(sessionId);
    const eventsPath = this.eventLogPath(sessionId);

    await Promise.all(
      [metaPath, eventsPath].map((filePath) =>
        unlink(filePath).catch((error) => {
          if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
            throw error;
          }
        })
      )
    );
  }

  public async listSessionIds(): Promise<string[]> {
    try {
      const entries = await readdir(this.absoluteDir);

      return entries
        .filter((entry) => entry.endsWith(".meta.json"))
        .map((entry) => entry.replace(/\.meta\.json$/, ""))
        .sort((left, right) => left.localeCompare(right));
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return [];
      }

      throw error;
    }
  }
}
