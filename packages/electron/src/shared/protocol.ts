/** Request from main process to worker thread. */
export interface WorkerRequest {
  id: string;
  service: "lifecycle" | "engine" | "product" | "configManager" | "diagnostic";
  method: string;
  args: unknown[];
}

/** Response from worker thread to main process. */
export interface WorkerResponse {
  id: string;
  success: boolean;
  result?: unknown;
  error?: SerializedSzError;
}

/** Serialized error info that survives structured clone across IPC boundaries. */
export interface SerializedSzError {
  className: string;
  message: string;
  szCode: string;
  code?: number;
  component?: string;
  category: string;
  severity: string;
  stack?: string;
}

/** Envelope returned by ipcMain.handle — preserves typed error info. */
export type IpcEnvelope =
  | { __szError: false; result: unknown }
  | ({ __szError: true } & SerializedSzError);
