# Mobile Settings Architecture Audit Report

**Date:** 2025-03-18\
**Scope:** Chat settings, group chat settings, and agent settings in `apps/mobile` vs web `src/`

**Updated:** 2025-03-18 — Applied fixes for agent config cache and alignment with web.

---

## 1. Chat Settings

### 1.1 Mobile Implementation

| File                                             | Purpose                                                       |
| ------------------------------------------------ | ------------------------------------------------------------- |
| `apps/mobile/src/screens/ChatSettingsScreen.tsx` | Single screen handling both agent sessions and group sessions |
| `apps/mobile/src/navigation/index.tsx`           | Registers `ChatSettings` route                                |

**Key Logic:**

- **Data source:** `useSessionStore` (sessions, renameSession, updateSessionTag, etc.), `agentApi.getConfigBySession()` for agent summary
- **Load:** Session from store; agent summary via `agentApi.getConfigBySession(sessionId)` in useEffect
- **Save (agent session):** `renameSession(sessionId, title)` for title; `updateSessionTag(sessionId, tagId)` for tag; no direct agent config save (agent config is in separate AgentConfigScreen)
- **Save (group session):** `agentGroupApi.updateGroup(sessionId, {...})` for title, description, config
- **Other:** `sessionTagApi.list()`, `sessionTagApi.create()` for tags; `clearMessages`, `removeSession` for danger zone

**Features:**

- Title + description (group only)
- Tag selector (agent only)
- Agent config entry point → navigates to AgentConfig
- Group settings (allowDM, revealDM, systemPrompt, openingMessage, openingQuestions, members)
- Danger zone (clear history, delete conversation)

### 1.2 Web Implementation

| File                                                   | Purpose                                  |
| ------------------------------------------------------ | ---------------------------------------- |
| `src/routes/(mobile)/chat/settings/index.tsx`          | Chat settings page (mobile web)          |
| `src/routes/(mobile)/chat/settings/_layout/Header.tsx` | Header with back button                  |
| `src/features/AgentSetting/AgentSettings.tsx`          | Reusable agent settings component        |
| `src/features/AgentSetting/AgentSettingsContent.tsx`   | Tab content (Meta, Opening, Chat, Modal) |

**Key Logic:**

- **Data source:** `useSessionStore((s) => s.activeId)` for session ID; `useAgentStore` with `agentSelectors.currentAgentConfig`, `currentAgentMeta`, `currentAgentTitle`
- **Load:** Agent config comes from `agentMap[activeAgentId]` (populated by SWR `useFetchAgentConfig`)
- **Save:** `updateAgentConfig` / `updateAgentMeta` from agent store → `agentService.updateAgentConfig` / `updateAgentMeta` (API)
- **Structure:** Tabs (Prompt/Meta, Opening, Chat, Modal) via `useCategory()`; `AgentSettings` receives config, meta, id and callbacks

**Features:**

- Full agent settings in one page (meta, opening, chat, modal)
- No separate "agent config" screen; all inline
- Footer component for extra actions

---

## 2. Group Chat Settings

### 2.1 Mobile Implementation

| File                                             | Purpose                                          |
| ------------------------------------------------ | ------------------------------------------------ |
| `apps/mobile/src/screens/ChatSettingsScreen.tsx` | Same screen; conditional `isGroupSession` blocks |

**Key Logic:**

- **Data source:** `agentGroupApi.getGroupDetail(sessionId)` → `groupDetail`, `groupDescription`, `groupSystemPrompt`, etc.
- **Load:** `loadGroupDetail()` in useEffect when `isGroupSession`
- **Save:** `agentGroupApi.updateGroup(sessionId, { config, description, title })`
- **Members:** `agentGroupApi.addAgentsToGroup`, `agentGroupApi.removeAgentsFromGroup`
- **Supervisor model:** `agentApi.updateConfig(supervisorAgentId, { model, provider })`

**Features:**

