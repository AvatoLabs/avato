import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { documents, files, resourceFavorites } from '@/database/schemas';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { ResourceAuthorizer } from '@/server/services/resource';

const favoriteProcedure = authedProcedure.use(serverDatabase).use(async ({ ctx, next }) => {
  return next({
    ctx: {
      resourceAuthorizer: new ResourceAuthorizer(ctx.serverDB, ctx.userId),
    },
  });
});

export const favoriteRouter = router({
  addFavorite: favoriteProcedure
    .input(z.object({ resourceId: z.string(), sourceType: z.enum(['file', 'document']) }))
    .mutation(async ({ ctx, input }) => {
      // Verify user has access to the resource before allowing favorite
      await ctx.resourceAuthorizer.assertCapability({
        capability: 'read_metadata',
        id: input.resourceId,
        kind: input.sourceType,
      });

      await ctx.serverDB
        .insert(resourceFavorites)
        .values({
          resourceId: input.resourceId,
          sourceType: input.sourceType,
          userId: ctx.userId,
        })
        .onConflictDoNothing();
      return { success: true };
    }),

  listFavoriteIds: favoriteProcedure.query(async ({ ctx }) => {
    const rows = await ctx.serverDB
      .select({ resourceId: resourceFavorites.resourceId })
      .from(resourceFavorites)
      .where(eq(resourceFavorites.userId, ctx.userId));
    return rows.map((r) => r.resourceId);
  }),

  listFavorites: favoriteProcedure.query(async ({ ctx }) => {
    const rows = await ctx.serverDB
      .select({
        createdAt: resourceFavorites.createdAt,
        resourceId: resourceFavorites.resourceId,
        sourceType: resourceFavorites.sourceType,
      })
      .from(resourceFavorites)
      .where(eq(resourceFavorites.userId, ctx.userId))
      .orderBy(desc(resourceFavorites.createdAt));

    if (rows.length === 0) return [];

    const fileIds = rows.filter((r) => r.sourceType === 'file').map((r) => r.resourceId);
    const docIds = rows.filter((r) => r.sourceType === 'document').map((r) => r.resourceId);

    // Filter by authorization: only return resources the user can still access
    const [visibleFileIds, visibleDocIds] = await Promise.all([
      fileIds.length > 0 ? ctx.resourceAuthorizer.filterVisibleFileIdsForList(fileIds) : [],
      docIds.length > 0 ? ctx.resourceAuthorizer.filterVisibleDocumentIdsForList(docIds) : [],
    ]);

    const visibleFileSet = new Set(visibleFileIds);
    const visibleDocSet = new Set(visibleDocIds);

    const [fileResults, docResults] = await Promise.all([
      visibleFileIds.length > 0
        ? ctx.serverDB
            .select({
              fileType: files.fileType,
              id: files.id,
              name: files.name,
              spaceId: files.spaceId,
            })
            .from(files)
            .where(inArray(files.id, visibleFileIds))
        : [],
      visibleDocIds.length > 0
        ? ctx.serverDB
            .select({
              fileType: documents.fileType,
              id: documents.id,
              name: documents.title,
              slug: documents.slug,
              spaceId: documents.spaceId,
            })
            .from(documents)
            .where(and(inArray(documents.id, visibleDocIds), isNull(documents.deletedAt)))
        : [],
    ]);

    const fileMap = new Map(fileResults.map((f) => [f.id, f]));
    const docMap = new Map(docResults.map((d) => [d.id, d]));

    return rows
      .filter((row) => {
        if (row.sourceType === 'file') return visibleFileSet.has(row.resourceId);
        if (row.sourceType === 'document') return visibleDocSet.has(row.resourceId);
        return false;
      })
      .map((row) => {
        if (row.sourceType === 'file') {
          const file = fileMap.get(row.resourceId);
          if (!file) return null;
          return {
            createdAt: row.createdAt,
            fileType: file.fileType,
            id: row.resourceId,
            name: file.name,
            sourceType: row.sourceType as 'file' | 'document',
            spaceId: file.spaceId,
          };
        }
        const doc = docMap.get(row.resourceId);
        if (!doc) return null;
        return {
          createdAt: row.createdAt,
          fileType: doc.fileType,
          id: row.resourceId,
          name: doc.name ?? 'Untitled',
          slug: doc.slug,
          sourceType: row.sourceType as 'file' | 'document',
          spaceId: doc.spaceId,
        };
      })
      .filter(Boolean);
  }),

  removeFavorite: favoriteProcedure
    .input(z.object({ resourceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.serverDB
        .delete(resourceFavorites)
        .where(
          and(
            eq(resourceFavorites.userId, ctx.userId),
            eq(resourceFavorites.resourceId, input.resourceId),
          ),
        );
      return { success: true };
    }),
});
