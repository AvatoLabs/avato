/**
 * Shared type definitions for the MinkHub mobile app.
 * These mirror the server-side models (session, message, agent, etc.)
 * without importing any server code.
 */

// ---- Session / Chat ----

export interface ChatSession {
  /** Agent identifier this session is talking to */
  agentId?: string;
  avatar?: string;
  createdAt: string;
  description?: string;
  /** Group identifier for folder grouping */
  groupId?: string;
  id: string;
  /** If pinned, the session is always at the top */
  pinned?: boolean;
  title: string;
  /** ISO timestamp */
  updatedAt: string;
}

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ChatMessage {
  content: string;
  /** ISO timestamp */
  createdAt: string;
  /** Error info if the message failed */
  error?: { type: string; message: string } | null;
  id: string;
  /** Model that generated the response */
  model?: string;
  /** Parent message id (for branching) */
  parentId?: string;
  role: MessageRole;
  sessionId: string;
  updatedAt: string;
}

// ---- Agent ----

export interface Agent {
  avatar?: string;
  description?: string;
  id: string;
  model?: string;
  /** Provider identifier */
  provider?: string;
  systemRole?: string;
  tags?: string[];
  title: string;
}

// ---- Community / Market ----

export interface MarketAgent {
  author: string;
  createAt: string;
  identifier: string;
  meta: {
    title: string;
    description: string;
    avatar?: string;
    tags?: string[];
    category?: string;
  };
  schemaVersion: number;
}

export interface MarketModel {
  description?: string;
  displayName: string;
  enabled: boolean;
  id: string;
  providerId: string;
  type: string;
}

export interface MarketProvider {
  description?: string;
  id: string;
  logo?: string;
  models: MarketModel[];
  name: string;
}

// ---- Session Group ----

export interface SessionGroup {
  createdAt: string;
  id: string;
  name: string;
  sort?: number;
  updatedAt: string;
}

// ---- Topic ----

export interface Topic {
  createdAt: string;
  favorite?: boolean;
  id: string;
  sessionId: string;
  title: string;
  updatedAt: string;
}

// ---- File / Attachment ----

export interface FileAttachment {
  id: string;
  name: string;
  /** Upload progress 0-100 */
  progress: number;
  /** File size in bytes */
  size: number;
  /** Upload status */
  status: 'pending' | 'uploading' | 'done' | 'error';
  /** MIME type */
  type: string;
  /** Local URI for preview */
  uri: string;
  /** Remote URL after upload */
  url?: string;
}

// ---- Discover / Market (extended) ----

export interface DiscoverAgent {
  author: string;
  config?: {
    systemRole?: string;
    model?: string;
    provider?: string;
  };
  createAt: string;
  identifier: string;
  meta: {
    title: string;
    description: string;
    avatar?: string;
    tags?: string[];
    category?: string;
  };
  schemaVersion: number;
}

export interface DiscoverModel {
  description?: string;
  displayName: string;
  enabled: boolean;
  functionCall?: boolean;
  id: string;
  providerId: string;
  providerName?: string;
  tokens?: number;
  type: string;
  vision?: boolean;
}

export interface DiscoverProvider {
  description?: string;
  enabled: boolean;
  id: string;
  logo?: string;
  models: DiscoverModel[];
  name: string;
}

// ---- User ----

export interface UserProfile {
  avatar?: string;
  bio?: string;
  email?: string;
  fullName?: string;
  id: string;
  username?: string;
}
