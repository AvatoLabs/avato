import { LocalSystemApiName, LocalSystemIdentifier } from '@lobechat/builtin-tool-local-system';
import { SkillsIdentifier } from '@lobechat/builtin-tool-skills';
import { safeParseJSON } from '@lobechat/utils';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { authedProcedure, router } from '@/libs/trpc/lambda';
import { deviceProxy } from '@/server/services/toolExecution/deviceProxy';

const MAX_IDENTIFIER_FIELD_LENGTH = 512;
const MAX_TOOL_ARGUMENTS_LENGTH = 2_000_000;
const REMOTE_COMMAND_DEFAULT_TIMEOUT = 120_000;
const REMOTE_COMMAND_MIN_TIMEOUT = 1000;
const REMOTE_COMMAND_MAX_TIMEOUT = 600_000;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const clampRemoteTimeout = (timeout: number) =>
  Math.min(Math.max(Math.trunc(timeout), REMOTE_COMMAND_MIN_TIMEOUT), REMOTE_COMMAND_MAX_TIMEOUT);

const resolveDeviceRpcTimeout = (input: {
  apiName: string;
  arguments: string;
  identifier: string;
  timeout?: number;
}) => {
  if (input.timeout !== undefined) return input.timeout;

  if (
    input.identifier !== LocalSystemIdentifier ||
    input.apiName !== LocalSystemApiName.runCommand
  ) {
    return undefined;
  }

  const args = safeParseJSON(input.arguments);

  return isRecord(args) && typeof args.timeout === 'number' && Number.isFinite(args.timeout)
    ? clampRemoteTimeout(args.timeout)
    : REMOTE_COMMAND_DEFAULT_TIMEOUT;
};

const executeToolCallSchema = z.object({
  apiName: z.string().trim().min(1).max(MAX_IDENTIFIER_FIELD_LENGTH),
  arguments: z.string().max(MAX_TOOL_ARGUMENTS_LENGTH),
  deviceId: z.string().trim().min(1).max(MAX_IDENTIFIER_FIELD_LENGTH).optional(),
  identifier: z.enum([LocalSystemIdentifier, SkillsIdentifier]),
  timeout: z.number().min(1000).max(600_000).optional(),
});

export const remoteDeviceRouter = router({
  executeToolCall: authedProcedure.input(executeToolCallSchema).mutation(async ({ ctx, input }) => {
    try {
      return await deviceProxy.executeToolCall(
        {
          deviceId: input.deviceId,
          userId: ctx.userId,
        },
        {
          apiName: input.apiName,
          arguments: input.arguments,
          identifier: input.identifier,
        },
        resolveDeviceRpcTimeout(input),
      );
    } catch (error) {
      console.error('[remoteDevice:executeToolCall]', error);
      throw new TRPCError({
        cause: error,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to execute remote device tool call',
      });
    }
  }),

  getSystemInfo: authedProcedure
    .input(z.object({ deviceId: z.string().trim().min(1).max(MAX_IDENTIFIER_FIELD_LENGTH) }))
    .query(({ ctx, input }) => {
      return deviceProxy.queryDeviceSystemInfo(ctx.userId, input.deviceId);
    }),

  list: authedProcedure.query(({ ctx }) => {
    return deviceProxy.queryDeviceList(ctx.userId);
  }),

  status: authedProcedure.query(({ ctx }) => {
    return deviceProxy.queryDeviceStatus(ctx.userId);
  }),
});
