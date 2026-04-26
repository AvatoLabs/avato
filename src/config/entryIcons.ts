import {
  IconAdjustmentsHorizontal,
  IconAiAgent,
  IconAiGateway,
  IconBook2,
  IconBrain,
  IconBulb,
  IconChartHistogram,
  IconChartPie,
  IconChevronDown,
  IconCloud,
  IconCloudNetwork,
  IconCoins,
  IconCompass,
  IconCornerUpRight,
  IconCreditCard,
  IconDatabase,
  IconDeviceDesktop,
  IconDots,
  IconFeather,
  IconFilePencil,
  IconFlask2,
  IconFolderCog,
  IconFolderPlus,
  IconFolders,
  IconGift,
  IconHierarchy3,
  IconHistory,
  IconHome2,
  IconInfoCircle,
  IconKey,
  IconKeyboard,
  IconLayoutGrid,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconMap2,
  IconMessage2,
  IconMessage2Plus,
  IconMicrophone2,
  IconMoon,
  IconPalette,
  IconPaperclip,
  IconPencil,
  IconPhotoAi,
  IconPlugConnected,
  IconPuzzle2,
  IconRefresh,
  IconRobot,
  IconSearch,
  IconSettings,
  IconSettings2,
  IconSun,
  IconTools,
  IconTopologyStar3,
  IconUserCircle,
  IconVideo,
  IconWorld,
  IconWorldOff,
} from '@tabler/icons-react';
import { createElement, type FC } from 'react';

import { WORKSPACE_ICON_STROKE_WIDTH } from '@/const/workspaceVisualTokens';

export type EntryIcon = FC<any>;

/** Tabler stroke prop + lobehub Icon `size.strokeWidth` (see WORKSPACE_ICON_STROKE_WIDTH). */
export const ENTRY_ICON_STROKE = WORKSPACE_ICON_STROKE_WIDTH;

export const createEntryIcon = (IconComponent: EntryIcon): EntryIcon => {
  const WrappedIcon: EntryIcon = (props) =>
    createElement(IconComponent, {
      ...props,
      stroke: props.stroke ?? ENTRY_ICON_STROKE,
    });

  WrappedIcon.displayName = `EntryIcon(${IconComponent.displayName || IconComponent.name || 'Icon'})`;

  return WrappedIcon;
};

export const APP_ENTRY_ICONS = {
  chat: createEntryIcon(IconMessage2),
  community: createEntryIcon(IconCompass),
  home: createEntryIcon(IconHome2),
  image: createEntryIcon(IconPhotoAi),
  me: createEntryIcon(IconUserCircle),
  memory: createEntryIcon(IconBrain),
  page: createEntryIcon(IconFilePencil),
  resource: createEntryIcon(IconFolders),
  search: createEntryIcon(IconSearch),
  settings: createEntryIcon(IconSettings),
  studio: createEntryIcon(IconTopologyStar3),
  video: createEntryIcon(IconVideo),
} as const;

export const SETTINGS_ENTRY_ICONS = {
  about: createEntryIcon(IconInfoCircle),
  advanced: createEntryIcon(IconDots),
  agent: createEntryIcon(IconAiAgent),
  apiKey: createEntryIcon(IconKey),
  beta: createEntryIcon(IconFlask2),
  billing: createEntryIcon(IconCreditCard),
  changelog: createEntryIcon(IconHistory),
  chatAppearance: createEntryIcon(IconMessage2),
  cloud: createEntryIcon(IconCloud),
  common: createEntryIcon(IconPalette),
  docs: createEntryIcon(IconBook2),
  feedback: createEntryIcon(IconFeather),
  funds: createEntryIcon(IconCoins),
  hotkey: createEntryIcon(IconKeyboard),
  image: createEntryIcon(IconPhotoAi),
  memory: createEntryIcon(IconBrain),
  mcpStudio: createEntryIcon(IconPlugConnected),
  plans: createEntryIcon(IconMap2),
  profile: createEntryIcon(IconUserCircle),
  provider: createEntryIcon(IconAiGateway),
  proxy: createEntryIcon(IconCloudNetwork),
  referral: createEntryIcon(IconGift),
  skill: createEntryIcon(IconPuzzle2),
  stats: createEntryIcon(IconChartHistogram),
  storage: createEntryIcon(IconDatabase),
  systemTools: createEntryIcon(IconTools),
  tts: createEntryIcon(IconMicrophone2),
  usage: createEntryIcon(IconChartPie),
} as const;

export const THEME_MODE_ICONS = {
  dark: createEntryIcon(IconMoon),
  light: createEntryIcon(IconSun),
  system: createEntryIcon(IconDeviceDesktop),
} as const;

/** Left rail header: same Tabler family + stroke as APP_ENTRY_ICONS / ACTION_ENTRY_ICONS. */
export const SIDEBAR_HEADER_ICONS = {
  chevronDown: createEntryIcon(IconChevronDown),
  /** ChatGPT-style account row — menu trigger */
  more: createEntryIcon(IconDots),
  toggleCollapse: createEntryIcon(IconLayoutSidebarLeftCollapse),
  toggleExpand: createEntryIcon(IconLayoutSidebarLeftExpand),
} as const;

export const ACTION_ENTRY_ICONS = {
  createAgent: createEntryIcon(IconRobot),
  createGroup: createEntryIcon(IconHierarchy3),
  createPage: createEntryIcon(IconFilePencil),
  integration: createEntryIcon(IconPlugConnected),
  newTopic: createEntryIcon(IconMessage2Plus),
  profile: createEntryIcon(IconSettings2),
  sessionGroup: createEntryIcon(IconFolderPlus),
  sessionGroupConfig: createEntryIcon(IconFolderCog),
  write: createEntryIcon(IconPencil),
} as const;

/** Home / AgentBuilder suggest starter cards — same Tabler + stroke as APP_ENTRY_ICONS. */
export const SUGGEST_QUESTIONS_ICONS = {
  bulb: createEntryIcon(IconBulb),
  cornerUpRight: createEntryIcon(IconCornerUpRight),
  refresh: createEntryIcon(IconRefresh),
} as const;

/** Chat input action bar — same Tabler + stroke as APP_ENTRY_ICONS (replaces Lucide on the toolbar). */
export const CHAT_INPUT_ACTION_ICONS = {
  memory: createEntryIcon(IconBrain),
  modelExtendParams: createEntryIcon(IconSettings2),
  paperclip: createEntryIcon(IconPaperclip),
  params: createEntryIcon(IconAdjustmentsHorizontal),
  tools: createEntryIcon(IconLayoutGrid),
  world: createEntryIcon(IconWorld),
  worldOff: createEntryIcon(IconWorldOff),
} as const;
