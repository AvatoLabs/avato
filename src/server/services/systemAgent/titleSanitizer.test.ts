import { describe, expect, it } from 'vitest';

import { sanitizeGeneratedTopicTitle } from './titleSanitizer';

describe('sanitizeGeneratedTopicTitle', () => {
  it('should keep a normal short title', () => {
    expect(sanitizeGeneratedTopicTitle('MMR共识层集成项目规划与风险评估')).toBe(
      'MMR共识层集成项目规划与风险评估',
    );
  });

  it('should reject multiline markdown output', () => {
    expect(
      sanitizeGeneratedTopicTitle(`### 1. 密码学与数据结构基础
- **Merkle Tree 变种实现**`),
    ).toBeNull();
  });

  it('should reject overly long single-line output', () => {
    expect(
      sanitizeGeneratedTopicTitle(
        '基于你提供的 MMR 技术规范文档以下是掌握该方案所需的核心技能推荐按技术层级分类并附上详细学习路径建议',
      ),
    ).toBeNull();
  });
});
