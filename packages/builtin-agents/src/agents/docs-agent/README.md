# Docs Agent - Architecture & Workflow

This document explains how Docs Agent tracks the active doc, injects doc context, and edits document content.

## Overview

Docs Agent is a specialized AI agent for creating, reading, updating, and refining docs inside the doc editor. It receives the current doc structure through context injection and can operate on that structure with `lobe-docs-agent`.

## Architecture Components

### 1. Docs Agent Definition

- Model: Claude Sonnet 4.5
- Plugin: `lobe-docs-agent`
- Role: document editing assistant

### 2. Doc Tool Runtime

- Identifier: `lobe-docs-agent`
- Type: built-in tool runtime
- Core APIs:
  - `initDoc`
  - `editTitle`
  - `getDocContent`
  - `modifyNodes`
  - `replaceText`

### 3. Context Injection

- Provider: `DocEditorContextInjector`
- Supporting provider: `DocSelectionsInjector`
- Purpose: inject current doc state and explicit user-selected doc snippets into the conversation pipeline

## Data Flow

1. The user edits a doc in the doc editor.
2. The active doc state is mirrored into chat/runtime state.
3. Chat service resolves the active doc and builds doc editor context.
4. `DocEditorContextInjector` converts editor state into XML + markdown context.
5. `DocSelectionsInjector` injects explicit selected snippets attached to the user message.
6. The model receives the current doc context and can call doc tools against node IDs from that context.

## Injected Context Shape

Docs Agent receives the current doc in this shape:

```xml
<current_doc title="My Document">
  <markdown chars="123" lines="8">
    # Heading

    Paragraph content
  </markdown>
  <doc_xml_structure>
    <instruction>IMPORTANT: Use node IDs from this XML structure when performing modify or remove operations with modifyNodes.</instruction>
    <root>
      <h1 id="node_1">
        <span id="node_2">Heading</span>
      </h1>
      <p id="node_3">
        <span id="node_4">Paragraph content</span>
      </p>
    </root>
  </doc_xml_structure>
</current_doc>
```

Selected snippets attached to a user message are injected separately as user-scoped doc selections.

## Runtime Notes

- `DocEditorContextInjector` injects the latest doc shell once per turn.
- `DocSelectionsInjector` injects message-level selected snippets when the user invokes Ask AI on a highlighted range.
- `ReadyDocsAgentRuntime` can serve fallback doc context before the editor is fully initialized, which keeps the tool runtime stable during editor mount.

## Supported Doc Operations

- Initialize a full doc from Markdown with `initDoc`
- Rename the current doc with `editTitle`
- Refresh current structure with `getDocContent`
- Insert, modify, or remove nodes with `modifyNodes`
- Replace text globally or by node scope with `replaceText`

## Limitations

- Node IDs are derived from the current editor structure and are not guaranteed to be durable across unrelated reinitialization.
- Full bidirectional editor synchronization still depends on runtime/editor integration details outside the prompt layer.
- Selection injection is scoped to user messages; it is not a persistent doc annotation system.

## Related Files

- Agent definition: `packages/builtin-agents/src/agents/docs-agent/`
- Built-in tool: `packages/builtin-tool-docs-agent/`
- Context providers: `packages/context-engine/src/providers/`
- Chat service: `src/services/chat/`
- Editor runtime bridge: `src/store/tool/slices/builtin/executors/lobe-docs-agent.ts`
