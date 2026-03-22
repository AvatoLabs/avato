# Discover plugin (skill) listing and data sources

This note describes how **Community / Discover** plugin (skill) lists and details are loaded on the server and client, and how that differs from the legacy **plugin index JSON** flow.

## Server: `DiscoverService`

- **Lists**: `getPluginList` and `getMcpList` both use the **Market SDK** (`market.plugins.getPluginList`). They share the same backend as the MCP marketplace list.
- **Categories**: `getPluginCategories` delegates to `getMcpCategories` → `market.plugins.getCategories`.
- **Identifiers** (sitemap, aggregators): `getPluginIdentifiers` → `market.plugins.getPublishedIdentifiers` (same pattern as assistant `getPublishedIdentifiers`).
- **Detail**: `getPluginDetail` tries Market first, then builtin tools and Klavis; it **does not** resolve from a local static plugin index JSON first.

Code: `src/server/services/discover/index.ts`. tRPC: `src/server/routers/lambda/market/index.ts`.

## Removed server module

- **`src/server/modules/PluginStore`** has been removed. It previously fetched locale-specific `index.*.json` from `PLUGINS_INDEX_URL` and is **no longer** used for Discover plugin lists.

## Client: `ToolService`

- **`getDiscoverPluginList`** (`src/services/tool.ts`): calls the **`market.getPluginList`** tRPC procedure with locale and pagination. It matches server `DiscoverService.getPluginList`.

## Environment variable: `PLUGINS_INDEX_URL`

- **Role**: Still used for the plugin **gateway** and related flows that need a plugin **index / registry** base URL (see `src/server/services/pluginGateway` and related WebAPI routes).
- **Discover lists**: Community Discover plugin data comes from the **Market** deployment (e.g. `MARKET_BASE_URL`), not from `PLUGINS_INDEX_URL`.

See **Plugin Service** in `docs/self-hosting/environment-variables/basic.mdx` (and `basic.zh-CN.mdx`) for variable details.
