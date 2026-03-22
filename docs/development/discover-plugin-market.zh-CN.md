# 社区 Discover 插件（技能）与数据源

本文说明**社区 / Discover** 中「插件、技能」相关列表与详情在服务端、客户端的数据路径，避免与旧版「插件索引 JSON」混淆。

## 服务端：`DiscoverService`

- **列表**：`getPluginList`、`getMcpList` 均通过 **Market SDK**（`ctx.discoverService.market.plugins.getPluginList`）拉取，与 MCP 市场列表**同源**。
- **分类**：`getPluginCategories` → `getMcpCategories` → `market.plugins.getCategories`。
- **标识集合**（站点地图、聚合页等）：`getPluginIdentifiers` → `market.plugins.getPublishedIdentifiers`（与助手市场的 `getPublishedIdentifiers` 模式一致）。
- **详情**：`getPluginDetail` 优先 Market 插件详情，其次内置工具、Klavis 等；**不再**从本地静态插件索引 JSON 先做一步匹配。

实现入口：`src/server/services/discover/index.ts`。tRPC 暴露：`src/server/routers/lambda/market/index.ts`（如 `getPluginList`、`getPluginIdentifiers`）。

## 已移除的服务端模块

- **`src/server/modules/PluginStore`** 已删除。该模块曾从 `PLUGINS_INDEX_URL` 指向的地址拉取 `index.{locale}.json` 风格的索引，**不**再参与 Discover 插件列表。

## 客户端：`ToolService`

- **`getDiscoverPluginList`**（`src/services/tool.ts`）：调用 **`market.getPluginList`** tRPC，并注入当前语言与分页参数；与上述服务端 `DiscoverService.getPluginList` 一致。
- 工具 Store 中「在线插件列表」等仍通过该路径加载时，数据来自 Market，而非已删除的 `PluginStore` 服务模块。

## 环境变量：`PLUGINS_INDEX_URL`

- **用途**：插件 **Gateway** 等仍可能使用该地址作为**插件索引 / 注册表**类资源的基址（见 `src/server/services/pluginGateway`、相关 WebAPI）。
- **与 Discover 列表的关系**：社区 Discover 的插件列表以 **Market 服务**（如 `MARKET_BASE_URL` 等市场相关配置）为准，**不要**假定修改 `PLUGINS_INDEX_URL` 会改变 Discover 的插件市场列表。

更完整的自建与变量说明见：`docs/self-hosting/environment-variables/basic.mdx`（及中文版 `basic.zh-CN.mdx`）中的 **Plugin Service** 小节。
