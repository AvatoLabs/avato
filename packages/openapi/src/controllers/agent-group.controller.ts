import type { Context } from 'hono';

import { BaseController } from '../common/base.controller';
import { AgentGroupService } from '../services/agent-group.service';
import type {
  CreateAgentGroupRequest,
  DeleteAgentGroupRequest,
  UpdateAgentGroupRequest,
} from '../types/agent-group.type';

/**
 * AgentGroup 控制器类
 * 处理智能体分类相关的 HTTP 请求和响应
 */
export class AgentGroupController extends BaseController {
  /**
   * 获取智能体分类列表
   * GET /api/v1/agent-groups
   * @param c Hono Context
   * @returns 智能体分类列表响应
   */
  async getAgentGroups(c: Context): Promise<Response> {
    try {
      const db = await this.getDatabase();
      const agentGroupService = new AgentGroupService(db, this.getUserId(c));
      const agentGroups = await agentGroupService.getAgentGroups();

      return this.success(c, agentGroups, '获取智能体分类列表成功');
    } catch (error) {
      return this.handleError(c, error);
    }
  }

  /**
   * 根据 ID 获取智能体分类详情
   * GET /api/v1/agent-groups/:id
   * @param c Hono Context
   * @returns 智能体分类详情响应
   */
  async getAgentGroupById(c: Context): Promise<Response> {
    try {
      const { id: groupId } = this.getParams<{ id: string }>(c);

      if (!groupId) {
        return this.error(c, '智能体分类 ID 是必需的', 400);
      }

      const db = await this.getDatabase();
      const agentGroupService = new AgentGroupService(db, this.getUserId(c));
      const agentGroup = await agentGroupService.getAgentGroupById(groupId);

      if (!agentGroup) {
        return this.error(c, '智能体分类不存在', 404);
      }

      return this.success(c, agentGroup, '获取智能体分类详情成功');
    } catch (error) {
      return this.handleError(c, error);
    }
  }

  /**
   * 创建智能体分类
   * POST /api/v1/agent-groups
   * @param c Hono Context
   * @returns 创建完成的智能体分类 ID 响应
   */
  async createAgentGroup(c: Context): Promise<Response> {
    try {
      const body = await this.getBody<CreateAgentGroupRequest>(c);

      const db = await this.getDatabase();
      const agentGroupService = new AgentGroupService(db, this.getUserId(c));
      const groupId = await agentGroupService.createAgentGroup(body);

      return c.json(
        {
          data: { id: groupId },
          message: '智能体分类创建成功',
          success: true,
          timestamp: new Date().toISOString(),
        },
        201,
      );
    } catch (error) {
      return this.handleError(c, error);
    }
  }

  /**
   * 更新智能体分类
   * PATCH /api/v1/agent-groups/:id
   * @param c Hono Context
   * @returns 更新结果响应
   */
  async updateAgentGroup(c: Context): Promise<Response> {
    try {
      const { id: groupId } = this.getParams<{ id: string }>(c);
      const body = await this.getBody<Omit<UpdateAgentGroupRequest, 'id'>>(c);

      if (!groupId) {
        return this.error(c, '智能体分类 ID 是必需的', 400);
      }

      const request: UpdateAgentGroupRequest = {
        id: groupId,
        ...body,
      };

      const db = await this.getDatabase();
      const agentGroupService = new AgentGroupService(db, this.getUserId(c));
      await agentGroupService.updateAgentGroup(request);

      return this.success(c, null, '智能体分类更新成功');
    } catch (error) {
      return this.handleError(c, error);
    }
  }

  /**
   * 删除智能体分类
   * DELETE /api/v1/agent-groups/:id
   * @param c Hono Context
   * @returns 删除结果响应
   */
  async deleteAgentGroup(c: Context): Promise<Response> {
    try {
      const { id: groupId } = this.getParams<{ id: string }>(c);

      if (!groupId) {
        return this.error(c, '智能体分类 ID 是必需的', 400);
      }

      const request: DeleteAgentGroupRequest = {
        id: groupId,
      };

      const db = await this.getDatabase();
      const agentGroupService = new AgentGroupService(db, this.getUserId(c));
      await agentGroupService.deleteAgentGroup(request);

      return this.success(c, null, '智能体分类删除成功');
    } catch (error) {
      return this.handleError(c, error);
    }
  }
}