- allowDM, revealDM
- systemPrompt
- openingMessage, openingQuestions
- Members list with add/remove; supervisor model picker

### 2.2 Web Implementation

| File                                                                 | Purpose                                           |
| -------------------------------------------------------------------- | ------------------------------------------------- |
| `src/routes/(main)/group/profile/index.tsx`                          | Group profile page                                |
| `src/routes/(main)/group/profile/features/GroupProfile/index.tsx`    | Group profile content + "Advanced Settings" modal |
| `src/routes/(main)/group/profile/features/AgentSettings/Content.tsx` | Group agent settings (Opening tab only)           |
| `src/store/agentGroup/slices/curd.ts`                                | `updateGroup`, `updateGroupConfig`                |

**Key Logic:**

- **Data source:** `useAgentGroupStore` with `agentGroupSelectors.activeGroupId`, `agentGroupSelectors.currentGroup`
- **Load:** Group from agentGroup store (synced via `refreshGroupDetail`)
- **Save:** `updateGroupConfig` (openingMessage, openingQuestions) or `updateGroup` (meta) → `chatGroupService.updateGroup`
- **Structure:** Group profile has EditorCanvas for content; "Advanced Settings" opens AgentSettings modal with Opening tab only

**Features:**

- Group content (EditorCanvas)
- Group meta (avatar, title, description) via GroupHeader
- Advanced Settings modal: openingMessage, openingQuestions only (no allowDM, revealDM, systemPrompt in this modal)

---

## 3. Agent Settings

### 3.1 Mobile Implementation

| File                                                    | Purpose                              |
| ------------------------------------------------------- | ------------------------------------ |
| `apps/mobile/src/screens/AgentConfigScreen.tsx`         | Full agent config screen             |
| `apps/mobile/src/components/ui/ModelDrawer.tsx`         | Model picker                         |
| `apps/mobile/src/components/ui/AgentSelectionSheet.tsx` | Agent selection (store, add members) |

**Key Logic:**

- **Data source:** `agentApi.getConfigBySession(sessionId)` → `buildDraft(config)`; `useModelStore` for providers
- **Load:** `loadConfig()` in useEffect: `fetchModels()`, `loadSelection(sessionId)`, `agentApi.getConfigBySession(sessionId)`
- **Save:** `agentApi.updateConfig(agentId, {...})` with full config payload
- **Skills:** `pluginApi.list()`, `agentSkillApi.list()`, `userApi.getState()` for builtin/skills/plugins

**Features:**

- Model, skills, meta (title, description, avatar)
- Chat config (searchMode, memory, openingMessage, openingQuestions)
- Advanced (systemRole, autoCreateTopic, historyCount, params)
- Skills modal with builtin/skills/plugins toggles

**Special:** `SessionOnlyAgentConfigScreen` when no sessionId → redirects to Store

### 3.2 Web Implementation

| File                                                                 | Purpose                                                                    |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `src/features/AgentSetting/*`                                        | AgentSettings, AgentMeta, AgentOpening, AgentChat, AgentModal, AgentPlugin |
| `src/store/agent/slices/agent/action.ts`                             | `updateAgentConfig`, `updateAgentMeta`, `optimisticUpdateAgentConfig`      |
| `src/routes/(main)/agent/profile/features/AgentSettings/Content.tsx` | Agent profile settings (desktop)                                           |

**Key Logic:**

- **Data source:** `agentMap[activeAgentId]` from agent store; populated by `useFetchAgentConfig` (SWR)
- **Load:** SWR fetches `agentService.getAgentConfigById(agentId)`; onSuccess dispatches to `agentMap`
- **Save:** `updateAgentConfig` / `updateAgentMeta` → optimistic update + `agentService.updateAgentConfig` / `updateAgentMeta`
- **Structure:** Tabs (Meta, Opening, Chat, Modal); each tab is a feature component

**Features:**

