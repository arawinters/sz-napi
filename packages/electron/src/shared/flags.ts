/**
 * Convert a flag value to bigint for the SDK.
 * Structured clone handles bigint natively across both worker_threads and Electron IPC,
 * so this is just a convenience for callers that pass numbers.
 */
export function toBigIntFlag(value: bigint | number | undefined | null): bigint | undefined {
  if (value === undefined || value === null) return undefined;
  return typeof value === "number" ? BigInt(value) : value;
}
