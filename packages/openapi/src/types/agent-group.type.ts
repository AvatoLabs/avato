import { z } from 'zod';

import type { SessionGroupItem } from '@/database/schemas';

// ==================== Agent Group CRUD Types ====================
// 智能体分类（使用 sessionGroups 表存储）相关类型定义

/**
 * 创建智能体分类请求参数
 */
export interface CreateAgentGroupRequest {
  name: string;
  sort?: number;
}

export const CreateAgentGroupRequestSchema = z.object({
  name: z.string().min(1, '智能体分类名称不能为空'),
  sort: z.number().nullish(),
});

/**
 * 更新智能体分类请求参数
 */
export interface UpdateAgentGroupRequest {
  id: string;
  name?: string;
  sort?: number;
}

export const UpdateAgentGroupRequestSchema = z.object({
  name: z.string().min(1, '智能体分类名称不能为空').nullish(),
  sort: z.number().nullish(),
});

/**
 * 删除智能体分类请求参数
 */
export interface DeleteAgentGroupRequest {
  id: string;
}

// ==================== Agent Group Response Types ====================

/**
 * 智能体分类列表响应类型
 */
export type AgentGroupListResponse = SessionGroupItem[];

// ==================== Common Schemas ====================

export const AgentGroupIdParamSchema = z.object({
  id: z.string().min(1, '智能体分类 ID 不能为空'),
});
