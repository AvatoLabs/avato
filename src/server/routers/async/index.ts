import { asyncRouter as router, publicProcedure } from '@/libs/trpc/async';

import { fileRouter } from './file';
import { imageRouter } from './image';
import { ragEvalRouter } from './ragEval';
import { spaceMemoryRouter } from './spaceMemory';

export const asyncRouter = router({
  file: fileRouter,
  healthcheck: publicProcedure.query(() => "i'm live!"),
  image: imageRouter,
  ragEval: ragEvalRouter,
  spaceMemory: spaceMemoryRouter,
});

export type AsyncRouter = typeof asyncRouter;

export type { UnifiedAsyncCaller } from './caller';
export { createAsyncCaller, createAsyncServerClient } from './caller';
