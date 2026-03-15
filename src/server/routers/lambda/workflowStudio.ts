import { z } from 'zod';

import { PluginModel } from '@/database/models/plugin';
import { UserModel } from '@/database/models/user';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import {
  applyWorkflowStudioSettingsState,
  extractInstalledWorkflowStudioServers,
  parseWorkflowStudioSettingsState,
  removeWorkflowStudioWorkflow,
  upsertWorkflowStudioWorkflow,
} from '@/server/services/mcp/workflowStudioLibrary';

const workflowStudioProcedure = authedProcedure.use(serverDatabase).use(async ({ ctx, next }) => {
  return next({
    ctx: {
      pluginModel: new PluginModel(ctx.serverDB, ctx.userId),
      userModel: new UserModel(ctx.serverDB, ctx.userId),
    },
  });
});

export const workflowStudioRouter = router({
  bootstrap: workflowStudioProcedure.query(async ({ ctx }) => {
    const [plugins, userSettings] = await Promise.all([
      ctx.pluginModel.query(),
      ctx.userModel.getUserSettings(),
    ]);

    return {
      servers: extractInstalledWorkflowStudioServers(plugins),
      workflows: parseWorkflowStudioSettingsState(userSettings?.tool).workflows,
    };
  }),

  deleteWorkflow: workflowStudioProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userSettings = await ctx.userModel.getUserSettings();
      const nextState = removeWorkflowStudioWorkflow({
        id: input.id,
        state: parseWorkflowStudioSettingsState(userSettings?.tool),
      });

      await ctx.userModel.updateSetting({
        tool: applyWorkflowStudioSettingsState(userSettings?.tool, nextState),
      });

      return nextState.workflows;
    }),

  upsertWorkflow: workflowStudioProcedure
    .input(
      z.object({
        draft: z.record(z.string(), z.unknown()),
        id: z.string().optional(),
        name: z.string().trim().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userSettings = await ctx.userModel.getUserSettings();
      const result = upsertWorkflowStudioWorkflow({
        draft: input.draft,
        id: input.id,
        name: input.name,
        state: parseWorkflowStudioSettingsState(userSettings?.tool),
      });

      await ctx.userModel.updateSetting({
        tool: applyWorkflowStudioSettingsState(userSettings?.tool, result.state),
      });

      return {
        entry: result.entry,
        workflows: result.state.workflows,
      };
    }),
});

export type WorkflowStudioRouter = typeof workflowStudioRouter;
