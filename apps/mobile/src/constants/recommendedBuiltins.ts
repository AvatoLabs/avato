export type MobileRecommendedBuiltinIcon =
  | 'artifacts'
  | 'calculator'
  | 'cloud'
  | 'gtd'
  | 'memory'
  | 'notebook';

export interface MobileRecommendedBuiltinSkill {
  descriptionKey: string;
  icon: MobileRecommendedBuiltinIcon;
  identifier: string;
  titleKey: string;
  type: 'builtinAgent' | 'builtinTool';
}

export const MOBILE_RECOMMENDED_BUILTIN_SKILLS: MobileRecommendedBuiltinSkill[] = [
  {
    descriptionKey: 'skillsBuiltinArtifactsDesc',
    icon: 'artifacts',
    identifier: 'lobe-artifacts',
    titleKey: 'skillsBuiltinArtifactsTitle',
    type: 'builtinAgent',
  },
  {
    descriptionKey: 'skillsBuiltinMemoryDesc',
    icon: 'memory',
    identifier: 'lobe-user-memory',
    titleKey: 'skillsBuiltinMemoryTitle',
    type: 'builtinTool',
  },
  {
    descriptionKey: 'skillsBuiltinCloudSandboxDesc',
    icon: 'cloud',
    identifier: 'lobe-cloud-sandbox',
    titleKey: 'skillsBuiltinCloudSandboxTitle',
    type: 'builtinTool',
  },
  {
    descriptionKey: 'skillsBuiltinGtdDesc',
    icon: 'gtd',
    identifier: 'lobe-gtd',
    titleKey: 'skillsBuiltinGtdTitle',
    type: 'builtinTool',
  },
  {
    descriptionKey: 'skillsBuiltinNotebookDesc',
    icon: 'notebook',
    identifier: 'lobe-notebook',
    titleKey: 'skillsBuiltinNotebookTitle',
    type: 'builtinTool',
  },
  {
    descriptionKey: 'skillsBuiltinCalculatorDesc',
    icon: 'calculator',
    identifier: 'lobe-calculator',
    titleKey: 'skillsBuiltinCalculatorTitle',
    type: 'builtinTool',
  },
];

export const MOBILE_RECOMMENDED_BUILTIN_IDS = MOBILE_RECOMMENDED_BUILTIN_SKILLS.map(
  (skill) => skill.identifier,
);
