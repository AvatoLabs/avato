# 移动端资源页与工作区功能对齐审计

**审计日期**: 2025-03-23

**审计范围**:

- 移动端 TabBar 显示逻辑
- 移动端资源首页布局与工作区切换
- 移动端资料库布局
- 与桌面端工作区功能的对齐情况

---

## 0. 审计结论

| 项目           | 状态                                              |
| -------------- | ------------------------------------------------- |
| **整体对齐**   | ✅ 已完成                                         |
| **TabBar**     | ✅ 资源子路由下显示底部导航                       |
| **资源首页**   | ✅ ResourceMobileHeader + 工作区切换 Modal        |
| **资料库**     | ✅ LibraryMobileHeader + 文件夹树 Drawer          |
| **资料库列表** | ✅ LibraryListSection（空间首页横滑卡片）         |
| **Explorer**   | ✅ AddButton icon-only、EmptyPlaceholder 垂直布局 |
| **快捷键**     | ✅ RegisterHotkeys（资料库页）                    |

移动端资源页已与桌面端工作区能力对齐，可正常使用个人 / 团队空间、空间切换、「分享给我」、资料库浏览与文件操作。

---

## 1. 背景

桌面端资源页已支持工作区（Space）能力：个人 / 团队空间、空间切换、「分享给我」、空间设置等。移动端此前共用 `(main)/resource` 路由与布局，但 Sidebar 通过 `NavPanelPortal` 渲染到 `NavPanel`，而移动端根布局为 `MobileMainLayout`，不包含 `NavPanel`，导致工作区侧栏内容无法展示。

---

## 2. 实施改动

### 2.1 TabBar 在资源子路由显示

**文件**: `src/routes/(mobile)/_layout/index.tsx`

| 改动                        | 说明                                                                    |
| --------------------------- | ----------------------------------------------------------------------- |
| `isResourceRoute(pathname)` | 新增：`pathname === '/resource' \|\| pathname.startsWith('/resource/')` |
| `showNav` 条件              | 扩展为 `MOBILE_NAV_ROUTES.has(pathname) \|\| isResourceRoute(pathname)` |

**影响**: `/resource/shared`、`/resource/space/:id`、`/resource/space/:id/library/:id` 等子路由下均显示底部 TabBar，可正常返回其他 Tab。

### 2.2 资源首页移动端布局

**文件**: `src/routes/(main)/resource/(home)/_layout/index.tsx`

- `useServerConfigStore((s) => s.isMobile)` 判断是否为移动端
- **移动端**: `MobileContentLayout` + `ResourceMobileHeader` + `Outlet`
- **桌面端**: 保持原有 `Sidebar` + `Flexbox`（NavPanelPortal）

### 2.3 ResourceMobileHeader

**新文件**: `src/routes/(main)/resource/(home)/_layout/ResourceMobileHeader.tsx`

| 区块             | 内容                                                                       |
| ---------------- | -------------------------------------------------------------------------- |
| ChatHeader 左侧  | 当前工作区 /「分享给我」标题，点击打开切换 Modal                           |
| ChatHeader 右侧  | `LibraryTrashButton`                                                       |
| 下方分类         | `CategoryMenu`（All / Documents / Images / Audios / Videos），在设置页隐藏 |
| 工作区切换 Modal | 「分享给我」、空间列表、团队空间设置入口、「创建 workspace」按钮           |

- SWR key: `resource-space-list`（与 SpaceSection 共用，便于 mutate 后同步）
- `CreateSpaceForm` 从 `SpaceSection` 抽取并导出，供创建工作区复用

### 2.4 资料库移动端布局

**文件**: `src/routes/(main)/resource/library/_layout/index.tsx`

- **移动端**: `MobileContentLayout` + `LibraryMobileHeader` + `Outlet`
- **桌面端**: 保持原有 Sidebar（LibraryHierarchy + Header）

**LibraryMobileHeader**:

- 左侧：`BackButton`（根据 `spaceId` 回退到空间首页或 `/resource`）+ 资料库名称
- 右侧：`LibraryTrashButton`

---

## 3. 路由与布局对应

