export interface MobileLobehubSkillProvider {
  author: string;
  description: string;
  icon?: string;
  id: string;
  label: string;
}

export const MOBILE_LOBEHUB_SKILL_PROVIDERS: MobileLobehubSkillProvider[] = [
  {
    author: 'LobeHub',
    description:
      'X (Twitter) is a social media platform for sharing real-time updates, news, and engaging with your audience through posts, replies, and direct messages.',
    icon: 'https://cdn.simpleicons.org/x/111111',
    id: 'twitter',
    label: 'X (Twitter)',
  },
];
