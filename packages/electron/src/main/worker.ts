/**
 * Worker thread that owns the SzEnvironment and processes SDK calls.
 * Communicates with the main process via postMessage/onmessage.
 */
import { parentPort } from "node:worker_threads";
import { SzEnvironment, SzError, mapToSzError } from "@senzing/sdk";
import { METHOD_REGISTRY } from "../shared/channels";
import { serializeSzError } from "../shared/errors";
import { toBigIntFlag } from "../shared/flags";
import type { WorkerRequest, WorkerResponse } from "../shared/protocol";

if (!parentPort) {
  throw new Error("worker.ts must be run as a worker thread");
}

let env: SzEnvironment | null = null;
const services: Record<string, any> = {};

// Build a set of methods that have a bigint flags parameter (last or near-last arg)
const STREAMING_METHODS = new Set(
  METHOD_REGISTRY.filter((d) => d.streaming).map((d) => d.method)
);

parentPort.on("message", (req: WorkerRequest) => {
  const respond = (resp: Omit<WorkerResponse, "id">) => {
    parentPort!.postMessage({ id: req.id, ...resp } as WorkerResponse);
  };

  try {
    // --- Lifecycle methods (handled specially) ---
    if (req.service === "lifecycle") {
      switch (req.method) {
        case "initialize": {
          const [settings, opts] = req.args as [string, { moduleName?: string; verbose?: boolean }?];
          console.log("[worker] LD_LIBRARY_PATH:", process.env.LD_LIBRARY_PATH);
          console.log("[worker] settings:", settings);
          // Clean up any previous failed init
          if (env) {
            try { env.destroy(); } catch {}
            env = null;
            Object.keys(services).forEach((k) => delete services[k]);
          }
          env = new SzEnvironment(
            opts?.moduleName ?? "sz-electron",
            settings,
            opts?.verbose ?? false
          );
          services.engine = env.getEngine();
          services.product = env.getProduct();
          services.configManager = env.getConfigManager();
          services.diagnostic = env.getDiagnostic();
          respond({ success: true });
          return;
        }
        case "destroy": {
          env?.destroy();
          env = null;
          Object.keys(services).forEach((k) => delete services[k]);
          respond({ success: true });
          return;
        }
        case "reinitialize": {
          const [configId] = req.args as [number];
          env!.reinitialize(configId);
          respond({ success: true, result: undefined });
          return;
        }
        case "getActiveConfigId": {
          const id = env!.getActiveConfigId();
          respond({ success: true, result: id });
          return;
        }
      }
    }

    // --- SDK method dispatch ---
    const target = services[req.service];
    if (!target) {
      throw new Error(`Service "${req.service}" not available. Call initialize() first.`);
    }

    const fn = target[req.method];
    if (typeof fn !== "function") {
      throw new Error(`Unknown method: ${req.service}.${req.method}`);
    }

    // Convert flag args (bigint values passed via structured clone)
    const args = req.args.map((arg) =>
      typeof arg === "bigint" ? toBigIntFlag(arg) : arg
    );

    // Streaming methods: collect SzExportIterator into string[]
    if (STREAMING_METHODS.has(req.method)) {
      const handle = fn.apply(target, args) as number;
      const chunks: string[] = [];
      let chunk: string;
      while ((chunk = target.fetchNext(handle)) !== "") {
        chunks.push(chunk);
      }
      target.closeExport(handle);
      respond({ success: true, result: chunks });
      return;
    }

    const result = fn.apply(target, args);
    respond({ success: true, result });
  } catch (err) {
    const szErr = err instanceof SzError ? err : mapToSzError(err as Error);
    respond({ success: false, error: serializeSzError(szErr) });
  }
});

// Signal ready
parentPort.postMessage({ id: "__ready__", success: true } as WorkerResponse);