| 路径                                   | 布局             | 移动端 Header                           |
| -------------------------------------- | ---------------- | --------------------------------------- |
| `/resource`                            | redirect → space | -                                       |
| `/resource/shared`                     | (home)/\_layout  | ResourceMobileHeader                    |
| `/resource/space/:spaceId`             | (home)/\_layout  | ResourceMobileHeader                    |
| `/resource/space/:spaceId/settings`    | (home)/\_layout  | ResourceMobileHeader（无 CategoryMenu） |
| `/resource/library/:id`                | library/\_layout | LibraryMobileHeader                     |
| `/resource/space/:spaceId/library/:id` | library/\_layout | LibraryMobileHeader                     |

---

## 4. 已知限制与后续优化

| 项目                 | 说明                                                                            |
| -------------------- | ------------------------------------------------------------------------------- |
| 资料库文件夹树       | ✅ 已修复：移动端通过 Header 的文件夹树按钮打开 Drawer，内含 `LibraryHierarchy` |
| 空间设置入口         | 在工作区 Modal 中通过空间行的设置图标进入，桌面端则在 Sidebar 中直接展示        |
| createModal 与 Modal | 工作区 Modal 与创建空间的 `createModal` 为两层弹窗，交互流程与桌面端一致        |

## 5. 移动端空间首页资料库列表（LibraryListSection）

**新组件**: `src/features/ResourceManager/components/LibraryListSection.tsx`

- 在 Explorer 中，当 `isMobile && !libraryId` 时，在 Header 下方展示资料库区域
- 横向滚动的资料库卡片列表 + 「新建资料库」卡片
- 使用 `useFetchKnowledgeBaseList(spaceId)` 拉取当前空间资料库
- 点击卡片进入 `buildResourceLibraryPath(spaceId, id)`；点击「新建」打开 CreateNewModal

## 6. Explorer Header 移动端工具栏

| 改动      | 说明                                                      |
| --------- | --------------------------------------------------------- |
| NavHeader | `showTogglePanelButton={!isMobile}`，移动端不显示侧栏切换 |
| AddButton | 移动端自动切换为 icon-only（ActionIcon），节省横向空间    |

### 6.1 EmptyPlaceholder 移动端

- 移动端使用垂直布局（`horizontal={!isMobile}`），避免空状态卡片横向溢出

## 7. 后续修复（2025-03-23）✅ 已完成

| 修复                         | 说明                                                                             | 状态 |
| ---------------------------- | -------------------------------------------------------------------------------- | ---- |
| LibraryMobileHeader 返回按钮 | `BackButton`、文件夹树图标使用 `MOBILE_HEADER_ICON_SIZE` 提升触控目标            | ✅   |
| 移动端资料库 RegisterHotkeys | `LibraryLayout` 移动端分支渲染 `RegisterHotkeys`，使用 `useRegisterFilesHotkeys` | ✅   |
| Breadcrumb 路径              | `buildResourceFolderPath` / `buildResourceLibraryPath` 及 `spaceId`              | ✅   |
| 移动端文件夹树 Drawer        | `LibraryFolderDrawer` + Header 文件夹树按钮                                      | ✅   |

---

## 8. 文件索引

| 路径                                                                     | 职责                              |
| ------------------------------------------------------------------------ | --------------------------------- |
| `src/routes/(mobile)/_layout/index.tsx`                                  | 移动端根布局，TabBar 显示逻辑     |
| `src/routes/(main)/resource/(home)/_layout/index.tsx`                    | 资源首页布局，移动 / 桌面分支     |
| `src/routes/(main)/resource/(home)/_layout/ResourceMobileHeader.tsx`     | 移动端资源首页 Header             |
| `src/routes/(main)/resource/library/_layout/index.tsx`                   | 资料库布局，移动 / 桌面分支       |
| `src/routes/(main)/resource/library/features/LibraryFolderDrawer.tsx`    | 移动端文件夹树 Drawer             |
| `src/features/ResourceManager/components/Explorer/Header/Breadcrumb.tsx` | 面包屑，使用 spaceId 构建正确路径 |
| `src/features/ResourceSpaces/SpaceSection.tsx`                           | `CreateSpaceForm` 命名导出        |
| `src/features/ResourceManager/components/LibraryListSection.tsx`         | 移动端空间首页资料库横滑卡片      |
| `src/features/ResourceManager/components/Explorer/EmptyPlaceholder.tsx`  | 空状态，移动端垂直布局            |
| `src/features/ResourceManager/components/Header/AddButton.tsx`           | 移动端 icon-only                  |
