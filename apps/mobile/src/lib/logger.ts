import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';

const LOGGING_ENABLED_KEY = 'avato_app_logging_enabled_v1';
const LOG_ENTRIES_KEY = 'avato_app_logs_v1';
const MAX_LOG_ENTRIES = 400;
const PERSIST_DELAY_MS = 400;

export type AppLogLevel = 'error' | 'fatal' | 'log' | 'unhandled' | 'warn';

export interface AppLogEntry {
  id: string;
  level: AppLogLevel;
  message: string;
  timestamp: string;
}

let loggerEnabled = false;
let loggerInitialized = false;
let consolePatched = false;
let unhandledRejectionPatched = false;
let globalHandlerPatched = false;
let logEntries: AppLogEntry[] = [];
let persistTimer: ReturnType<typeof setTimeout> | null = null;

const LOG_METHOD = 'log';
const nativeConsole = globalThis.console;

const originalConsole = {
  error: nativeConsole.error.bind(nativeConsole),
  log: nativeConsole[LOG_METHOD].bind(nativeConsole),
  warn: nativeConsole.warn.bind(nativeConsole),
};

const stringifyValue = (value: unknown): string => {
  if (value instanceof Error) {
    return [value.name, value.message, value.stack].filter(Boolean).join(': ');
  }

  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const buildMessage = (args: unknown[]) => args.map(stringifyValue).join(' ');

const describeValueForDebug = (value: unknown) => {
  if (value instanceof Error) {
    return {
      keys: Object.getOwnPropertyNames(value),
      message: value.message,
      name: value.name,
      stack: value.stack,
      type: value.constructor?.name ?? 'Error',
    };
  }

  if (typeof value !== 'object' || value === null) {
    return { type: typeof value, value };
  }

  const record = value as Record<string, unknown>;

  return {
    componentStack:
      typeof record.componentStack === 'string' ? record.componentStack : undefined,
    keys: Object.getOwnPropertyNames(value),
    message: typeof record.message === 'string' ? record.message : undefined,
    name: typeof record.name === 'string' ? record.name : undefined,
    stack: typeof record.stack === 'string' ? record.stack : undefined,
    type: value.constructor?.name ?? 'Object',
  };
};

const getErrorText = (value: unknown): string => {
  if (!value) return '';

  if (typeof value === 'string') return value;

  if (value instanceof Error) {
    return [value.message, value.stack].filter(Boolean).join(' ');
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const parts: string[] = [];

    if (typeof record.message === 'string') parts.push(record.message);
    if (typeof record.reason === 'string') parts.push(record.reason);
    if (typeof record.error === 'string') parts.push(record.error);
    if (typeof record.description === 'string') parts.push(record.description);

    if (record.cause) parts.push(getErrorText(record.cause));

    if (parts.length > 0) return parts.join(' ');
  }

  return stringifyValue(value);
};

const isKeepAwakeActivityError = (value: unknown): boolean => {
  const message = getErrorText(value).toLowerCase();
  return (
    (message.includes('expokeepawake') || message.includes('keepawake')) &&
    message.includes('activate') &&
    message.includes('activity is no longer available')
  );
};

const shouldIgnoreConsoleMessage = (args: unknown[]): boolean => {
  const message = buildMessage(args);

  return (
    message.includes('Running "main" with') ||
    message.includes('SafeAreaView has been deprecated and will be removed in a future release') ||
    message.includes('[RNScreens]: backTitleFontFamily prop is not available on Android') ||
    message.includes('[RNScreens]: disableBackButtonMenu prop is not available on Android') ||
    message.includes('[RNScreens]: backTitleVisible prop is not available on Android') ||
    isKeepAwakeActivityError(message)
  );
};

const schedulePersist = () => {
  if (persistTimer) clearTimeout(persistTimer);

  persistTimer = setTimeout(() => {
    persistTimer = null;
    void AsyncStorage.setItem(LOG_ENTRIES_KEY, JSON.stringify(logEntries)).catch(() => {});
  }, PERSIST_DELAY_MS);
};

const appendLogEntry = async (level: AppLogLevel, args: unknown[]) => {
  if (!loggerEnabled) return;

  const message = buildMessage(args).trim();
  if (!message) return;

  logEntries = [
    ...logEntries,
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      level,
      message,
      timestamp: new Date().toISOString(),
    },
  ].slice(-MAX_LOG_ENTRIES);

  schedulePersist();
};

