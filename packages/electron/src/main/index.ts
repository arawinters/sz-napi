/**
 * SzElectronMain — registers IPC handlers and manages the SDK worker thread.
 *
 * Usage in Electron main process:
 *   const sz = new SzElectronMain();
 *   app.whenReady().then(() => { sz.setup(); });
 *   app.on('before-quit', () => sz.teardown());
 */
import { ipcMain } from "electron";
import { Worker } from "node:worker_threads";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { METHOD_REGISTRY } from "../shared/channels";
import type { WorkerRequest, WorkerResponse, IpcEnvelope } from "../shared/protocol";

export interface SzElectronMainOptions {
  /** Path to the compiled worker.js. Defaults to the bundled worker. */
  workerPath?: string;
  /** Extra environment variables to pass to the worker thread (e.g. LD_LIBRARY_PATH). */
  workerEnv?: Record<string, string>;
}

export class SzElectronMain {
  private worker: Worker | null = null;
  private pending = new Map<string, { resolve: (v: IpcEnvelope) => void }>();
  private workerPath: string;
  private workerEnv: Record<string, string>;
  private workerReady: Promise<void> | null = null;

  constructor(options?: SzElectronMainOptions) {
    this.workerPath = options?.workerPath ?? path.join(__dirname, "worker.js");
    this.workerEnv = { ...process.env as Record<string, string>, ...(options?.workerEnv ?? {}) };
  }

  /**
   * Register all IPC handlers. Call once in app.whenReady().
   * Spawns the worker thread lazily on first SDK call.
   */
  setup(): void {
    for (const def of METHOD_REGISTRY) {
      ipcMain.handle(def.channel, async (_event, ...args: unknown[]) => {
        return this.callWorker(def.service, def.method, args);
      });
    }

    // Serve SzFlags to preload script synchronously (runs once at startup).
    // BigInt can't be sent via sendSync, so we serialize as strings.
    ipcMain.on("sz:meta:getFlagsSync", (event) => {
      try {
        const { SzFlags } = require("@senzing/sdk");
        const entries: Record<string, string> = {};
        for (const [key, val] of Object.entries(SzFlags)) {
          if (typeof val === "bigint") {
            entries[key] = val.toString();
          }
        }
        event.returnValue = entries;
      } catch {
        event.returnValue = {};
      }
    });
  }

  /**
   * Remove IPC handlers and terminate the worker.
   */
  async teardown(): Promise<void> {
    for (const def of METHOD_REGISTRY) {
      ipcMain.removeHandler(def.channel);
    }
    if (this.worker) {
      await this.callWorker("lifecycle", "destroy", []);
      await this.worker.terminate();
      this.worker = null;
      this.workerReady = null;
    }
  }

  private ensureWorker(): Promise<void> {
    if (this.workerReady) return this.workerReady;

    this.workerReady = new Promise<void>((resolve, reject) => {
      this.worker = new Worker(this.workerPath, {
        env: this.workerEnv,
      });

      this.worker.on("message", (msg: WorkerResponse) => {
        // Handle the initial ready signal
        if (msg.id === "__ready__") {
          resolve();
          return;
        }
        const pending = this.pending.get(msg.id);
        if (!pending) return;
        this.pending.delete(msg.id);

        if (msg.success) {
          pending.resolve({ __szError: false, result: msg.result });
        } else {
          pending.resolve({ __szError: true, ...msg.error! } as IpcEnvelope);
        }
      });

      this.worker.on("error", (err) => {
        reject(err);
        // Reject all pending calls
        for (const [, p] of this.pending) {
          p.resolve({
            __szError: true,
            className: "SzError",
            message: err.message,
            szCode: "SZ_UNHANDLED",
            category: "Unrecoverable",
            severity: "Critical",
          } as IpcEnvelope);
        }
        this.pending.clear();
      });
    });

    return this.workerReady;
  }

  private async callWorker(
    service: string,
    method: string,
    args: unknown[]
  ): Promise<IpcEnvelope> {
    await this.ensureWorker();

    const id = crypto.randomUUID();
    return new Promise<IpcEnvelope>((resolve) => {
      this.pending.set(id, { resolve });
      this.worker!.postMessage({
        id,
        service,
        method,
        args,
      } as WorkerRequest);
    });
  }
}
