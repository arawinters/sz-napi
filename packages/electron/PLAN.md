# @senzing/electron — Senzing Desktop SDK

## Context

Goal: make it as simple as possible to build web UIs that talk directly to a Senzing install — no ports, no services, no transport layers. An Electron shell package that exposes the entire `@senzing/sdk` API to renderer processes via `contextBridge`/IPC.

## Developer Experience (end result)

**main.ts** (3 lines of Senzing-specific code):
```typescript
import { SzElectronMain } from '@senzing/electron/main';
const sz = new SzElectronMain();
app.whenReady().then(() => { sz.setup(); /* create window... */ });
```

**preload.ts** (1 line):
```typescript
import '@senzing/electron/preload';
```

**renderer.ts** (just call `window.senzing.*`):
```typescript
await window.senzing.initialize(settingsJson);
const version = await window.senzing.product.getVersion();
await window.senzing.engine.addRecord('TEST', '1', data, window.senzing.flags.WITH_INFO);
```

## Architecture

```
Renderer (web UI)
  ↕ contextBridge + ipcRenderer.invoke / ipcMain.handle (structured clone)
Main process (SzElectronMain)
  ↕ worker_threads postMessage (structured clone)
Worker thread (owns SzEnvironment + all SDK objects)
  → @senzing/sdk native calls
```

All methods are **async** (IPC is inherently async). The worker thread keeps Electron's main thread responsive.

## Project Structure

```
packages/electron/
├── package.json
├── tsconfig.json
├── src/
│   ├── main/
│   │   ├── index.ts          # SzElectronMain: setup()/teardown(), registers IPC handlers, manages worker
│   │   └── worker.ts         # Worker thread: owns SzEnvironment, dispatches SDK calls
│   ├── preload/
│   │   └── index.ts          # contextBridge.exposeInMainWorld('senzing', api)
│   ├── renderer/
│   │   └── types.ts          # declare global { interface Window { senzing: SenzingAPI } }
│   └── shared/
│       ├── channels.ts       # METHOD_REGISTRY: data-driven list of all SDK methods + IPC channel names
│       ├── protocol.ts       # WorkerRequest/WorkerResponse/IpcEnvelope types
│       ├── errors.ts         # serialize/deserialize SzError across IPC boundaries
│       └── flags.ts          # BigInt helper (minimal — structured clone handles bigint natively)
└── example/
    ├── main.ts               # Minimal Electron app
    ├── preload.ts            # import '@senzing/electron/preload'
    ├── index.html            # Simple search UI
    └── renderer.ts           # Uses window.senzing
```

## IPC Protocol

**Channel naming**: `sz:{service}:{method}` (e.g., `sz:engine:addRecord`, `sz:product:getVersion`)

**Renderer ↔ Main**: `ipcRenderer.invoke(channel, ...args)` → returns `IpcEnvelope`
```typescript
type IpcEnvelope =
  | { __szError: false; result: unknown }
  | { __szError: true; className: string; message: string; szCode: string; ... }
```
Errors are returned as values (not thrown) to preserve typed error info across Electron IPC.

**Main ↔ Worker**: `postMessage(WorkerRequest)` → `postMessage(WorkerResponse)`
```typescript
interface WorkerRequest { id: string; service: string; method: string; args: unknown[] }
interface WorkerResponse { id: string; success: boolean; result?: unknown; error?: SerializedSzError }
```
The `id` field (UUID) correlates requests/responses, enabling concurrent calls.

## Method Registry (eliminates boilerplate)

A single `METHOD_REGISTRY` array in `channels.ts` lists every SDK method with its service, method name, and channel. All three layers (main, worker, preload) iterate this registry:
- **Main**: `for (def of REGISTRY) ipcMain.handle(def.channel, ...)`
- **Worker**: dispatch `req.service + req.method` to the correct SDK object
- **Preload**: `for (def of REGISTRY) api[def.service][def.method] = makeMethod(def.channel)`

Adding a new SDK method = adding one line to the registry.

## Key Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Flags type | `bigint` all the way through | Structured clone supports BigInt natively in both worker_threads and Electron IPC. `WITH_INFO` (bit 62) exceeds Number.MAX_SAFE_INTEGER. |
| Streaming exports | Collect in worker, return `string[]` | Simple, works for most cases. Low-level handle API can be added later for very large exports. |
| Error propagation | Envelope pattern (not thrown) | Electron IPC strips custom error classes when thrown. Envelope preserves `className`, `szCode`, `category` etc. Preload reconstructs typed `SzError` subclasses. |
| Worker lifecycle | Lazy — created on first `initialize()` call | Avoids loading native module until settings are provided. |
| Singleton | `SzElectronMain` enforces one worker | `SzEnvironment` is a process-global singleton in Rust. One worker = one environment. |

## Implementation Order

1. `shared/channels.ts`, `shared/protocol.ts`, `shared/errors.ts`, `shared/flags.ts` — pure types/data, no Electron deps
2. `src/main/worker.ts` — generalized from `examples/electron-worker/index.ts`, registry-driven dispatch
3. `src/main/index.ts` — `SzElectronMain` class
4. `src/preload/index.ts` — builds `window.senzing` from registry
5. `src/renderer/types.ts` — TypeScript declarations for renderer autocomplete
6. `example/` — minimal working Electron app
7. Update root `package.json` workspaces to include `packages/electron`

## Verification

1. `npm run build` in `packages/electron` compiles without errors
2. Run example app: `cd example && npx electron .`
3. Example app initializes Senzing with SQLite, adds records, searches, displays results
4. Verify typed errors propagate correctly (search for nonexistent record → `SzNotFoundError` in renderer)
5. Verify BigInt flags work (add record with `WITH_INFO` → get affected entities JSON)
