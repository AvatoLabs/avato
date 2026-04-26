import { getCanonicalResourceKind } from './resourceList';

interface SharedResourceKindInput {
  kind: 'document' | 'file' | 'source_set';
  localId: string;
}

interface ContentShareTargetInput {
  id?: string;
  kind?: 'document' | 'file' | 'source_set';
}

interface PublicSharedContentLike {
  kind: 'document' | 'file' | 'source_set';
  localId: string;
}

interface SharedWithMeLike {
  kind: 'document' | 'file' | 'source_set';
  localId: string;
}

export const getCanonicalSharedResourceKind = (item: SharedResourceKindInput) => {
  if (item.kind === 'source_set') return item.kind;

  return getCanonicalResourceKind({ id: item.localId, kind: item.kind });
};

export const normalizeContentShareTarget = <T extends ContentShareTargetInput>(params: T): T => {
  if (!params.id || !params.kind || params.kind === 'source_set') return params;

  const kind = getCanonicalSharedResourceKind({ kind: params.kind, localId: params.id });

  if (kind === params.kind) return params;

  return { ...params, kind };
};

export const normalizePublicSharedContent = <T extends PublicSharedContentLike>(payload: T): T => {
  const kind = getCanonicalSharedResourceKind({ kind: payload.kind, localId: payload.localId });

  if (kind === payload.kind) return payload;

  return { ...payload, kind };
};

export const normalizeSharedWithMeItem = <T extends SharedWithMeLike>(item: T): T => {
  const kind = getCanonicalSharedResourceKind({ kind: item.kind, localId: item.localId });

  if (kind === item.kind) return item;

  return { ...item, kind };
};
