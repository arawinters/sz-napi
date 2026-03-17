import {
  SzError,
  SzBadInputError,
  SzNotFoundError,
  SzUnknownDataSourceError,
  SzConfigurationError,
  SzRetryableError,
  SzDatabaseConnectionLostError,
  SzDatabaseTransientError,
  SzRetryTimeoutExceededError,
  SzUnrecoverableError,
  SzDatabaseError,
  SzLicenseError,
  SzNotInitializedError,
  SzUnhandledError,
  SzReplaceConflictError,
  SzEnvironmentDestroyedError,
} from "@senzing/sdk";
import type { SerializedSzError } from "./protocol";

const CLASS_MAP: Record<string, new (msg: string, opts?: any) => SzError> = {
  SzBadInputError,
  SzNotFoundError,
  SzUnknownDataSourceError,
  SzConfigurationError,
  SzRetryableError,
  SzDatabaseConnectionLostError,
  SzDatabaseTransientError,
  SzRetryTimeoutExceededError,
  SzUnrecoverableError,
  SzDatabaseError,
  SzLicenseError,
  SzNotInitializedError,
  SzUnhandledError,
  SzReplaceConflictError,
  SzEnvironmentDestroyedError,
};

export function serializeSzError(err: SzError): SerializedSzError {
  return {
    className: err.constructor.name,
    message: err.message,
    szCode: (err as any).szCode ?? "",
    code: (err as any).code,
    component: (err as any).component,
    category: (err as any).category ?? "",
    severity: (err as any).severity ?? "",
    stack: err.stack,
  };
}

export function deserializeSzError(data: SerializedSzError): SzError {
  const Ctor = CLASS_MAP[data.className] || SzError;
  const err = new Ctor(data.message, {
    szCode: data.szCode,
    code: data.code,
    component: data.component,
    category: data.category,
    severity: data.severity,
  });
  if (data.stack) err.stack = data.stack;
  return err;
}
