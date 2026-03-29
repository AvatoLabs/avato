import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { ChunkModel } from '@/database/models/chunk';
import { DocumentModel } from '@/database/models/document';
import { FileModel } from '@/database/models/file';
import { MessageModel } from '@/database/models/message';
import { SpaceModel } from '@/database/models/space';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { AuthorizedResourceResolver, ContentAuthorizer } from '@/server/services/content';
import { DocumentService } from '@/server/services/document';

const documentProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      chunkModel: new ChunkModel(ctx.serverDB, ctx.userId),
      documentModel: new DocumentModel(ctx.serverDB, ctx.userId),
      documentService: new DocumentService(ctx.serverDB, ctx.userId),
      fileModel: new FileModel(ctx.serverDB, ctx.userId),
      messageModel: new MessageModel(ctx.serverDB, ctx.userId),
      resolver: new AuthorizedResourceResolver(ctx.serverDB, ctx.userId),
      contentAuthorizer: new ContentAuthorizer(ctx.serverDB, ctx.userId),
      spaceModel: new SpaceModel(ctx.serverDB, ctx.userId),
    },
  });
});

const resolveParentDocumentId = async (
  ctx: {
    documentModel: DocumentModel;
    resolver: AuthorizedResourceResolver;
    spaceModel: SpaceModel;
  },
  params: {
    sourceSetId?: string;
    parentId?: string | null;
    spaceId?: string;
  },
) => {
  if (!params.parentId) return params.parentId;

  let scopedSpaceId = params.spaceId;
  if (!scopedSpaceId && params.sourceSetId) {
    const sourceSet = await ctx.resolver.requireSourceSet(params.sourceSetId, 'create_child');
    scopedSpaceId = sourceSet.spaceId || (await ctx.spaceModel.getOrCreatePersonalSpace()).id;
  }

  if (scopedSpaceId) {
    const scopedFolder = await ctx.documentModel.findBySlugInSpace(params.parentId, scopedSpaceId);
    if (scopedFolder) return scopedFolder.id;
  }

  const docBySlug = await ctx.documentModel.findBySlug(params.parentId);
  return docBySlug?.id || params.parentId;
};

