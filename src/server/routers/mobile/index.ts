/**
 * This file contains the root router of Lobe Chat tRPC-backend for Mobile App
 * Only includes routers that are actually used by the mobile client
 */
import { publicProcedure, router } from '@/libs/trpc/lambda';

import { agentRouter } from '../lambda/agent';
import { agentGroupRouter } from '../lambda/agentGroup';
import { agentSkillsRouter } from '../lambda/agentSkills';
import { aiAgentRouter } from '../lambda/aiAgent';
import { aiChatRouter } from '../lambda/aiChat';
import { aiModelRouter } from '../lambda/aiModel';
import { aiProviderRouter } from '../lambda/aiProvider';
import { chunkRouter } from '../lambda/chunk';
import { configRouter } from '../lambda/config';
import { documentRouter } from '../lambda/document';
import { fileRouter } from '../lambda/file';
import { generationRouter } from '../lambda/generation';
import { generationBatchRouter } from '../lambda/generationBatch';
import { generationTopicRouter } from '../lambda/generationTopic';
import { imageRouter } from '../lambda/image';
import { knowledgeBaseRouter } from '../lambda/knowledgeBase';
import { marketRouter } from '../lambda/market';
import { messageRouter } from '../lambda/message';
import { notebookRouter } from '../lambda/notebook';
import { pluginRouter } from '../lambda/plugin';
import { sessionRouter } from '../lambda/session';
import { sessionGroupRouter } from '../lambda/sessionGroup';
import { sessionTagRouter } from '../lambda/sessionTag';
import { topicRouter } from '../lambda/topic';
import { uploadRouter } from '../lambda/upload';
import { userRouter } from '../lambda/user';
import { userMemoriesRouter } from '../lambda/userMemories';
import { userMemoryRouter } from '../lambda/userMemory';
import { mcpRouter } from '../tools/mcp';

export const mobileRouter = router({
  agent: agentRouter,
  agentGroup: agentGroupRouter,
  agentSkills: agentSkillsRouter,
  aiAgent: aiAgentRouter,
  aiChat: aiChatRouter,
  aiModel: aiModelRouter,
  aiProvider: aiProviderRouter,
  chunk: chunkRouter,
  config: configRouter,
  document: documentRouter,
  file: fileRouter,
  generation: generationRouter,
  generationBatch: generationBatchRouter,
  generationTopic: generationTopicRouter,
  healthcheck: publicProcedure.query(() => "i'm live!"),
  image: imageRouter,
  knowledgeBase: knowledgeBaseRouter,
  market: marketRouter,
  mcp: mcpRouter,
  message: messageRouter,
  notebook: notebookRouter,
  plugin: pluginRouter,
  session: sessionRouter,
  sessionGroup: sessionGroupRouter,
  sessionTag: sessionTagRouter,
  topic: topicRouter,
  upload: uploadRouter,
  user: userRouter,
  userMemories: userMemoriesRouter,
  userMemory: userMemoryRouter,
});
