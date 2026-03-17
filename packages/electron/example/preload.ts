/**
 * Example preload — self-contained, no external imports from src/.
 * In a real app you'd use a bundler (webpack/esbuild) to bundle
 * '@senzing/electron/preload' into a single file.
 */
import { contextBridge, ipcRenderer } from "electron";

const METHOD_REGISTRY = [
  // Lifecycle
  { service: "lifecycle", method: "initialize", channel: "sz:lifecycle:initialize" },
  { service: "lifecycle", method: "destroy", channel: "sz:lifecycle:destroy" },
  { service: "lifecycle", method: "reinitialize", channel: "sz:lifecycle:reinitialize" },
  { service: "lifecycle", method: "getActiveConfigId", channel: "sz:lifecycle:getActiveConfigId" },
  // Product
  { service: "product", method: "getLicense", channel: "sz:product:getLicense" },
  { service: "product", method: "getVersion", channel: "sz:product:getVersion" },
  // Engine
  { service: "engine", method: "primeEngine", channel: "sz:engine:primeEngine" },
  { service: "engine", method: "getStats", channel: "sz:engine:getStats" },
  { service: "engine", method: "addRecord", channel: "sz:engine:addRecord" },
  { service: "engine", method: "deleteRecord", channel: "sz:engine:deleteRecord" },
  { service: "engine", method: "reevaluateRecord", channel: "sz:engine:reevaluateRecord" },
  { service: "engine", method: "reevaluateEntity", channel: "sz:engine:reevaluateEntity" },
  { service: "engine", method: "getRecord", channel: "sz:engine:getRecord" },
  { service: "engine", method: "getRecordPreview", channel: "sz:engine:getRecordPreview" },
  { service: "engine", method: "getEntityById", channel: "sz:engine:getEntityById" },
  { service: "engine", method: "getEntityByRecord", channel: "sz:engine:getEntityByRecord" },
  { service: "engine", method: "searchByAttributes", channel: "sz:engine:searchByAttributes" },
  { service: "engine", method: "whySearch", channel: "sz:engine:whySearch" },
  { service: "engine", method: "whyEntities", channel: "sz:engine:whyEntities" },
  { service: "engine", method: "whyRecords", channel: "sz:engine:whyRecords" },
  { service: "engine", method: "whyRecordInEntity", channel: "sz:engine:whyRecordInEntity" },
  { service: "engine", method: "howEntity", channel: "sz:engine:howEntity" },
  { service: "engine", method: "getVirtualEntity", channel: "sz:engine:getVirtualEntity" },
  { service: "engine", method: "findInterestingEntitiesById", channel: "sz:engine:findInterestingEntitiesById" },
  { service: "engine", method: "findInterestingEntitiesByRecord", channel: "sz:engine:findInterestingEntitiesByRecord" },
  { service: "engine", method: "findPath", channel: "sz:engine:findPath" },
  { service: "engine", method: "findNetwork", channel: "sz:engine:findNetwork" },
  { service: "engine", method: "getRedoRecord", channel: "sz:engine:getRedoRecord" },
  { service: "engine", method: "countRedoRecords", channel: "sz:engine:countRedoRecords" },
  { service: "engine", method: "processRedoRecord", channel: "sz:engine:processRedoRecord" },
  { service: "engine", method: "exportJsonEntityReport", channel: "sz:engine:exportJsonEntityReport" },
  { service: "engine", method: "exportCsvEntityReport", channel: "sz:engine:exportCsvEntityReport" },
  // ConfigManager
  { service: "configManager", method: "createConfig", channel: "sz:configManager:createConfig" },
  { service: "configManager", method: "createConfigFromId", channel: "sz:configManager:createConfigFromId" },
  { service: "configManager", method: "createConfigFromDefinition", channel: "sz:configManager:createConfigFromDefinition" },
  { service: "configManager", method: "getConfigRegistry", channel: "sz:configManager:getConfigRegistry" },
  { service: "configManager", method: "getDefaultConfigId", channel: "sz:configManager:getDefaultConfigId" },
  { service: "configManager", method: "registerConfig", channel: "sz:configManager:registerConfig" },
  { service: "configManager", method: "replaceDefaultConfigId", channel: "sz:configManager:replaceDefaultConfigId" },
  { service: "configManager", method: "setDefaultConfig", channel: "sz:configManager:setDefaultConfig" },
  { service: "configManager", method: "setDefaultConfigId", channel: "sz:configManager:setDefaultConfigId" },
  // Diagnostic
  { service: "diagnostic", method: "checkRepositoryPerformance", channel: "sz:diagnostic:checkRepositoryPerformance" },
  { service: "diagnostic", method: "getFeature", channel: "sz:diagnostic:getFeature" },
  { service: "diagnostic", method: "getRepositoryInfo", channel: "sz:diagnostic:getRepositoryInfo" },
  { service: "diagnostic", method: "purgeRepository", channel: "sz:diagnostic:purgeRepository" },
];

function makeMethod(channel: string) {
  return async (...args: unknown[]) => {
    const envelope: any = await ipcRenderer.invoke(channel, ...args);
    if (envelope.__szError) {
      const err = new Error(envelope.message);
      err.name = envelope.className;
      (err as any).szCode = envelope.szCode;
      (err as any).category = envelope.category;
      throw err;
    }
    return envelope.result;
  };
}

const api: Record<string, any> = { flags: {} };

for (const def of METHOD_REGISTRY) {
  if (!api[def.service]) api[def.service] = {};
  api[def.service][def.method] = makeMethod(def.channel);
}

api.initialize = api.lifecycle.initialize;
api.destroy = api.lifecycle.destroy;

// Load flags from main process
try {
  const flagEntries: Record<string, string> = ipcRenderer.sendSync("sz:meta:getFlagsSync");
  for (const [name, val] of Object.entries(flagEntries)) {
    api.flags[name] = BigInt(val);
  }
  Object.freeze(api.flags);
} catch {}

contextBridge.exposeInMainWorld("senzing", api);
