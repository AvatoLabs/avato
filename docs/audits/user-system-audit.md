# 用户系统审计

**审计日期**: 2025-03-23

**审计范围**: 用户认证、用户状态同步、设置持久化、个人资料、Onboarding 等用户相关流程。

---

## 1. 架构概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 认证与 AuthProvider                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  SPA (Vite): index.vite.tsx → Desktop (isDesktop) | NoAuth (web)            │
│  Next Auth 页: index.tsx → 仅 children，无 UserUpdater                        │
│  BetterAuth: UserUpdater 同步 session → store (isLoaded, isSignedIn, user)   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ User Store (Zustand)                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  auth: user, isSignedIn, isLoaded, authProviders, hasPasswordAccount         │
│  settings: settings (diffs), defaultSettings                                  │
│  preference, onboarding, common                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 初始化 useInitUserState (SWR)                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  key: GET_USER_STATE_KEY (当 isLogin || isDesktop)                            │
│  fetcher: userService.getUserState()                                          │
│  onSuccess: merge(backend data) → settings, preference, user, isUserStateInit│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 潜在问题

### 2.1 UserUpdater 可能覆盖 useInitUserState 的完整 user ✅ 已修复

**位置**: `src/layout/AuthProvider/BetterAuth/UserUpdater.tsx`

**问题**: 当 `betterAuthUser` 存在时，UserUpdater 创建仅含 `avatar, email, fullName, id, username` 的 `lobeUser`，并直接 `setState({ user: lobeUser })` 做**全量替换**，不会合并现有 user。

**时序**:

- 若 useInitUserState 的 onSuccess 先执行，会把 `firstName`, `interests`, `latestName` 等写入 user
- 随后 UserUpdater 的 useEffect 因 `betterAuthUser` 引用变化而再次执行，会用只含 session 字段的 `lobeUser` 覆盖整个 user，导致 `firstName`、`interests` 等丢失

**修复**: 已改为合并现有 user，保留 firstName、interests 等字段，仅用 session 更新 email、fullName、id、username，avatar 优先使用 store 值。

---

### 2.2 setSettings 失败时乐观更新无法回滚 ✅ 已修复

**位置**: `src/store/user/slices/settings/action.ts` 第 104–108 行

**问题**: 先 `this.#set({ settings: diffs })` 做乐观更新，再 `await userService.updateUserSettings(...)`。若 API 抛错或 abort，乐观更新不会被还原。

**修复**: 已增加 try/catch，失败时还原 prevSettings 并重新抛出。

---

### 2.3 authSelectors.isLogin 与 StoreInitialization 注释不一致

**位置**:

- `src/store/user/slices/auth/selectors.ts`: `isLogin: (s) => s.isSignedIn`
- `src/layout/GlobalProvider/StoreInitialization.tsx` 第 56–58 行注释

**问题**: 注释写「`isLogin` 会同时考虑 `enableAuth` 与 `isSignedIn`」，但 selector 实际只返回 `isSignedIn`，未使用 `enableAuth`。

**说明**: 若 `enableAuth` 从 serverConfig 来且为 false，期望未登录时不再请求用户状态，则需在 selector 或调用处显式检查 `enableAuth`。

---

### 2.4 NoAuthProvider 未触发 useInitUserState

**位置**: `src/layout/AuthProvider/NoAuth/index.tsx`、`src/layout/GlobalProvider/StoreInitialization.tsx`

**问题**: NoAuthProvider 设置 `isSignedIn: true` 和本地 `user`，但 useInitUserState 的 key 为 `!!isLogin || isDesktop ? GET_USER_STATE_KEY : null`。\
NoAuth 模式下 `isLogin`（= `isSignedIn`）为 true，因此会请求 `getUserState`。后端在 `NOAUTH_MODE=1` 时使用固定 userId，请求应能成功。

**结论**: 逻辑合理。但需确认 NoAuth 时 tRPC 的 context 会注入固定 userId（已在 `context.ts` 中确认）。

---

### 2.5 Desktop 模式下 isSignedIn 的滞后

**位置**: `src/layout/AuthProvider/Desktop/index.tsx`

**问题**: 只在 `isUserStateInit` 为 true 后才设置 `isSignedIn: true`。在此之前 `isSignedIn` 为 undefined/false，`isLogin` 为 false，useInitUserState 的 key 为 `isDesktop ? GET_USER_STATE_KEY : null`。\
Desktop 时 key 始终为 `GET_USER_STATE_KEY`，会发起请求；请求成功后 `isUserStateInit` 变为 true，useEffect 再设置 `isSignedIn`。顺序正确。

**结论**: 设计合理。

---

### 2.6 时区自动检测的静默失败 ✅ 已修复

**位置**: `src/store/user/slices/common/action.ts` 第 151–159 行

**问题**: `updateGeneralConfig` 失败时仅 `catch` 空函数，用户无法得知时区未被保存。

**修复**: 已在 catch 中增加 `console.error('[user] Failed to auto-sync timezone:', err)`。

---

### 2.7 LobeUser 中 latestName 与 API 的 lastName

**位置**: `src/store/user/slices/common/action.ts` 第 128 行

**说明**: API 返回 `lastName`，合并时映射为 `latestName: data.lastName`。`LobeUser` 同时含 `latestName` 与 `lastName`（preference.ts 中）。当前映射符合类型定义。

---

## 3. 数据流检查

| 来源             | user 字段                                                               | 合并策略                |
| ---------------- | ----------------------------------------------------------------------- | ----------------------- |
| useInitUserState | avatar, email, firstName, fullName, id, interests, latestName, username | merge(store.user, data) |
| UserUpdater      | avatar, email, fullName, id, username                                   | 当前为全量替换          |
| NoAuthProvider   | 固定本地 user                                                           | 直接 setState           |

---

## 4. 相关文件索引

| 模块                | 路径                                                 |
| ------------------- | ---------------------------------------------------- |
| User Store          | `src/store/user/store.ts`                            |
| Auth Slice          | `src/store/user/slices/auth/`                        |
| Settings Slice      | `src/store/user/slices/settings/action.ts`           |
| Common Slice        | `src/store/user/slices/common/action.ts`             |
| UserUpdater         | `src/layout/AuthProvider/BetterAuth/UserUpdater.tsx` |
| useInitUserState    | `src/store/user/slices/common/action.ts`             |
| NoAuthProvider      | `src/layout/AuthProvider/NoAuth/index.tsx`           |
| DesktopAuth         | `src/layout/AuthProvider/Desktop/index.tsx`          |
| StoreInitialization | `src/layout/GlobalProvider/StoreInitialization.tsx`  |
| User API            | `src/server/routers/lambda/user.ts`                  |

---

## 5. 总结

- **已修复**: 2.1 UserUpdater 覆盖 user、2.2 setSettings 失败时回滚、2.6 时区失败处理
- **建议优化**: 2.3 isLogin/enableAuth 语义（待产品确认需求后处理）
- **其余**: 2.4、2.5、2.7 已核实无误
