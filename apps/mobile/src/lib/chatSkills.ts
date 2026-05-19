import type {
  MobileRecommendedBuiltinIcon,
  MobileRecommendedBuiltinSkill,
} from '../constants/recommendedBuiltins';
import type { AgentSkillItem, InstalledPlugin } from '../types';

export interface BuiltinSkillPickerItem {
  description: string;
  icon: MobileRecommendedBuiltinIcon;
  identifier: string;
  title: string;
}

type ResolveBuiltinText = (key: string, fallback: string) => string;

export function buildBuiltinSkillItems(
  builtins: MobileRecommendedBuiltinSkill[],
  resolveText: ResolveBuiltinText,
  uninstalledIdentifiers: string[] = [],
): BuiltinSkillPickerItem[] {
  const hiddenBuiltinIds = new Set(uninstalledIdentifiers);

  return builtins
    .filter((item) => !hiddenBuiltinIds.has(item.identifier))
    .map((item) => ({
      description: resolveText(item.descriptionKey, ''),
      icon: item.icon,
      identifier: item.identifier,
      title: resolveText(item.titleKey, item.identifier),
    }));
}

export function partitionSkillPickerItems(params: {
  builtinItems: BuiltinSkillPickerItem[];
  plugins: InstalledPlugin[];
  skills: AgentSkillItem[];
}) {
  const builtinIds = new Set(params.builtinItems.map((item) => item.identifier));
  const filteredSkills = params.skills.filter((skill) => {
    const identifier = skill.identifier ?? skill.id;
    return Boolean(identifier) && !builtinIds.has(identifier);
  });
  const skillIds = new Set(filteredSkills.map((skill) => skill.identifier).filter(Boolean));
  const filteredPlugins = params.plugins.filter(
    (plugin) => !builtinIds.has(plugin.identifier) && !skillIds.has(plugin.identifier),
  );

  return {
    filteredPlugins,
    filteredSkills,
  };
}
