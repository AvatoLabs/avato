/**
 * Shared type definitions for the MinkHub mobile app.
 * These mirror the server-side models (session, message, agent, etc.)
 * without importing any server code.
 */

// ---- Session / Chat ----

export interface ChatSession {
    id: string;
    title: string;
    description?: string;
    avatar?: string;
    /** Agent identifier this session is talking to */
    agentId?: string;
    /** If pinned, the session is always at the top */
    pinned?: boolean;
    /** Group identifier for folder grouping */
    groupId?: string;
    /** ISO timestamp */
    updatedAt: string;
    createdAt: string;
}

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ChatMessage {
    id: string;
    sessionId: string;
    role: MessageRole;
    content: string;
    /** Parent message id (for branching) */
    parentId?: string;
    /** ISO timestamp */
    createdAt: string;
    updatedAt: string;
    /** Model that generated the response */
    model?: string;
    /** Error info if the message failed */
    error?: { type: string; message: string } | null;
}

// ---- Agent ----

export interface Agent {
    id: string;
    title: string;
    description?: string;
    avatar?: string;
    tags?: string[];
    systemRole?: string;
    model?: string;
    /** Provider identifier */
    provider?: string;
}

// ---- Community / Market ----

export interface MarketAgent {
    identifier: string;
    author: string;
    meta: {
        title: string;
        description: string;
        avatar?: string;
        tags?: string[];
        category?: string;
    };
    createAt: string;
    schemaVersion: number;
}

export interface MarketModel {
    id: string;
    displayName: string;
    description?: string;
    providerId: string;
    enabled: boolean;
    type: string;
}

export interface MarketProvider {
    id: string;
    name: string;
    description?: string;
    logo?: string;
    models: MarketModel[];
}

// ---- Topic ----

export interface Topic {
    id: string;
    sessionId: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    favorite?: boolean;
}

// ---- User ----

export interface UserProfile {
    id: string;
    username?: string;
    avatar?: string;
    email?: string;
}
