/**
 * Preload script — exposes the Senzing SDK as `window.senzing`.
 *
 * Usage: import '@senzing/electron/preload' in your Electron preload script.
 */
import { contextBridge, ipcRenderer } from "electron";
import { METHOD_REGISTRY } from "../shared/channels";
import type { IpcEnvelope, SerializedSzError } from "../shared/protocol";

function makeMethod(channel: string) {
  return async (...args: unknown[]) => {
    const envelope: IpcEnvelope = await ipcRenderer.invoke(channel, ...args);
    if (envelope.__szError) {
      // Reconstruct error in renderer context (no native SDK dependency)
      const data = envelope as unknown as SerializedSzError & { __szError: true };
      const err = new Error(data.message);
      err.name = data.className;
      (err as any).szCode = data.szCode;
      (err as any).category = data.category;
      (err as any).severity = data.severity;
      throw err;
    }
    return envelope.result;
  };
}

// Fetch flags from the worker via a special IPC channel
const flagsPromise = ipcRenderer.invoke("sz:meta:getFlags");

// Build the API object from the method registry
const api: Record<string, any> = {
  flags: {}, // populated async below
};

for (const def of METHOD_REGISTRY) {
  if (!api[def.service]) api[def.service] = {};
  api[def.service][def.method] = makeMethod(def.channel);
}

// Hoist lifecycle methods to top level for convenience
api.initialize = api.lifecycle.initialize;
api.destroy = api.lifecycle.destroy;

// Load flags synchronously from the main process before exposing the API.
// We use ipcRenderer.sendSync for this one-time bootstrap since contextBridge
// runs before any renderer code and we need flags available immediately.
try {
  const flagEntries: Record<string, string> = ipcRenderer.sendSync("sz:meta:getFlagsSync");
  for (const [name, val] of Object.entries(flagEntries)) {
    api.flags[name] = BigInt(val);
  }
  Object.freeze(api.flags);
} catch {
  // Flags will be empty if main process handler not ready yet
}

contextBridge.exposeInMainWorld("senzing", api);
