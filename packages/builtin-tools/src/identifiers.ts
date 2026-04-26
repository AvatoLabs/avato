import { AgentBuilderManifest } from '@lobechat/builtin-tool-agent-builder';
import { AgentManagementManifest } from '@lobechat/builtin-tool-agent-management';
import { CalculatorManifest } from '@lobechat/builtin-tool-calculator';
import { CloudSandboxManifest } from '@lobechat/builtin-tool-cloud-sandbox';
import { ComputerUseManifest } from '@lobechat/builtin-tool-computer-use';
import { DocsAgentManifest } from '@lobechat/builtin-tool-docs-agent';
import { GroupAgentBuilderManifest } from '@lobechat/builtin-tool-group-agent-builder';
import { GroupManagementManifest } from '@lobechat/builtin-tool-group-management';
import { GTDManifest } from '@lobechat/builtin-tool-gtd';
import { LocalSystemManifest } from '@lobechat/builtin-tool-local-system';
import { MemoryManifest } from '@lobechat/builtin-tool-memory';
import { NotebookManifest } from '@lobechat/builtin-tool-notebook';
import { SkillStoreManifest } from '@lobechat/builtin-tool-skill-store';
import { SkillsManifest } from '@lobechat/builtin-tool-skills';
import { SourceSetManifest } from '@lobechat/builtin-tool-source-set';
import { LobeToolsManifest } from '@lobechat/builtin-tool-tools';
import { WebBrowsingManifest } from '@lobechat/builtin-tool-web-browsing';

export const builtinToolIdentifiers: string[] = [
  AgentBuilderManifest.identifier,
  AgentManagementManifest.identifier,
  CalculatorManifest.identifier,
  ComputerUseManifest.identifier,
  LocalSystemManifest.identifier,
  WebBrowsingManifest.identifier,
  SourceSetManifest.identifier,
  CloudSandboxManifest.identifier,
  DocsAgentManifest.identifier,
  SkillsManifest.identifier,
  GroupAgentBuilderManifest.identifier,
  GroupManagementManifest.identifier,
  GTDManifest.identifier,
  MemoryManifest.identifier,
  NotebookManifest.identifier,
  LobeToolsManifest.identifier,
  SkillStoreManifest.identifier,
];
