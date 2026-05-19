import AsyncStorage from '@react-native-async-storage/async-storage';

const SKILL_PICKER_STORAGE_KEY = 'mobile.skillPicker.selectedIdentifiers';

const normalizeSelection = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
};

export const loadSkillPickerSelection = async (): Promise<string[]> => {
  try {
    const raw = await AsyncStorage.getItem(SKILL_PICKER_STORAGE_KEY);
    if (!raw) return [];

    return normalizeSelection(JSON.parse(raw));
  } catch {
    return [];
  }
};

export const saveSkillPickerSelection = async (identifiers: Iterable<string>) => {
  const normalized = [...new Set([...identifiers].filter((item) => !!item))];
  await AsyncStorage.setItem(SKILL_PICKER_STORAGE_KEY, JSON.stringify(normalized));
};
