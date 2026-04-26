export * from './formatSearchResults';

/**
 * User memory item interfaces
 */
export interface UserMemoryContextItem {
  description?: string | null;
  id?: string;
  title?: string | null;
}

export interface UserMemoryExperienceItem {
  action?: string | null;
  id?: string;
  keyLearning?: string | null;
  situation?: string | null;
}

export interface UserMemoryPreferenceItem {
  conclusionDirectives?: string | null;
  id?: string;
  suggestions?: string | null;
}

export interface UserMemoryActivityItem {
  endsAt?: string | Date | null;
  feedback?: string | null;
  id?: string;
  narrative?: string | null;
  notes?: string | null;
  startsAt?: string | Date | null;
  status?: string | null;
  timezone?: string | null;
  type?: string | null;
}

export type IdentityType = 'demographic' | 'personal' | 'professional';

export interface UserMemoryIdentityItem {
  capturedAt?: string | Date | null;
  description?: string | null;
  id?: string;
  role?: string | null;
  type?: IdentityType | string | null;
}

export interface UserMemoryPersonaItem {
  narrative?: string | null;
  tagline?: string | null;
}

export interface UserMemoryData {
  activities?: UserMemoryActivityItem[];
  contexts?: UserMemoryContextItem[];
  experiences?: UserMemoryExperienceItem[];
  identities?: UserMemoryIdentityItem[];
  persona?: UserMemoryPersonaItem;
  preferences?: UserMemoryPreferenceItem[];
}

export interface PromptUserMemoryOptions {
  /** User memories data */
  memories: UserMemoryData;
}

/**
 * Check if a context item has meaningful content
 */
const isValidContextItem = (item: UserMemoryContextItem): boolean => {
  return !!(item.id || item.title || item.description);
};

/**
 * Formats a single context memory item
 * title as attribute, description as children
 */
const formatContextItem = (item: UserMemoryContextItem): string => {
  return `  <context id="${item.id || ''}" title="${item.title || ''}">${item.description || ''}</context>`;
};

/**
 * Check if an experience item has meaningful content
 */
const isValidExperienceItem = (item: UserMemoryExperienceItem): boolean => {
  return !!(item.id || item.situation || item.keyLearning || item.action);
};

/**
 * Formats a single experience memory item
 */
const formatExperienceItem = (item: UserMemoryExperienceItem): string => {
  const children = [
    `    <situation>${item.situation || ''}</situation>`,
    `    <key_learning>${item.keyLearning || ''}</key_learning>`,
  ];

  if (item.action) {
    children.push(`    <action>${item.action}</action>`);
  }

  return `  <experience id="${item.id || ''}">
${children.join('\n')}
  </experience>`;
};

/**
 * Check if a preference item has meaningful content
 */
const isValidPreferenceItem = (item: UserMemoryPreferenceItem): boolean => {
  return !!item.conclusionDirectives;
};

/**
 * Formats a single preference memory item
 */
const formatPreferenceItem = (item: UserMemoryPreferenceItem): string => {
  if (item.suggestions) {
    return `  <preference id="${item.id || ''}">
    <conclusion_directives>${item.conclusionDirectives}</conclusion_directives>
    <suggestions>${item.suggestions}</suggestions>
  </preference>`;
  }

  return `  <preference id="${item.id || ''}">${item.conclusionDirectives}</preference>`;
};

/**
 * Check if an activity item has meaningful content
 */
const isValidActivityItem = (item: UserMemoryActivityItem): boolean => {
  return !!(
    item.id ||
    item.type ||
    item.status ||
    item.timezone ||
    item.startsAt ||
    item.endsAt ||
    item.narrative ||
    item.notes ||
    item.feedback
  );
};

const formatDateTime = (value: string | Date): string => {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
};

/**
 * Formats a single activity memory item
 */
const formatActivityItem = (item: UserMemoryActivityItem): string => {
  const idAttr = item.id ? ` id="${item.id}"` : '';
  const typeAttr = item.type ? ` type="${item.type}"` : '';
  const statusAttr = item.status ? ` status="${item.status}"` : '';
  const timezoneAttr = item.timezone ? ` timezone="${item.timezone}"` : '';
  const startsAtAttr = item.startsAt ? ` startsAt="${formatDateTime(item.startsAt)}"` : '';
  const endsAtAttr = item.endsAt ? ` endsAt="${formatDateTime(item.endsAt)}"` : '';
  const content = [
    item.narrative ? `    <narrative>${item.narrative}</narrative>` : undefined,
    item.notes ? `    <notes>${item.notes}</notes>` : undefined,
    item.feedback ? `    <feedback>${item.feedback}</feedback>` : undefined,
  ]
    .filter(Boolean)
    .join('\n');

  return `  <activity${idAttr}${typeAttr}${statusAttr}${timezoneAttr}${startsAtAttr}${endsAtAttr}>
${content}
  </activity>`;
};