const patchConsole = () => {
  if (consolePatched) return;
  consolePatched = true;

  nativeConsole[LOG_METHOD] = (...args: unknown[]) => {
    if (shouldIgnoreConsoleMessage(args)) return;
    originalConsole.log(...args);
    void appendLogEntry('log', args);
  };

  console.warn = (...args: unknown[]) => {
    if (shouldIgnoreConsoleMessage(args)) return;
    originalConsole.warn(...args);
    void appendLogEntry('warn', args);
  };

  console.error = (...args: unknown[]) => {
    if (shouldIgnoreConsoleMessage(args)) return;
    const message = buildMessage(args);
    if (message.includes('Cannot update a component')) {
      originalConsole.error(
        '[[render-phase-debug]]',
        JSON.stringify(args.map(describeValueForDebug), null, 2),
      );
    }
    originalConsole.error(...args);
    void appendLogEntry('error', args);
  };
};

const patchUnhandledRejection = () => {
  if (unhandledRejectionPatched) return;
  unhandledRejectionPatched = true;

  const globalScope = globalThis as typeof globalThis & {
    onunhandledrejection?: ((event: any) => void) | null;
  };
  const previousHandler = globalScope.onunhandledrejection;

  globalScope.onunhandledrejection = (event: any) => {
    const reason = event?.reason ?? event;

    if (isKeepAwakeActivityError(reason)) {
      event?.preventDefault?.();
      void appendLogEntry('warn', ['[ignored] keep-awake activity unavailable', reason]);
      return;
    }

    void appendLogEntry('unhandled', [reason]);
    previousHandler?.(event);
  };
};

const patchGlobalErrorHandler = () => {
  if (globalHandlerPatched) return;
  globalHandlerPatched = true;

  const errorUtils = (globalThis as any).ErrorUtils;
  if (!errorUtils?.setGlobalHandler) return;

  const previousHandler =
    errorUtils.getGlobalHandler?.() ||
    errorUtils._globalHandler ||
    ((error: Error, isFatal?: boolean) => {
      originalConsole.error(error, isFatal);
    });

  errorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    if (isKeepAwakeActivityError(error)) {
      void appendLogEntry('warn', ['[ignored] keep-awake global error', error]);
      return;
    }

    void appendLogEntry(isFatal ? 'fatal' : 'error', [error]);
    previousHandler(error, isFatal);
  });
};

export const initAppLogger = async () => {
  if (loggerInitialized) return;
  loggerInitialized = true;

  try {
    const [enabledRaw, logsRaw] = await Promise.all([
      AsyncStorage.getItem(LOGGING_ENABLED_KEY),
      AsyncStorage.getItem(LOG_ENTRIES_KEY),
    ]);

    loggerEnabled = enabledRaw === 'true';

    if (logsRaw) {
      const parsed = JSON.parse(logsRaw) as AppLogEntry[];
      if (Array.isArray(parsed)) {
        logEntries = parsed.slice(-MAX_LOG_ENTRIES);
      }
    }
  } catch {
    loggerEnabled = false;
    logEntries = [];
  }

  patchConsole();
  patchUnhandledRejection();
  patchGlobalErrorHandler();
};

export const getAppLoggingEnabled = () => loggerEnabled;

export const setAppLoggingEnabled = async (enabled: boolean) => {
  loggerEnabled = enabled;
  await AsyncStorage.setItem(LOGGING_ENABLED_KEY, enabled ? 'true' : 'false');

  if (enabled) {
    await appendLogEntry('log', ['[AppLogger] logging enabled']);
  }
};

export const getAppLogs = async () => {
  if (!loggerInitialized) {
    await initAppLogger();
  }

  return [...logEntries].reverse();
};

export const clearAppLogs = async () => {
  logEntries = [];
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  await AsyncStorage.removeItem(LOG_ENTRIES_KEY);
};

export const formatAppLogs = (entries: AppLogEntry[]) =>
  entries
    .map((entry) => `[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.message}`)
    .join('\n');

export const logComponentError = async (error: Error, componentStack?: string) => {
  await appendLogEntry('fatal', [error, componentStack]);
};

export class AppErrorBoundary extends React.Component<
  {
    children: React.ReactNode;
    fallback: React.ReactNode;
  },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    void logComponentError(error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}
