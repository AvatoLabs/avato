import { type NotebookDocument } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { DocumentModel } from '@/database/models/document';
import { ResourceModel } from '@/database/models/resource';
import { TopicDocumentModel } from '@/database/models/topicDocument';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { type ResourceCapability, ResourceAuthorizer } from '@/server/services/resource';

const assertNotebookDocumentAccess = async (params: {
  capability: ResourceCapability;
  documentId: string;
  documentModel: DocumentModel;
  resourceAuthorizer: ResourceAuthorizer;
  userId: string;
}) => {
  const { capability, documentId, documentModel, resourceAuthorizer, userId } = params;

  const viaResource = await resourceAuthorizer.getAccessMatch({
    capability,
    id: documentId,
    kind: 'document',
  });
  if (viaResource?.canAccess) return;

  const doc = await documentModel.findByIdAny(documentId);
  if (!doc) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'DOCUMENT_NOT_FOUND' });
  }
  if (doc.userId !== userId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'RESOURCE_ACCESS_DENIED' });
  }
};

const notebookProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      documentModel: new DocumentModel(ctx.serverDB, ctx.userId),
      resourceAuthorizer: new ResourceAuthorizer(ctx.serverDB, ctx.userId),
      resourceModel: new ResourceModel(ctx.serverDB, ctx.userId),
      topicDocumentModel: new TopicDocumentModel(ctx.serverDB, ctx.userId),
    },
  });
});

export const notebookRouter = router({
  createDocument: notebookProcedure
    .input(
      z.object({
        content: z.string(),
        description: z.string(),
        metadata: z.record(z.string(), z.any()).optional(),
        source: z.string().optional().default('notebook'),
        sourceType: z.enum(['file', 'web', 'api', 'topic']).optional().default('api'),
        title: z.string(),
        topicId: z.string(),
        type: z
          .enum(['article', 'markdown', 'note', 'report', 'agent/plan'])
          .optional()
          .default('markdown'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Create the document
      const document = await ctx.documentModel.create({
        content: input.content,
        description: input.description,
        fileType: input.type,
        metadata: input.metadata,
        source: input.source,
        sourceType: input.sourceType,
        title: input.title,
        totalCharCount: input.content.length,
        totalLineCount: input.content.split('\n').length,
      });

      // Associate with topic
      await ctx.topicDocumentModel.associate({
        documentId: document.id,
        topicId: input.topicId,
      });

      return document;
    }),

  deleteDocument: notebookProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertNotebookDocumentAccess({
        capability: 'delete',
        documentId: input.id,
        documentModel: ctx.documentModel,
        resourceAuthorizer: ctx.resourceAuthorizer,
        userId: ctx.userId,
      });

      const row = await ctx.documentModel.findByIdAny(input.id);

      await ctx.topicDocumentModel.deleteByDocumentId(input.id);
      await ctx.documentModel.deleteManyAny([input.id]);

      await ctx.resourceModel.invalidateAuthzEpochsAfterRemoval([
        { resourceUid: row?.resourceUid, spaceId: row?.spaceId },
      ]);

      return { success: true };
    }),

  getDocument: notebookProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertNotebookDocumentAccess({
        capability: 'read_metadata',
        documentId: input.id,
        documentModel: ctx.documentModel,
        resourceAuthorizer: ctx.resourceAuthorizer,
        userId: ctx.userId,
      });

      return ctx.documentModel.findByIdAny(input.id);
    }),

  listDocuments: notebookProcedure
    .input(
      z.object({
        topicId: z.string(),
        type: z.enum(['article', 'markdown', 'note', 'report', 'agent/plan']).optional(),
      }),
    )
    .query(async ({ ctx, input }): Promise<{ data: NotebookDocument[]; total: number }> => {
      const documents = await ctx.topicDocumentModel.findByTopicId(input.topicId, {
        type: input.type,
      });

      return {
        data: documents.map((doc) => ({
          associatedAt: doc.associatedAt,
          content: doc.content,
          createdAt: doc.createdAt,
          description: doc.description,
          fileType: doc.fileType,
          id: doc.id,
          metadata: doc.metadata,
          title: doc.title,
          totalCharCount: doc.totalCharCount,
          totalLineCount: doc.totalLineCount,
          updatedAt: doc.updatedAt,
        })),
        total: documents.length,
      };
    }),

  updateDocument: notebookProcedure
    .input(
      z.object({
        append: z.boolean().optional(),
        content: z.string().optional(),
        description: z.string().optional(),
        id: z.string(),
        metadata: z.record(z.string(), z.any()).optional(),
        title: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertNotebookDocumentAccess({
        capability: 'move',
        documentId: input.id,
        documentModel: ctx.documentModel,
        resourceAuthorizer: ctx.resourceAuthorizer,
        userId: ctx.userId,
      });

      let contentToUpdate = input.content;

      // Handle append mode
      if (input.append && input.content) {
        const existing = await ctx.documentModel.findByIdAny(input.id);
        if (existing?.content) {
          contentToUpdate = existing.content + '\n\n' + input.content;
        }
      }

      await ctx.documentModel.updateAny(input.id, {
        ...(contentToUpdate !== undefined && {
          content: contentToUpdate,
          totalCharCount: contentToUpdate.length,
          totalLineCount: contentToUpdate.split('\n').length,
        }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.metadata !== undefined && { metadata: input.metadata }),
        ...(input.title && { title: input.title }),
      });

      return ctx.documentModel.findByIdAny(input.id);
    }),
});