/**
 * Check if an identity item has meaningful content
 */
const isValidIdentityItem = (item: UserMemoryIdentityItem): boolean => {
  return !!(item.id || item.description || item.role || item.type);
};

/**
 * Formats a single identity memory item
 */
const formatDateOnly = (value: string | Date): string => {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10); // "2025-02-23"
};

const formatIdentityItem = (item: UserMemoryIdentityItem): string => {
  const typeAttr = item.type ? ` type="${item.type}"` : '';
  const roleAttr = item.role ? ` role="${item.role}"` : '';
  const idAttr = item.id ? ` id="${item.id}"` : '';
  const capturedAtAttr = item.capturedAt ? ` capturedAt="${formatDateOnly(item.capturedAt)}"` : '';
  return `  <identity${typeAttr}${roleAttr}${idAttr}${capturedAtAttr}>${item.description || ''}</identity>`;
};

/**
 * Check if a persona item has meaningful content
 */
const isValidPersonaItem = (item?: UserMemoryPersonaItem | null): item is UserMemoryPersonaItem => {
  if (!item) return false;
  return !!(item.narrative || item.tagline);
};

/**
 * Formats a persona memory item as XML
 */
const formatPersonaItem = (item: UserMemoryPersonaItem): string => {
  const taglineAttr = item.tagline ? ` tagline="${item.tagline}"` : '';
  return `<persona${taglineAttr}>\n${item.narrative || ''}\n</persona>`;
};

/**
 * Format user memories as unified XML prompt
 *
 * The memories are organized into four categories:
 * - identities: User's identity information (who the user is)
 * - contexts: Background information about the user's situation
 * - experiences: Past interactions and learnings
 * - preferences: User's stated preferences and directives
 */
export const promptUserMemory = ({ memories }: PromptUserMemoryOptions): string => {
  // Filter out empty/invalid items
  const activities = (memories.activities || []).filter(isValidActivityItem);
  const hasPersona = isValidPersonaItem(memories.persona);
  const identities = (memories.identities || []).filter(isValidIdentityItem);
  const contexts = (memories.contexts || []).filter(isValidContextItem);
  const experiences = (memories.experiences || []).filter(isValidExperienceItem);
  const preferences = (memories.preferences || []).filter(isValidPreferenceItem);

  const hasActivities = activities.length > 0;
  const hasIdentities = identities.length > 0;
  const hasContexts = contexts.length > 0;
  const hasExperiences = experiences.length > 0;
  const hasPreferences = preferences.length > 0;

  // If no memories at all, return empty
  if (
    !hasActivities &&
    !hasPersona &&
    !hasIdentities &&
    !hasContexts &&
    !hasExperiences &&
    !hasPreferences
  ) {
    return '';
  }

  const contentParts: string[] = [
    '<instruction>The following are memories about this user retrieved from previous conversations. Use this information to personalize your responses and maintain continuity.</instruction>',
  ];

  // Add persona section (highest-level user context)
  if (hasPersona) {
    contentParts.push(formatPersonaItem(memories.persona!));
  }

  // Add identities section (user's identity information)
  if (hasIdentities) {
    const identitiesXml = identities.map((item) => formatIdentityItem(item)).join('\n');
    contentParts.push(`<identities count="${identities.length}">
${identitiesXml}
</identities>`);
  }

  // Add activities section
  if (hasActivities) {
    const activitiesXml = activities.map((item) => formatActivityItem(item)).join('\n');
    contentParts.push(`<activities count="${activities.length}">
${activitiesXml}
</activities>`);
  }

  // Add contexts section
  if (hasContexts) {
    const contextsXml = contexts.map((item) => formatContextItem(item)).join('\n');
    contentParts.push(`<contexts count="${contexts.length}">
${contextsXml}
</contexts>`);
  }

  // Add experiences section
  if (hasExperiences) {
    const experiencesXml = experiences.map((item) => formatExperienceItem(item)).join('\n');
    contentParts.push(`<experiences count="${experiences.length}">
${experiencesXml}
</experiences>`);
  }

  // Add preferences section
  if (hasPreferences) {
    const preferencesXml = preferences.map((item) => formatPreferenceItem(item)).join('\n');
    contentParts.push(`<preferences count="${preferences.length}">
${preferencesXml}
</preferences>`);
  }

  return `<user_memory>
${contentParts.join('\n')}
</user_memory>`;
};
