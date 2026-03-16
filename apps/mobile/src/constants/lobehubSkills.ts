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
      'Linear is a modern issue tracking and project management tool designed for high-performance teams to build better software faster',
    icon: 'https://cdn.simpleicons.org/linear/5E6AD2',
    id: 'linear',
    label: 'Linear',
  },
  {
    author: 'LobeHub',
    description:
      'Outlook Calendar is an integrated scheduling tool within Microsoft Outlook that enables users to create appointments, organize meetings with others, and manage their time and events effectively.',
    icon: 'https://hub-apac-1.lobeobjects.space/assets/logos/outlook.svg',
    id: 'microsoft',
    label: 'Outlook Calendar',
  },
  {
    author: 'LobeHub',
    description:
      'X (Twitter) is a social media platform for sharing real-time updates, news, and engaging with your audience through posts, replies, and direct messages.',
    icon: 'https://cdn.simpleicons.org/x/111111',
    id: 'twitter',
    label: 'X (Twitter)',
  },
];