- Same conceptual areas (meta, opening, chat, modal) but split into feature components
- Optimistic updates with rollback on error
- AgentSettings uses local store (AgentSettingsProvider) synced via StoreUpdater

---

## 4. Data Flow Comparison

### 4.1 Web Architecture

```
SessionStore (activeId) ──┐
                          ├──► Chat Settings Page
AgentStore (agentMap,     ──┘     └── AgentSettings (config, meta, onConfigChange, onMetaChange)
  activeAgentId)                        └── AgentSettingsProvider (local store)
                                             └── StoreUpdater (sync props → local store)
                                             └── AgentSettingsContent (tabs)
                                                    └── updateAgentConfig/Meta → agentService (API)
```

- **Store-centric:** Agent config lives in `agentMap`; updates go through store actions that call services
- **Session ID = Agent ID** for agent sessions (session-only agents)
- **SWR** for fetching agent config; optimistic updates for saves

### 4.2 Mobile Architecture

```
SessionStore (sessions) ──► ChatSettingsScreen
                                ├── agentApi.getConfigBySession (agent summary only)
                                ├── sessionTagApi, renameSession, updateSessionTag
                                └── agentGroupApi (when group)
                                        └── getGroupDetail, updateGroup, add/remove members

route.params.sessionId ──► AgentConfigScreen
                                ├── agentApi.getConfigBySession
                                ├── agentApi.updateConfig
                                └── useModelStore, pluginApi, agentSkillApi
```

- **API-centric:** No agent store; direct `agentApi` / `agentGroupApi` calls
- **Local state:** useState for draft; no global agent config cache
- **No optimistic updates:** Save → API → fetchSessions/loadGroupDetail to refresh

---

## 5. Architecture Alignment Issues

### 5.1 Structural Differences

| Aspect                      | Web                                        | Mobile                                          | Issue                                                     |
| --------------------------- | ------------------------------------------ | ----------------------------------------------- | --------------------------------------------------------- |
| **Chat vs Agent settings**  | Single page with tabs                      | ChatSettings (meta) + AgentConfig (full config) | Mobile splits into two screens; web keeps all in one      |
| **Store usage**             | useAgentStore, useAgentGroupStore          | useSessionStore only; no agent/agentGroup store | Mobile lacks centralized agent/agentGroup state           |
| **Config loading**          | SWR + agentMap                             | Direct API in useEffect                         | Mobile refetches on each screen; no shared cache          |
| **Save flow**               | Store action → service → optimistic update | Component → API → manual refresh                | Mobile has no optimistic updates                          |
| **Group settings location** | Group profile page + modal                 | Inline in ChatSettingsScreen                    | Different UX; web group profile has more (content editor) |

### 5.2 Potential Issues

1. **No agent store on mobile**
   - Agent config is not cached; every AgentConfigScreen mount triggers `getConfigBySession`
   - ChatDetailScreen and AgentConfigScreen may both fetch the same config
   - No single source of truth for agent config

2. **Chat settings scope mismatch**
   - Web: Chat settings = full agent settings (meta, opening, chat, modal)
   - Mobile: Chat settings = title, tag, agent entry; agent config in separate screen
   - Mobile ChatSettingsScreen does not expose model, params, or chat config; user must go to AgentConfig

3. **Group settings scope**
   - Web group profile: content editor + advanced settings (opening only)
   - Mobile: allowDM, revealDM, systemPrompt, opening, members, supervisor model
   - Web group AgentSettings modal does not expose allowDM, revealDM, systemPrompt in the same way

4. **Session/agent ID handling**
   - Web: activeAgentId = sessionId for agent sessions; agentMap keyed by agent id
   - Mobile: Uses sessionId to fetch config; backend returns config with `id` (agent id)
   - Both align on sessionId → agentId for session-only agents, but mobile does not maintain agentMap

5. **Tag handling**
   - Web: Session groups, not session tags
   - Mobile: sessionTagApi for tags; web may use different grouping
   - Need to confirm tag vs group semantics across platforms

