# RN Android Alignment Convergence

Date: 2026-05-19

## Scope

This convergence record covers the React Native / Expo mobile app under `apps/mobile`.

In scope:

- RN Android usability.
- RN-native flows where they already exist.
- External Web fallback links for Web-only advanced surfaces.
- Mobile tests, TypeScript checks, and Android debug build validation.

Out of scope:

- iOS, because `apps/mobile/ios` is not present and iOS was explicitly excluded.
- SPA parity, because this pass does not require new mobile SPA routes or Web mobile page work.
- Full RN-native migration of every Web advanced form, such as Cron, Channel, advanced Settings, Group workspace, Aggregator complex filters, or Stats image export.

## Converged Behaviors

- Store / Community exposes MCP, Skill, Aggregator MCP, Aggregator Skill, Agent, Group Agent, Model, Provider, and Plugin discovery on RN. Install/import remains native where supported; unsupported complex actions use external Web detail fallbacks.
- Stats exposes core overview, heatmap, ranking, monthly usage, recent usage, native text sharing, and a Web stats fallback for Web-only image share/export.
- Space settings and members management are available in RN for the primary team-space management path.
- Public resource share and public topic share open in RN, with topic-share CTA links routed to external Web paths when needed.
- Agent Cron and Channel, advanced Settings, Studio/MCP Studio, Image/Video Web workspace, and Group workspace remain reachable from RN through explicit external Web links.
- Builtin tool call display names use RN i18n keys first, with legacy locale maps retained only as compatibility fallback.
- RN link-opening surfaces now report failures through user-visible error feedback instead of silently swallowing failed `Linking.openURL` calls.

## Validation

Passed on 2026-05-19:

```bash
cd apps/mobile && bunx vitest run --silent='passed-only'
# 35 files, 229 tests passed

cd apps/mobile && bunx tsc --noEmit
# passed

bun run type-check
# passed

cd apps/mobile && bunx vitest run --silent='passed-only' \
  'src/api.test.ts' \
  'src/lib/shareLinkNavigation.test.ts' \
  'src/lib/communityLinks.test.ts' \
  'src/features/BuiltinTools/displayNames.test.ts' \
  'src/lib/linkingFeedback.test.ts'
# 5 files, 71 tests passed

cd apps/mobile/android && ./gradlew :app:assembleDebug
# BUILD SUCCESSFUL in 12s
```

Notes:

- Android build still reports existing Gradle warnings: unspecified `NODE_ENV`, `flatDir` usage, and deprecated Gradle features. They did not block `:app:assembleDebug`.
- `src/lib/linkingFeedback.test.ts` prevents reintroducing silent `Linking.openURL(...).catch(() => undefined)` and direct `onPress={() => Linking.openURL(...)}` patterns.
- `git diff --check` passed after the code changes.
