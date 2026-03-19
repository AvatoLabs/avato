export type TagId = string;

export interface TagItem extends TagItemBase {
  createdAt: Date;
  updatedAt: Date;
}

export interface TagItemBase {
  color?: string | null;
  id: string;
  name: string;
  sort?: number | null;
}

export type Tags = TagItem[];