6. **Save feedback**
   - Web: Optimistic update + save status
   - Mobile: saving spinner, toast on success; no optimistic UI

---

## 6. Recommended Fixes

### 6.1 High Priority

1. **Introduce agent config cache on mobile** ✅ DONE
   - Added `useAgentConfigStore` (`apps/mobile/src/store/agentConfig.ts`) and `useAgentConfig` hook (`apps/mobile/src/hooks/useAgentConfig.ts`)
   - ChatSettingsScreen and AgentConfigScreen now share cached config
   - On save in AgentConfigScreen, `setConfig` updates cache for instant UI sync

2. **Align chat settings scope** ✅ DONE
   - ChatSettingsScreen and AgentConfigScreen share the same data source via `useAgentConfig`
   - Agent summary in ChatSettings comes from cache; no duplicate fetch

3. **Unify group settings**
   - Mobile has allowDM, revealDM, systemPrompt, opening, members, supervisor model — aligns with backend
   - Web group profile: Advanced Settings modal has Opening only; systemPrompt in GroupRole sidebar
   - Both platforms support same backend config; UI layout differs by design

### 6.2 Medium Priority

4. **Optimistic updates**
   - Mobile now updates cache on save (`setConfig`) for immediate UI feedback; full optimistic update with rollback not implemented

5. **Shared API layer**
   - Both use tRPC; mobile `agentApi` and web `agentService` call same procedures

### 6.3 Low Priority

6. **Route structure**
   - Web: `/chat/settings?session=xxx`; Mobile: `ChatSettings` with `sessionId` in params — acceptable

7. **Tag vs group**
   - Session tags (mobile) vs session groups (web) — backend supports both

---

## 8. Post-Fix Web vs Mobile Comparison

| Aspect                           | Web                                              | Mobile (after fix)                                      |
| -------------------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| **Agent config source**          | agentMap (SWR)                                   | agentConfigMap (useAgentConfig)                         |
| **Chat settings + Agent config** | Single page, tabs                                | Split: ChatSettings → AgentConfig                       |
| **Config cache**                 | agentMap                                         | agentConfigStore.configMap                              |
| **Save flow**                    | Store → service → optimistic                     | API → setConfig (cache update)                          |
| **Group settings**               | Profile + GroupRole + Advanced modal             | ChatSettingsScreen (all inline)                         |
| **Group create**                 | createGroup (no supervisor picker in basic flow) | createGroup + supervisorConfig from AgentSelectionSheet |
| **Supervisor model**             | Editable in group sidebar                        | Editable in ChatSettings members section                |

---

## 7. File Reference Summary

### Mobile

| Category       | Files                                                                 |
| -------------- | --------------------------------------------------------------------- |
| Chat settings  | `apps/mobile/src/screens/ChatSettingsScreen.tsx`                      |
| Group settings | Same file (conditional)                                               |
| Agent settings | `apps/mobile/src/screens/AgentConfigScreen.tsx`                       |
| API            | `apps/mobile/src/lib/api.ts` (agentApi, agentGroupApi, sessionTagApi) |
| Store          | `apps/mobile/src/store/session.ts`, `apps/mobile/src/store/chat.ts`   |
| UI             | `AgentSelectionSheet.tsx`, `ModelDrawer.tsx`, `TagEditorSheet.tsx`    |

### Web

| Category       | Files                                                           |
| -------------- | --------------------------------------------------------------- |
| Chat settings  | `src/routes/(mobile)/chat/settings/index.tsx`                   |
| Group settings | `src/routes/(main)/group/profile/`, `AgentSettings/Content.tsx` |
| Agent settings | `src/features/AgentSetting/*`, `src/store/agent/*`              |
| Services       | `src/services/agent`, `src/services/chatGroup`                  |
| Store          | `src/store/agent`, `src/store/agentGroup`, `src/store/session`  |
