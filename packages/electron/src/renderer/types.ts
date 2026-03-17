/**
 * TypeScript declarations for the `window.senzing` API exposed by the preload script.
 *
 * To use in a renderer project, add to your tsconfig.json:
 *   "types": ["@senzing/electron/renderer"]
 *
 * Or add a reference:
 *   /// <reference types="@senzing/electron/renderer" />
 */

export interface SenzingProductAPI {
  getLicense(): Promise<string>;
  getVersion(): Promise<string>;
}

export interface SenzingEngineAPI {
  primeEngine(): Promise<void>;
  getStats(): Promise<string>;
  addRecord(dataSourceCode: string, recordId: string, recordDefinition: string, flags?: bigint): Promise<string>;
  deleteRecord(dataSourceCode: string, recordId: string, flags?: bigint): Promise<string>;
  reevaluateRecord(dataSourceCode: string, recordId: string, flags?: bigint): Promise<string>;
  reevaluateEntity(entityId: number, flags?: bigint): Promise<string>;
  getRecord(dataSourceCode: string, recordId: string, flags?: bigint): Promise<string>;
  getRecordPreview(recordDefinition: string, flags?: bigint): Promise<string>;
  getEntityById(entityId: number, flags?: bigint): Promise<string>;
  getEntityByRecord(dataSourceCode: string, recordId: string, flags?: bigint): Promise<string>;
  searchByAttributes(attributes: string, searchProfile?: string, flags?: bigint): Promise<string>;
  whySearch(attributes: string, entityId: number, searchProfile?: string, flags?: bigint): Promise<string>;
  whyEntities(entityId1: number, entityId2: number, flags?: bigint): Promise<string>;
  whyRecords(dsCode1: string, recId1: string, dsCode2: string, recId2: string, flags?: bigint): Promise<string>;
  whyRecordInEntity(dataSourceCode: string, recordId: string, flags?: bigint): Promise<string>;
  howEntity(entityId: number, flags?: bigint): Promise<string>;
  getVirtualEntity(recordKeys: Array<{ dataSourceCode: string; recordId: string }>, flags?: bigint): Promise<string>;
  findInterestingEntitiesById(entityId: number, flags?: bigint): Promise<string>;
  findInterestingEntitiesByRecord(dataSourceCode: string, recordId: string, flags?: bigint): Promise<string>;
  findPath(startEntityId: number, endEntityId: number, maxDegrees: number, avoidEntityIds?: number[], requiredDataSources?: string[], flags?: bigint): Promise<string>;
  findNetwork(entityIds: number[], maxDegrees: number, buildOutDegree: number, maxEntities: number, flags?: bigint): Promise<string>;
  getRedoRecord(): Promise<string>;
  countRedoRecords(): Promise<number>;
  processRedoRecord(redoRecord: string, flags?: bigint): Promise<string>;
  exportJsonEntityReport(flags?: bigint): Promise<string[]>;
  exportCsvEntityReport(csvColumnList: string, flags?: bigint): Promise<string[]>;
}

export interface SenzingConfigManagerAPI {
  createConfig(): Promise<string>;
  createConfigFromId(configId: number): Promise<string>;
  createConfigFromDefinition(configDefinition: string): Promise<string>;
  getConfigRegistry(): Promise<string>;
  getDefaultConfigId(): Promise<number>;
  registerConfig(configDefinition: string, configComment?: string): Promise<number>;
  replaceDefaultConfigId(currentDefaultConfigId: number, newDefaultConfigId: number): Promise<void>;
  setDefaultConfig(configDefinition: string, configComment?: string): Promise<number>;
  setDefaultConfigId(configId: number): Promise<void>;
}

export interface SenzingDiagnosticAPI {
  checkRepositoryPerformance(secondsToRun: number): Promise<string>;
  getFeature(featureId: number): Promise<string>;
  getRepositoryInfo(): Promise<string>;
  purgeRepository(): Promise<void>;
}

export interface SenzingLifecycleAPI {
  initialize(settings: string, opts?: { moduleName?: string; verbose?: boolean }): Promise<void>;
  destroy(): Promise<void>;
  reinitialize(configId: number): Promise<void>;
  getActiveConfigId(): Promise<number>;
}

export interface SenzingAPI {
  product: SenzingProductAPI;
  engine: SenzingEngineAPI;
  configManager: SenzingConfigManagerAPI;
  diagnostic: SenzingDiagnosticAPI;
  lifecycle: SenzingLifecycleAPI;
  flags: Readonly<Record<string, bigint>>;
  /** Shortcut for lifecycle.initialize */
  initialize(settings: string, opts?: { moduleName?: string; verbose?: boolean }): Promise<void>;
  /** Shortcut for lifecycle.destroy */
  destroy(): Promise<void>;
}

declare global {
  interface Window {
    senzing: SenzingAPI;
  }
}
