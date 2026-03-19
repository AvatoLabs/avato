/**
 * Mobile Builtin Tools — types for RN tool render components.
 * Aligned with Web BuiltinRenderProps where possible.
 */

import type React from 'react';

export interface MobileBuiltinRenderProps {
  /** Tool identifier (e.g. 'lobe-gtd') */
  identifier: string;
  /** API name (e.g. 'createTodos') */
  apiName: string;
  /** Result content (string from tool execution) */
  content?: string;
  /** Plugin state (if backend returns it; may be parsed from content) */
  pluginState?: Record<string, unknown>;
  /** Request arguments (JSON string) */
  arguments?: string;
  /** Tool call ID */
  toolCallId?: string;
  /** Error if tool failed */
  error?: unknown;
}

export type MobileBuiltinRender = React.ComponentType<MobileBuiltinRenderProps>;

/** Props for Intervention components (pending tool edit form) */
export interface MobileBuiltinInterventionProps<T = Record<string, unknown>> {
  /** Parsed args from tool.arguments */
  args?: T;
  /** Callback when user edits args (persists before approve) */
  onArgsChange?: (value: T) => void | Promise<void>;
  /** Register callback to run before approve (e.g. save edits) */
  registerBeforeApprove?: (id: string, callback: () => void | Promise<void>) => () => void;
}

export type MobileBuiltinIntervention<T = Record<string, unknown>> = React.ComponentType<
  MobileBuiltinInterventionProps<T>
>;

/** Props for Streaming placeholder (tool executing, no result yet) */
export interface MobileBuiltinStreamingProps {
  /** Parsed args from tool.arguments */
  args?: Record<string, unknown>;
  /** Tool identifier */
  identifier?: string;
  /** API name */
  apiName?: string;
}

export type MobileBuiltinStreaming = React.ComponentType<MobileBuiltinStreamingProps>;
