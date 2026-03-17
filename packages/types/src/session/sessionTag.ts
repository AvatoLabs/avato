export type SessionTagId = string;

export interface SessionTagItem extends SessionTagItemBase {
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionTagItemBase {
  color?: string | null;
  id: string;
  name: string;
  sort?: number | null;
}

export type SessionTags = SessionTagItem[];

export type LobeSessionTags = SessionTagItem[];