export const documentRouter = router({
  createDocument: documentProcedure
    .input(
      z.object({
        content: z.string().optional(),
        editorData: z.string(),
        fileType: z.string().optional(),
        sourceSetId: z.string().optional(),
        metadata: z.record(z.any()).optional(),
        parentId: z.string().optional(),
        spaceId: z.string().optional(),
        slug: z.string().optional(),
        title: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolvedParentId = await resolveParentDocumentId(ctx, input);

      // Parse editorData from JSON string to object
      const editorData = JSON.parse(input.editorData);
      return ctx.documentService.createDocument({
        ...input,
        editorData,
        parentId: resolvedParentId,
      });
    }),

  createDocuments: documentProcedure
    .input(
      z.object({
        documents: z.array(
          z.object({
            content: z.string().optional(),
            editorData: z.string(),
            fileType: z.string().optional(),
            sourceSetId: z.string().optional(),
            metadata: z.record(z.any()).optional(),
            parentId: z.string().optional(),
            spaceId: z.string().optional(),
            slug: z.string().optional(),
            title: z.string(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Process each document: resolve parentId and parse editorData
      const processedDocuments = await Promise.all(
        input.documents.map(async (doc) => {
          const resolvedParentId = await resolveParentDocumentId(ctx, doc);

          // Parse editorData from JSON string to object
          const editorData = JSON.parse(doc.editorData);

          return {
            ...doc,
            editorData,
            parentId: resolvedParentId,
          };
        }),
      );

      return ctx.documentService.createDocuments(processedDocuments);
    }),

  deleteDocument: documentProcedure
    .input(z.object({ id: z.string(), trash: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.documentService.deleteDocument(input.id, input.trash !== false);
    }),

  deleteDocuments: documentProcedure
    .input(z.object({ ids: z.array(z.string()), trash: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.documentService.deleteDocuments(input.ids, input.trash !== false);
    }),

  ensureFileDocument: documentProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.contentAuthorizer.assertCapability({
        capability: 'preview_content',
        id: input.id,
        kind: 'file',
      });

      return ctx.documentService.ensureFileDocument(input.id);
    }),

  restoreDocument: documentProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.documentService.restoreDocument(input.id);
    }),

  restoreDocuments: documentProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.documentService.restoreDocuments(input.ids);
    }),

  getDocumentById: documentProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.documentService.getDocumentById(input.id);
    }),

  getFolderBreadcrumb: documentProcedure
    .input(
      z.object({
        slug: z.string(),
        spaceId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const scopedCandidate = input.spaceId
        ? await ctx.documentModel.findBySlugInSpace(input.slug, input.spaceId)
        : undefined;
      let candidates = scopedCandidate
        ? [scopedCandidate]
        : await ctx.documentModel.findManyBySlug(input.slug);

      if (candidates.length === 0) {
        const byId = await ctx.documentModel.findByIdAny(input.slug);
        if (byId && (!input.spaceId || byId.spaceId === input.spaceId)) candidates = [byId];
      }

      let start = undefined as (typeof candidates)[number] | undefined;
      for (const doc of candidates) {
        const m = await ctx.contentAuthorizer.getAccessMatch({
          capability: 'read_metadata',
          id: doc.id,
          kind: 'document',
        });
        if (m?.canAccess) {
          start = doc;
          break;
        }
      }

      if (!start) return [];

      const chain: Array<{ id: string; name: string; slug: string }> = [];
      let current: typeof start | undefined = start;

      while (current) {
        chain.unshift({
          id: current.id,
          name: current.title || current.filename || 'Untitled',
          slug: current.slug || current.id,
        });

        if (!current.parentId) break;

        const parent = await ctx.documentModel.findByIdAny(current.parentId);
        if (!parent) break;

        const parentAccess = await ctx.contentAuthorizer.getAccessMatch({
          capability: 'read_metadata',
          id: parent.id,
          kind: 'document',
        });
        if (!parentAccess?.canAccess) break;

        current = parent;
      }

      return chain;
    }),

  parseDocument: documentProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.contentAuthorizer.assertCapability({
        capability: 'preview_content',
        id: input.id,
        kind: 'file',
      });

      const lobeDocument = await ctx.documentService.parseDocument(input.id);

      return lobeDocument;
    }),

  parseFileContent: documentProcedure
    .input(
      z.object({
        id: z.string(),
        skipExist: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.contentAuthorizer.assertCapability({
        capability: 'preview_content',
        id: input.id,
        kind: 'file',
      });

      const lobeDocument = await ctx.documentService.parseFile(input.id);

      return lobeDocument;
    }),

  previewFileContent: documentProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await ctx.contentAuthorizer.assertCapability({
        capability: 'preview_content',
        id: input.id,
        kind: 'file',
      });

      return ctx.documentService.previewFile(input.id);
    }),

  queryDocuments: documentProcedure
    .input(
      z
        .object({
          current: z.number().optional(),
          fileTypes: z.array(z.string()).optional(),
          sourceSetId: z.string().optional(),
          pageSize: z.number().optional(),
          spaceId: z.string().optional(),
          sourceTypes: z.array(z.string()).optional(),
          trash: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      if (input?.spaceId) {
        const space = await ctx.spaceModel.findAccessibleSpaceById(input.spaceId);
        if (!space?.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'SPACE_ACCESS_DENIED' });
        }
      }

      return ctx.documentService.queryDocuments(input);
    }),

  updateDocument: documentProcedure
    .input(
      z.object({
        content: z.string().optional(),
        editorData: z.string().optional(),
        fileType: z.string().optional(),
        id: z.string(),
        metadata: z.record(z.any()).optional(),
        parentId: z.string().nullable().optional(),
        rawData: z.string().optional(),
        title: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, editorData: editorDataString, ...params } = input;
      // Parse editorData from JSON string to object if present
      const editorData = editorDataString ? JSON.parse(editorDataString) : undefined;
      return ctx.documentService.updateDocument(id, {
        ...params,
        editorData,
      });
    }),
});
