/**
 * i18n — Lightweight internationalization for the mobile app.
 *
 * Uses a simple store-based approach (no heavy i18n library needed for RN).
 * Supports: en-US, zh-CN
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export type Locale = 'en-US' | 'zh-CN' | 'zh-TW';

const STORAGE_KEY = 'avato_locale';

// ── Translation keys ────────────────────────────────────────────────
type TranslationKeys = {
  // Common
  cancel: string;
  confirm: string;
  delete: string;
  done: string;
  save: string;
  search: string;

  // Tabs
  tabChats: string;
  tabArtwork: string;
  tabDiscover: string;
  tabMe: string;

  // Chat List
  chatListTitle: string;
  chatListSearch: string;
  chatListEmpty: string;
  chatListEmptyDesc: string;
  chatListNewConversation: string;
  chatSearchNoResults: string;
  chatSearchResults: string;
  chatSearchSearching: string;
  chatListTapToContinue: string;

  // Chat Detail
  chatTitle: string;
  chatThinking: string;
  chatThought: string;
  chatThoughtWithDuration: string;
  chatSearchImages: string;
  chatSearchQueries: string;
  chatSearchSources: string;
  chatImageSearchQueries: string;
  chatToolsTitle: string;
  chatToolRunning: string;
  chatToolDone: string;
  chatToolFailed: string;
  chatToolArguments: string;
  chatToolPending: string;
  chatToolRejected: string;
  chatToolResponse: string;
  chatToolAborted: string;
  chatAskAnything: string;
  chatGenerating: string;
  chatEmptyTitle: string;
  chatEmptyDesc: string;

  // Discover
  discoverTitle: string;
  discoverTrending: string;
  discoverSearchPlaceholder: string;
  discoverAgents: string;
  discoverModels: string;
  discoverProviders: string;
  discoverMcp: string;
  discoverNoAgents: string;
  discoverNoAgentsDesc: string;
  discoverComingSoon: string;
  discoverComingSoonDesc: string;
  discoverPopular: string;

  // Me / Profile
  meTitle: string;
  meUser: string;
  meTapToSettings: string;
  meQuickSettings: string;
  meDarkMode: string; // deprecated - kept for compat
  meLanguage: string;
  meTheme: string;
  meConfiguration: string;
  meServerConfig: string;
  meAiProviders: string;
  meAllSettings: string;
  meMoreSettings: string;
  meMoreSettingsDesc: string;
  meAbout: string;
  meHelpFeedback: string;
  meVersion: string;
  meSignOut: string;
  meSignOutConfirm: string;
  meSignOutDesc: string;

  // Server Config
  serverTitle: string;
  serverConnect: string;
  serverSubtitle: string;
  serverDesc: string;
  serverUrlLabel: string;
  serverUrlPlaceholder: string;
  serverQuickFill: string;
  serverTestConnection: string;
  serverTesting: string;
  serverSuccess: string;
  serverFailed: string;
  serverConnectStart: string;
  serverSaveConfig: string;
  serverTips: string;

  // Chat Settings
  chatSettingsTitle: string;
  chatSettingsModel: string;
  chatSettingsModelHint: string;
  chatSettingsTemperature: string;
  chatSettingsTopP: string;
  chatSettingsFrequencyPenalty: string;
  chatSettingsPresencePenalty: string;
  chatSettingsMaxTokens: string;
  chatSettingsEnableMaxTokens: string;
  chatSettingsModelParams: string;
  chatSettingsSystemPrompt: string;
  chatSettingsCustomInstructions: string;
  chatSettingsSystemPromptPlaceholder: string;
  chatSettingsDangerZone: string;
  chatSettingsClearHistory: string;
  chatSettingsDeleteConversation: string;
  chatSettingsDeleteConfirm: string;
  chatSettingsDeleteDesc: string;
  chatSettingsClearConfirm: string;
  chatSettingsClearDesc: string;

  // Notebook
  notebookTitle: string;
  notebookEmpty: string;
  notebookNewDoc: string;
  notebookDocTitle: string;
  notebookDocTitlePlaceholder: string;
  notebookDeleteConfirm: string;
  notebookDeleteDesc: string;
  notebookSaved: string;

  // Settings
  settingsTitle: string;
  settingsServer: string;
  settingsServerConfig: string;
  settingsServerConfigDesc: string;
  settingsAiConfig: string;
  settingsAiProviders: string;
  settingsAiProvidersDesc: string;
  settingsDefaultModel: string;
  settingsDefaultAgent: string;
  settingsGeneral: string;
  settingsLanguage: string;
  settingsTheme: string;
  settingsDataStorage: string;
  settingsSyncBackup: string;
  settingsNotConfigured: string;
  settingsStorageManagement: string;
  settingsStorageManagementDesc: string;
  settingsVoice: string;
  settingsSpeechRecognition: string;
  settingsTts: string;
  settingsAbout: string;
  settingsPrivacyPolicy: string;
  settingsAboutAvato: string;
  settingsAboutAvatoDesc: string;

  // AI Providers
  aiProvidersTitle: string;
  aiProvidersDesc: string;
  aiProvidersAddKey: string;
  aiProvidersApiKey: string;
  aiProvidersEndpoint: string;
  aiProvidersSave: string;
  aiProvidersEnabled: string;

  // Model Picker
  modelPickerTitle: string;
  modelPickerSearch: string;
  modelPickerRecent: string;
  modelPickerAll: string;

  // Language
  languageTitle: string;

  // Theme
  themeTitle: string;
  themeLight: string;
  themeDark: string;
  themeSystem: string;
  themeDesc: string;

  // Home / Command Surface
  homeHeroPlaceholder: string;
  homeQuickWrite: string;
  homeQuickCode: string;
  homeQuickAnalyze: string;
  homeQuickCreate: string;
  homeRecents: string;
  homeSeeAll: string;
  homeAssistants: string;
  homeStartChat: string;

  // Studio / Capability Hub
  studioTitle: string;
  studioFeatured: string;
  studioAssistants: string;
  studioModels: string;
  studioTools: string;
  studioViewAll: string;

  // Workspace
  workspaceTitle: string;
  workspaceRuntime: string;
  workspaceModel: string;
  workspaceEndpoint: string;
  workspacePreferences: string;
  workspaceSystem: string;
  workspaceConnected: string;
  workspaceNotConnected: string;
  workspaceProviders: string;

  // Message Actions
  msgActionCopy: string;
  msgActionEdit: string;
  msgActionRegenerate: string;
  msgActionDelete: string;
  msgActionDeleteConfirm: string;
  msgActionCopied: string;
  msgActionSaveToTopic: string;
  msgStatTokens: string;
  msgStatUncachedInput: string;
  msgStatCachedInput: string;
  msgStatOutput: string;
  msgStatTotal: string;
  msgStatTPS: string;
  msgStatTTFT: string;

  // Topics
  topicTitle: string;
  topicCreate: string;
  topicCreatePlaceholder: string;
  topicEmpty: string;
  topicEmptyDesc: string;
  topicDeleteConfirm: string;
  topicSearch: string;

  // Session Groups
  groupTitle: string;
  groupCreate: string;
  groupCreatePlaceholder: string;
  groupRename: string;
  groupDelete: string;
  groupDeleteConfirm: string;
  groupMoveSession: string;
  groupPinned: string;
  groupDefault: string;
  groupManage: string;

  // Discover (extended)
  discoverUseAgent: string;
  discoverAgentDetail: string;
  discoverModelDetail: string;
  discoverProviderDetail: string;
  discoverFeatured: string;
  discoverAll: string;
  discoverNoResults: string;

  // File / Attachment
  fileAttach: string;
  fileCamera: string;
  fileGallery: string;
  fileDocument: string;
  fileUploading: string;
  fileUploadFailed: string;

  // Onboarding
  onboardingWelcome: string;
  onboardingWelcomeDesc: string;
  onboardingGetStarted: string;
  onboardingSetupProvider: string;
  onboardingSetupProviderDesc: string;
  onboardingSkip: string;
  onboardingComplete: string;
  onboardingCompleteDesc: string;
  onboardingStartChatting: string;

  // Profile Edit
  profileEdit: string;
  profileTitle: string;
  profileAccount: string;
  profileAvatar: string;
  profileFullName: string;
  profileUsername: string;
  profileBio: string;
  profileSaved: string;
  profileInterests: string;
  profileInterestsWriting: string;
  profileInterestsCoding: string;
  profileInterestsDesign: string;
  profileInterestsEducation: string;
  profileInterestsBusiness: string;
  profileInterestsMarketing: string;
  profileInterestsProduct: string;
  profileInterestsSales: string;
  profileInterestsOther: string;
  profileInterestsCustomPlaceholder: string;
  profileEmail: string;
  profileEmailDisplay: string;
  profileUpdateEmail: string;
  profileEmailPlaceholder: string;
  profileEmailInvalid: string;
  profileEmailChangeSent: string;
  profilePassword: string;
  profileSetPassword: string;
  profileChangePassword: string;
  profilePasswordResetSent: string;
  profilePasswordResetError: string;
  profileUsernameRule: string;
  profileUsernameDuplicate: string;

  // Data Management
  dataManageTitle: string;
  dataManageClearCache: string;
  dataManageExport: string;
  dataManageResetApp: string;
  dataManageResetConfirm: string;
  dataManageResetDesc: string;
  dataManageComingSoon: string;

  // Toast messages
  toastSessionCreated: string;
  toastSessionDeleted: string;
  toastMessageDeleted: string;
  toastCopied: string;
  toastPinned: string;
  toastUnpinned: string;
  toastTopicCreated: string;
  toastTopicDeleted: string;
  toastSaved: string;
  toastFilePicked: string;
  toastConnectionRestored: string;

  // Error messages
  errorNetwork: string;
  errorServer: string;
  errorAuth: string;
  errorTimeout: string;
  errorUnknown: string;
  errorRetry: string;
  errorOffline: string;
  errorSendFailed: string;
  errorDeleteFailed: string;
  errorEditFailed: string;
  errorSaveFailed: string;
  loginChangeServer: string;
  loginContinueWithEmail: string;
  loginContinueWithProvider: string;
  loginFeishuConfigMismatch: string;
  loginMissingProviders: string;
  loginProviderFailed: string;
  loginProviderLaunchFailed: string;
  loginIncomplete: string;
  loginOpenInBrowser: string;
  loginOpenInProviderApp: string;
  loginQrHint: string;
  loginScanWithProvider: string;
  loginSubtitle: string;
  loginTitle: string;
  loginUnsupportedDesc: string;
  loginUnsupportedTitle: string;

  // Confirmation dialogs
  deleteSessionConfirm: string;
  deleteSessionDesc: string;
  deleteMessageConfirm: string;
  deleteMessageDesc: string;

  // Personalization
  greetingMorning: string;
  greetingAfternoon: string;
  greetingEvening: string;
  greetingNight: string;
  welcomeBack: string;
  streakMessage: string;
  statsMessages: string;
  statsSessions: string;
  statsStreak: string;

  // Gap-fix: missing i18n keys
  editCancel: string;
  editSave: string;
  dataClearCacheSubtitle: string;
  dataResetSubtitle: string;
  dataCacheCleared: string;
  providerSavedTitle: string;
  providerSavedDesc: string;
  validationError: string;
  validationEnterUrl: string;
  settingsSavedModel: string;
  settingsSavedChat: string;
  fileUploadError: string;

  // Dark mode gap-fix: additional i18n keys
  actionPin: string;
  actionUnpin: string;
  actionFavorite: string;
  actionUnfavorite: string;

  // Hardcode audit — new keys
  topicAllMessages: string;
  statusActive: string;
  statusInactive: string;
  badgeVision: string;
  badgeTools: string;
  loading: string;
  groupEmpty: string;
  groupEmptyDesc: string;
  groupDeleteAll: string;
  groupDeleteAllConfirm: string;
  groupSessionCount: string;
  serverHealthcheckFailed: string;
  serverConnectionFailed: string;
  profileChangePhoto: string;
  profileSaveFailed: string;
  providerCountActive: string;
  meAllSettingsDesc: string;
  aboutDescription: string;
  aboutLinks: string;
  aboutGithubRepository: string;
  aboutOfficialWebsite: string;
  aboutSponsor: string;
  aboutBuiltOn: string;
  aboutMadeWith: string;

  // Humanization — small details
  chatSuggest1: string;
  chatSuggest2: string;
  chatSuggest3: string;
  chatSuggest4: string;
  chatHint1: string;
  chatHint2: string;
  chatHint3: string;
  chatHint4: string;
  streakCelebrate: string;
  activeChats: string;
  chatEmptyWave: string;
  relativeTimeNow: string;
  relativeTimeMinutes: string;
  relativeTimeHours: string;
  relativeTimeDays: string;

  // Gap-fix round 2
  actionRename: string;
  sessionRenamed: string;
  sessionRenameTitle: string;
  sessionRenamePlaceholder: string;
  topicRename: string;
  topicRenamed: string;
  topicRenamePlaceholder: string;
  modelPickerOffline: string;

  // Chat toolbar actions
  chatClearTitle: string;
  chatClearMessage: string;
  chatClearConfirm: string;
  chatSearchOn: string;
  chatSearchOff: string;
  toastCleared: string;

  // Provider Detail
  providerDetailTitle: string;
  providerDetailApiKey: string;
  providerDetailEndpoint: string;
  providerDetailSave: string;
  providerDetailSaved: string;
  providerDetailNoModels: string;
  providerDetailEnabled: string;
  providerDetailDisabled: string;
  providerDetailFetchOnClient: string;
  providerDetailFetchOnClientDesc: string;
  providerDetailChecking: string;
  providerDetailCheckSuccess: string;
  providerDetailCheckFailed: string;
  providerDetailDescription: string;
  providerDetailAccessKeyId: string;
  providerDetailSecretAccessKey: string;
  providerDetailSessionToken: string;
  providerDetailUsername: string;
  providerDetailPassword: string;
  providerDetailBearerToken: string;
  providerDetailApiProxyUrl: string;
  providerDetailBaseUrlOrAccountId: string;
  providerDetailRegion: string;
  providerDetailApiVersion: string;
  providerDetailPlaceholderGeneric: string;
  providerDetailPlaceholderApiKey: string;
  providerDetailPlaceholderAccessKeyId: string;
  providerDetailPlaceholderBaseUrl: string;
  providerDetailPlaceholderEndpoint: string;
  providerDetailPlaceholderRegion: string;
  providerDetailPlaceholderApiVersion: string;

  // Resources / Files
  resourceTitle: string;
  resourceTabAll: string;
  resourceTabImages: string;
  resourceTabDocuments: string;
  resourceTabOthers: string;
  resourceEmpty: string;
  resourceEmptyDesc: string;
  resourceUpload: string;
  resourceUploadPhoto: string;
  resourceUploadFile: string;
  resourceDeleting: string;
  resourceDeleteConfirm: string;
  resourceDeleteDesc: string;
  resourceUploadFailed: string;
  resourceDeleteFailed: string;
  resourceBytes: string;
  resourceKB: string;
  resourceMB: string;
  resourceGB: string;

  // Skills
  skillsTitle: string;
  skillsDesc: string;
  skillsIntegrations: string;
  skillsCommunityMcp: string;
  skillsCustom: string;
  skillsEmpty: string;
  skillsEmptyDesc: string;
  skillsInstalled: string;
  skillsNotInstalled: string;
  skillsInstall: string;
  skillsUninstall: string;
  skillsUninstallConfirm: string;
  skillsUninstallDesc: string;
  skillsConfigure: string;
  skillsImport: string;
  skillsImportUrl: string;
  skillsImportGithub: string;
  skillsImportUrlPlaceholder: string;
  skillsImportGithubPlaceholder: string;
  skillsImportSuccess: string;
  skillsImportFailed: string;
  skillsImporting: string;
  skillsInstallSuccess: string;
  skillsInstallFailed: string;
  skillsAddCustomMcp: string;
  skillsCustomMcpName: string;
  skillsCustomMcpNamePlaceholder: string;
  skillsCustomMcpUrl: string;
  skillsCustomMcpUrlPlaceholder: string;
  skillsCustomMcpSaved: string;
  skillsDelete: string;
  skillsDeleteConfirm: string;
  skillsDeleteDesc: string;
  skillsBuiltin: string;
  skillsCommunity: string;
  skillsUser: string;
  skillsMarket: string;
  skillsMcp: string;
  skillsAgentSkill: string;
  skillsPlugin: string;
  skillsMarketTitle: string;
  skillsMarketSearch: string;
  skillsMarketEmpty: string;
  skillsMarketUnavailable: string;
  skillsMarketFeatured: string;
  skillsMarketConnect: string;
  skillsMarketConnected: string;
  retry: string;
  skillsMarketInstalled: string;
  skillsMarketInstalledDesc: string;
  skillsDetailContent: string;
  skillsDetailManifest: string;
  skillsDetailNotFound: string;
  skillsStore: string;
  skillsMemorySource: string;
  skillsUploadZip: string;
  skillsCustomMcpQuickImport: string;
  skillsCustomMcpQuickImportPlaceholder: string;
  skillsCustomMcpQuickImportError: string;
  skillsCustomMcpQuickImportInvalidJson: string;
  skillsCustomMcpQuickImportInvalidStructure: string;
  skillsCustomMcpIdentifier: string;
  skillsCustomMcpIdentifierPlaceholder: string;
  skillsCustomMcpIdentifierRequired: string;
  skillsCustomMcpIdentifierInvalid: string;
  skillsCustomMcpUrlRequired: string;
  skillsCustomMcpUrlInvalid: string;
  skillsCustomMcpAuth: string;
  skillsCustomMcpAuthNone: string;
  skillsCustomMcpAuthBearer: string;
  skillsCustomMcpToken: string;
  skillsCustomMcpTokenPlaceholder: string;
  skillsCustomMcpHeaders: string;
  skillsCustomMcpHeadersAdd: string;
  skillsCustomMcpHeaderKey: string;
  skillsCustomMcpHeaderValue: string;
  skillsCustomMcpAdvanced: string;
  skillsCustomMcpTestConnection: string;
  skillsCustomMcpTesting: string;
  skillsCustomMcpTestSuccess: string;
  skillsCustomMcpTestFailed: string;
  skillsCustomMcpDesc: string;
  skillsCustomMcpDescPlaceholder: string;
  skillsCustomMcpAvatar: string;
  skillsCustomMcpAvatarPlaceholder: string;

  // Stats
  statsTitle: string;
  statsOverview: string;
  statsTotalMessages: string;
  statsTotalSessions: string;
  statsTotalTopics: string;
  statsTotalWords: string;
  statsVsPrevMonth: string;
  statsWelcome: string;
  statsRegisteredDays: string;
  statsCreatedAt: string;
  statsUpdatedAt: string;
  statsActivity: string;
  statsActiveDays: string;
  statsHotDays: string;
  statsModelsRank: string;
  statsAssistantsRank: string;
  statsTopicsRank: string;
  statsRankCount: string;
  statsRankName: string;
  statsEmpty: string;
  statsEmptyDesc: string;
  statsViewAll: string;

  // Memory
  memoryTitle: string;
  memoryDesc: string;
  memoryRoles: string;
  memoryToolOffTitle: string;
  memoryToolOffDesc: string;
  memoryToolOnTitle: string;
  memoryToolOnDesc: string;
  memoryToolEffortTitle: string;
  memoryToolEffortDesc: string;
  memoryToolEffortLow: string;
  memoryToolEffortMedium: string;
  memoryToolEffortHigh: string;
  memoryHome: string;
  memoryIdentity: string;
  memoryContext: string;
  memoryActivity: string;
  memoryExperience: string;
  memoryPreference: string;
  memoryEmpty: string;
  memoryEmptyDesc: string;
  memoryPersona: string;
  memoryPersonaEmpty: string;
  memorySearch: string;
  memoryDeleteConfirm: string;
  memoryDeleteDesc: string;
  memoryDeleted: string;
  memoryDetail: string;
  memoryType: string;
  memoryTags: string;
  memoryCapturedAt: string;
  memoryCreatedAt: string;
  memoryUpdatedAt: string;
  memorySummary: string;
  memoryNarrative: string;
  memoryNotes: string;
  memoryFeedback: string;
  memorySituation: string;
  memoryAction: string;
  memoryKeyLearning: string;
  memoryReasoning: string;
  memoryOutcome: string;
  memoryConclusion: string;
  memorySuggestions: string;
  memoryDescription: string;
  memoryStatus: string;
  memoryImpact: string;
  memoryUrgency: string;
  memoryPriority: string;
  memoryConfidence: string;
  memoryStartsAt: string;
  memoryEndsAt: string;
  memoryTimezone: string;
  memoryAssociatedObjects: string;
  memoryAssociatedSubjects: string;
  memoryAssociatedLocations: string;
  memoryTotalCount: string;
  memoryEdit: string;
  memorySave: string;
  memorySaved: string;
  memoryCreateIdentity: string;
  memoryCreateTitle: string;
  memoryCreateTitlePlaceholder: string;
  memoryCreateSummary: string;
  memoryCreateSummaryPlaceholder: string;
  memoryCreateSave: string;
  memoryExtractTitle: string;
  memoryExtractDesc: string;
  memoryExtractAction: string;
  memoryExtractQueued: string;
  memoryExtractRunning: string;
  memoryExtractReady: string;
  memoryExtractRetry: string;
  memoryExtractProgress: string;
  memoryExtractProgressUnknown: string;
  memoryExtractFailed: string;
  memoryExtractSuccess: string;

  // Artwork / Image Generation
  artworkTitle: string;
  artworkEmpty: string;
  artworkEmptyDesc: string;
  artworkModel: string;
  artworkReferenceImages: string;
  artworkReferenceImagesDesc: string;
  artworkResolution: string;
  artworkAspectRatio: string;
  artworkImageCount: string;
  artworkPromptPlaceholder: string;
  artworkGenerate: string;
  artworkGenerating: string;
  artworkTopics: string;
  artworkTopicsEmpty: string;
  artworkNewTopic: string;
  artworkDeleteTopic: string;
  artworkDeleteTopicConfirm: string;
  artworkDeleteBatch: string;
  artworkDeleteBatchConfirm: string;
  artworkCopyPrompt: string;
  artworkPromptCopied: string;
  artworkPending: string;
  artworkProcessing: string;
  artworkSuccess: string;
  artworkError: string;
  artworkErrorDesc: string;
  artworkNoModels: string;
  artworkNoModelsDesc: string;
  artworkSelectModel: string;
  artworkImageCountCustom: string;
};

const en: TranslationKeys = {
  cancel: 'Cancel',
  confirm: 'Confirm',
  delete: 'Delete',
  done: 'Done',
  save: 'Save',
  search: 'Search',

  tabChats: 'Chats',
  tabArtwork: 'Artwork',
  tabDiscover: 'Discover',
  tabMe: 'Me',

  chatListTitle: 'Avato',
  chatListSearch: 'Search conversations...',
  chatListEmpty: 'Start a conversation',
  chatListEmptyDesc: 'Tap the + button above to create your first chat with Avato AI.',
  chatListNewConversation: 'New Conversation',
  chatSearchNoResults: 'No matching conversations',
  chatSearchResults: 'Search Results',
  chatSearchSearching: 'Searching conversations...',
  chatListTapToContinue: 'Tap to continue the conversation',

  chatTitle: 'Chat',
  chatThinking: 'Thinking...',
  chatThought: 'Thought',
  chatThoughtWithDuration: 'Thought for',
  chatSearchImages: 'Image results',
  chatSearchQueries: 'Search queries',
  chatSearchSources: 'Web sources',
  chatImageSearchQueries: 'Image search queries',
  chatToolsTitle: 'Tools',
  chatToolRunning: 'Running',
  chatToolDone: 'Completed',
  chatToolFailed: 'Failed',
  chatToolArguments: 'Arguments',
  chatToolPending: 'Pending approval',
  chatToolRejected: 'Rejected',
  chatToolResponse: 'Response',
  chatToolAborted: 'Aborted',
  chatAskAnything: 'Ask anything...',
  chatGenerating: 'Generating...',
  chatEmptyTitle: 'Avato Assistant',
  chatEmptyDesc: 'Ready to brainstorm, debug, or chat. Send a message to begin.',

  discoverTitle: 'Discover',
  discoverTrending: 'Trending',
  discoverSearchPlaceholder: 'Search agents, models...',
  discoverAgents: 'Agents',
  discoverModels: 'Models',
  discoverProviders: 'Providers',
  discoverMcp: 'MCP',
  discoverNoAgents: 'No agents found',
  discoverNoAgentsDesc: 'Try adjusting your search or check back later.',
  discoverComingSoon: 'Coming Soon',
  discoverComingSoonDesc: 'browsing will be available in a future update.',
  discoverPopular: 'Popular',

  meTitle: 'Me',
  meUser: 'Avato User',
  meTapToSettings: 'Tap to view settings',
  meQuickSettings: 'Quick Settings',
  meDarkMode: 'Dark Mode',
  meLanguage: 'Language',
  meTheme: 'Theme',
  meConfiguration: 'Configuration',
  meServerConfig: 'Server Configuration',
  meAiProviders: 'AI Providers',
  meAllSettings: 'All Settings',
  meMoreSettings: 'More Settings',
  meMoreSettingsDesc: 'Data, Voice, About & other settings',
  meAbout: 'About',
  meHelpFeedback: 'Help & Feedback',
  meVersion: 'Version',
  meSignOut: 'Sign Out',
  meSignOutConfirm: 'Sign Out',
  meSignOutDesc: 'Are you sure you want to sign out? This will clear your server configuration.',

  serverTitle: 'Server Configuration',
  serverConnect: 'Connect to Avato',
  serverSubtitle: 'Enter your self-hosted server address',
  serverDesc:
    'Avato runs on your own server. Enter the address of your self-hosted Avato instance (e.g., avato.turingmesh.com or 192.168.1.100:3010).',
  serverUrlLabel: 'Server URL',
  serverUrlPlaceholder: 'avato.turingmesh.com',
  serverQuickFill: 'Quick Fill',
  serverTestConnection: 'Test Connection',
  serverTesting: 'Testing...',
  serverSuccess: 'Connection successful! Server is reachable.',
  serverFailed: 'Connection failed',
  serverConnectStart: 'Connect & Start',
  serverSaveConfig: 'Save Configuration',
  serverTips:
    '💡 Make sure your phone and server are on the same network. Your Avato server should expose the tRPC mobile endpoint (/trpc/mobile).',

  chatSettingsTitle: 'Chat Settings',
  chatSettingsModel: 'Model',
  chatSettingsModelHint: 'Popular: gpt-4o, gpt-4o-mini, claude-3.5-sonnet, deepseek-chat',
  chatSettingsTemperature: 'Temperature',
  chatSettingsTopP: 'Top P',
  chatSettingsFrequencyPenalty: 'Frequency Penalty',
  chatSettingsPresencePenalty: 'Presence Penalty',
  chatSettingsMaxTokens: 'Max Tokens',
  chatSettingsEnableMaxTokens: 'Enable Max Tokens',
  chatSettingsModelParams: 'Model Parameters',
  chatSettingsSystemPrompt: 'System Prompt',
  chatSettingsCustomInstructions: 'Custom Instructions',
  chatSettingsSystemPromptPlaceholder: 'Enter a custom system prompt to define the assistant\'s behavior...',
  chatSettingsDangerZone: 'Danger Zone',
  chatSettingsClearHistory: 'Clear Chat History',
  chatSettingsDeleteConversation: 'Delete Conversation',
  chatSettingsDeleteConfirm: 'Delete Conversation',
  chatSettingsDeleteDesc: 'Are you sure you want to delete this conversation? This action cannot be undone.',
  chatSettingsClearConfirm: 'Clear History',
  chatSettingsClearDesc: 'This will clear all messages in this conversation.',

  notebookTitle: 'Notebook',
  notebookEmpty: 'No documents yet',
  notebookNewDoc: 'New Document',
  notebookDocTitle: 'Title',
  notebookDocTitlePlaceholder: 'Document title...',
  notebookDeleteConfirm: 'Delete Document',
  notebookDeleteDesc: 'Are you sure you want to delete this document?',
  notebookSaved: 'Document saved',

  settingsTitle: 'Settings',
  settingsServer: 'Server',
  settingsServerConfig: 'Server Configuration',
  settingsServerConfigDesc: 'Configure your Avato server URL',
  settingsAiConfig: 'AI Configuration',
  settingsAiProviders: 'AI Providers',
  settingsAiProvidersDesc: 'Manage API keys & provider settings',
  settingsDefaultModel: 'Default Model',
  settingsDefaultAgent: 'Default Agent',
  settingsGeneral: 'General',
  settingsLanguage: 'Language',
  settingsTheme: 'Theme',
  settingsDataStorage: 'Data & Storage',
  settingsSyncBackup: 'Sync & Backup',
  settingsNotConfigured: 'Not configured',
  settingsStorageManagement: 'Storage Management',
  settingsStorageManagementDesc: 'Manage local data',
  settingsVoice: 'Voice',
  settingsSpeechRecognition: 'Speech Recognition',
  settingsTts: 'Text-to-Speech',
  settingsAbout: 'About',
  settingsPrivacyPolicy: 'Privacy Policy',
  settingsAboutAvato: 'About Avato',
  settingsAboutAvatoDesc: 'v1.0.0 • Avato mobile app',

  aiProvidersTitle: 'AI Providers',
  aiProvidersDesc: 'Configure your AI service providers and API keys.',
  aiProvidersAddKey: 'Add API Key',
  aiProvidersApiKey: 'API Key',
  aiProvidersEndpoint: 'Custom Endpoint (optional)',
  aiProvidersSave: 'Save',
  aiProvidersEnabled: 'Enabled',

  modelPickerTitle: 'Select Model',
  modelPickerSearch: 'Search models...',
  modelPickerRecent: 'Recently Used',
  modelPickerAll: 'All Models',

  languageTitle: 'Language',

  themeTitle: 'Theme',
  themeLight: 'Light',
  themeDark: 'Dark',
  themeSystem: 'System',
  themeDesc: 'The app uses the Light theme for the best visual experience.',

  homeHeroPlaceholder: 'What do you want to do?',
  homeQuickWrite: 'Write',
  homeQuickCode: 'Create Agent',
  homeQuickAnalyze: 'Create Group',
  homeQuickCreate: 'Create Art',
  homeRecents: 'Recent',
  homeSeeAll: 'See all',
  homeAssistants: 'Assistants',
  homeStartChat: 'Start Chat',

  studioTitle: 'Studio',
  studioFeatured: 'Featured',
  studioAssistants: 'Assistants',
  studioModels: 'Models',
  studioTools: 'Tools',
  studioViewAll: 'View All',

  workspaceTitle: 'Workspace',
  workspaceRuntime: 'Runtime',
  workspaceModel: 'Default Model',
  workspaceEndpoint: 'Endpoint',
  workspacePreferences: 'Preferences',
  workspaceSystem: 'System',
  workspaceConnected: 'Connected',
  workspaceNotConnected: 'Not connected',
  workspaceProviders: 'Providers',

  msgActionCopy: 'Copy',
  msgActionEdit: 'Edit',
  msgActionRegenerate: 'Regenerate',
  msgActionDelete: 'Delete',
  msgActionDeleteConfirm: 'Delete this message?',
  msgActionCopied: 'Copied',
  msgActionSaveToTopic: 'Save to Topic',
  msgStatTokens: 'tokens',
  msgStatUncachedInput: 'Uncached Input',
  msgStatCachedInput: 'Cached Input',
  msgStatOutput: 'Output',
  msgStatTotal: 'Total Consumption',
  msgStatTPS: 'TPS',
  msgStatTTFT: 'TTFT',

  topicTitle: 'Topics',
  topicCreate: 'New Topic',
  topicCreatePlaceholder: 'Enter topic name...',
  topicEmpty: 'No topics yet',
  topicEmptyDesc: 'Create a topic to organize conversations.',
  topicDeleteConfirm: 'Delete this topic?',
  topicSearch: 'Search topics...',

  groupTitle: 'Session Groups',
  groupCreate: 'New Group',
  groupCreatePlaceholder: 'Enter group name...',
  groupRename: 'Rename Group',
  groupDelete: 'Delete Group',
  groupDeleteConfirm: 'Delete this group? Sessions will be moved to default.',
  groupMoveSession: 'Move to Group',
  groupPinned: 'Pinned',
  groupDefault: 'Default',
  groupManage: 'Manage Groups',

  discoverUseAgent: 'Use Agent',
  discoverAgentDetail: 'Agent Detail',
  discoverModelDetail: 'Model Detail',
  discoverProviderDetail: 'Provider Detail',
  discoverFeatured: 'Featured',
  discoverAll: 'All',
  discoverNoResults: 'No results found',

  fileAttach: 'Attach',
  fileCamera: 'Camera',
  fileGallery: 'Photo Library',
  fileDocument: 'Document',
  fileUploading: 'Uploading...',
  fileUploadFailed: 'Upload failed',

  onboardingWelcome: 'Welcome to Avato',
  onboardingWelcomeDesc: 'Pilot your AI flow.',
  onboardingGetStarted: 'Get Started',
  onboardingSetupProvider: 'Connect Your Server',
  onboardingSetupProviderDesc: 'Enter the URL of your self-hosted Avato instance.',
  onboardingSkip: 'Skip for now',
  onboardingComplete: 'You\'re all set!',
  onboardingCompleteDesc: 'Your workspace is ready. Start chatting with AI.',
  onboardingStartChatting: 'Start Chatting',

  profileEdit: 'Edit Profile',
  profileTitle: 'Profile',
  profileAccount: 'Account',
  profileAvatar: 'Avatar',
  profileFullName: 'Full Name',
  profileUsername: 'Username',
  profileBio: 'Bio',
  profileSaved: 'Profile saved',
  profileInterests: 'Interests',
  profileInterestsWriting: 'Content Creation',
  profileInterestsCoding: 'Programming & Development',
  profileInterestsDesign: 'Design & Creativity',
  profileInterestsEducation: 'Learning & Research',
  profileInterestsBusiness: 'Business & Strategy',
  profileInterestsMarketing: 'Marketing & Promotion',
  profileInterestsProduct: 'Product & Management',
  profileInterestsSales: 'Sales & Customer Relations',
  profileInterestsOther: 'Other Fields',
  profileInterestsCustomPlaceholder: 'Add custom interest...',
  profileEmail: 'Email',
  profileEmailDisplay: 'Email Address',
  profileUpdateEmail: 'Update',
  profileEmailPlaceholder: 'Enter new email address',
  profileEmailInvalid: 'Please enter a valid email address',
  profileEmailChangeSent: 'Verification email sent to new address',
  profilePassword: 'Password',
  profileSetPassword: 'Set Password',
  profileChangePassword: 'Change Password',
  profilePasswordResetSent: 'Password reset email sent',
  profilePasswordResetError: 'Failed to send password reset email',
  profileUsernameRule: 'Only letters, numbers, and underscores',
  profileUsernameDuplicate: 'Username is already taken',

  dataManageTitle: 'Data Management',
  dataManageClearCache: 'Clear Cache',
  dataManageExport: 'Export Data',
  dataManageResetApp: 'Reset App',
  dataManageResetConfirm: 'Reset everything?',
  dataManageResetDesc: 'This will clear all local data including server config, sessions, and preferences.',
  dataManageComingSoon: 'Coming Soon',

  toastSessionCreated: 'Conversation created',
  toastSessionDeleted: 'Conversation deleted',
  toastMessageDeleted: 'Message deleted',
  toastCopied: 'Copied to clipboard',
  toastPinned: 'Pinned',
  toastUnpinned: 'Unpinned',
  toastTopicCreated: 'Topic created',
  toastTopicDeleted: 'Topic deleted',
  toastSaved: 'Saved',
  toastFilePicked: 'File added',
  toastConnectionRestored: 'Connection restored',

  errorNetwork: 'Network error. Please check your connection.',
  errorServer: 'Server error. Please try again later.',
  errorAuth: 'Authentication failed. Please re-configure your server.',
  errorTimeout: 'Request timed out. Please try again.',
  errorUnknown: 'Something went wrong.',
  errorRetry: 'Retry',
  errorOffline: 'You are offline',
  errorSendFailed: 'Failed to send message',
  errorDeleteFailed: 'Failed to delete',
  errorEditFailed: 'Failed to save edit',
  errorSaveFailed: 'Failed to save',
  loginChangeServer: 'Server',
  loginContinueWithEmail: 'Continue with Email or Password',
  loginContinueWithProvider: 'Continue with {provider}',
  loginFeishuConfigMismatch:
    'Feishu mobile sign-in is not configured correctly yet. Check the Android package name and MD5 signature in Feishu Open Platform.',
  loginMissingProviders: 'This server requires SSO sign-in, but no providers are configured.',
  loginProviderFailed: '{provider} sign-in failed. Please try again.',
  loginProviderLaunchFailed: 'Unable to open {provider}. Make sure it is installed and try again.',
  loginIncomplete: 'Sign-in was not completed. Please try again.',
  loginOpenInBrowser: 'Authentication continues in your browser and then returns to the app.',
  loginOpenInProviderApp: 'Authentication continues in {provider} and then returns to the app.',
  loginQrHint: 'Opens a QR code page in your browser.',
  loginScanWithProvider: 'Scan with {provider}',
  loginSubtitle: 'Continue with your server account',
  loginTitle: 'Sign In',
  loginUnsupportedDesc:
    'This server has not enabled OIDC mobile login yet. Configure JWKS_KEY on the server or switch to another server.',
  loginUnsupportedTitle: 'Mobile login is not enabled',

  deleteSessionConfirm: 'Delete Conversation',
  deleteSessionDesc: 'This conversation and all its messages will be permanently deleted.',
  deleteMessageConfirm: 'Delete Message',
  deleteMessageDesc: 'This message will be permanently deleted.',

  greetingMorning: 'Good morning',
  greetingAfternoon: 'Good afternoon',
  greetingEvening: 'Good evening',
  greetingNight: 'Good night',
  welcomeBack: 'Welcome back',
  streakMessage: 'Day {count} streak',
  statsMessages: 'Messages',
  statsSessions: 'Sessions',
  statsStreak: 'Day streak',

  editCancel: 'Cancel',
  editSave: 'Save',
  dataClearCacheSubtitle: 'Remove temporary files and cached data',
  dataResetSubtitle: 'Clear all data and start fresh',
  dataCacheCleared: 'Cache cleared successfully',
  providerSavedTitle: 'Saved',
  providerSavedDesc: '{name} configuration saved.',
  validationError: 'Error',
  validationEnterUrl: 'Please enter a server URL',
  settingsSavedModel: 'Default model updated',
  settingsSavedChat: 'Chat settings saved',
  fileUploadError: 'File upload failed',

  actionPin: 'Pin',
  actionUnpin: 'Unpin',
  actionFavorite: 'Favorite',
  actionUnfavorite: 'Unfavorite',

  topicAllMessages: 'All Messages',
  statusActive: 'Active',
  statusInactive: 'Inactive',
  badgeVision: 'Vision',
  badgeTools: 'Tools',
  loading: 'Loading...',
  groupEmpty: 'No groups yet',
  groupEmptyDesc: 'Create groups to organize your conversations.',
  groupDeleteAll: 'Delete All Groups',
  groupDeleteAllConfirm: 'Delete all groups? Sessions will be moved to default.',
  groupSessionCount: '{count} sessions',
  serverHealthcheckFailed: 'Server responded but healthcheck failed',
  serverConnectionFailed: 'Connection failed',
  profileChangePhoto: 'Change Photo',
  profileSaveFailed: 'Failed to save profile',
  providerCountActive: '{count} active',
  meAllSettingsDesc: 'Server, AI Providers, Data, Voice, About',
  aboutDescription:
    'An open-source, modern-design AI Agent Workspace. Your personal AI companion, running on your own server.',
  aboutLinks: 'Links',
  aboutGithubRepository: 'GitHub Repository',
  aboutOfficialWebsite: 'Official Website',
  aboutSponsor: 'Sponsor',
  aboutBuiltOn: 'Built on {name}',
  aboutMadeWith: 'Made with ❤️ by {name}',

  chatSuggest1: 'Explain a concept',
  chatSuggest2: 'Help me code',
  chatSuggest3: 'Brainstorm ideas',
  chatSuggest4: 'Summarize text',
  chatHint1: 'Try: explain quantum computing...',
  chatHint2: 'Try: write a haiku about code...',
  chatHint3: 'Try: debug this error...',
  chatHint4: 'Try: plan my week...',
  streakCelebrate: '\u{1F525} {count}-day streak!',
  activeChats: '{count} chats',
  chatEmptyWave: 'Hey there \u{1F44B}',
  relativeTimeNow: 'now',
  relativeTimeMinutes: '{count}m',
  relativeTimeHours: '{count}h',
  relativeTimeDays: '{count}d',

  actionRename: 'Rename',
  sessionRenamed: 'Conversation renamed',
  sessionRenameTitle: 'Rename Conversation',
  sessionRenamePlaceholder: 'Enter new name...',
  topicRename: 'Rename Topic',
  topicRenamed: 'Topic renamed',
  topicRenamePlaceholder: 'Enter topic name...',
  modelPickerOffline: 'Showing built-in models. Connect to server for full list.',

  chatClearTitle: 'Clear Messages',
  chatClearMessage: 'This will clear all messages in this conversation. This action cannot be undone.',
  chatClearConfirm: 'Clear',
  chatSearchOn: 'Web search enabled',
  chatSearchOff: 'Web search disabled',
  toastCleared: 'Messages cleared',

  providerDetailTitle: 'Provider Settings',
  providerDetailApiKey: 'API Key',
  providerDetailEndpoint: 'Custom Endpoint',
  providerDetailSave: 'Save Configuration',
  providerDetailSaved: 'Configuration saved',
  providerDetailNoModels: 'No models available',
  providerDetailEnabled: 'Enabled',
  providerDetailDisabled: 'Disabled',
  providerDetailFetchOnClient: 'Client-side Fetch',
  providerDetailFetchOnClientDesc: 'Send requests directly from the client to the provider API',
  providerDetailChecking: 'Checking...',
  providerDetailCheckSuccess: 'Connection successful',
  providerDetailCheckFailed: 'Connection failed',
  providerDetailDescription: 'Description',
  providerDetailAccessKeyId: 'Access Key ID',
  providerDetailSecretAccessKey: 'Secret Access Key',
  providerDetailSessionToken: 'Session Token',
  providerDetailUsername: 'Username',
  providerDetailPassword: 'Password',
  providerDetailBearerToken: 'Bearer Token',
  providerDetailApiProxyUrl: 'API Proxy URL',
  providerDetailBaseUrlOrAccountId: 'Base URL / Account ID',
  providerDetailRegion: 'Region',
  providerDetailApiVersion: 'API Version',
  providerDetailPlaceholderGeneric: 'Enter value...',
  providerDetailPlaceholderApiKey: 'sk-...',
  providerDetailPlaceholderAccessKeyId: 'AKIA...',
  providerDetailPlaceholderBaseUrl: 'https://api.example.com/v1',
  providerDetailPlaceholderEndpoint: 'https://...',
  providerDetailPlaceholderRegion: 'us-east-1',
  providerDetailPlaceholderApiVersion: '2024-02-01',

  // Resources / Files
  resourceTitle: 'Resources',
  resourceTabAll: 'All',
  resourceTabImages: 'Images',
  resourceTabDocuments: 'Documents',
  resourceTabOthers: 'Others',
  resourceEmpty: 'No files yet',
  resourceEmptyDesc: 'Upload images or documents to get started',
  resourceUpload: 'Upload',
  resourceUploadPhoto: 'Choose Photo',
  resourceUploadFile: 'Choose File',
  resourceDeleting: 'Deleting…',
  resourceDeleteConfirm: 'Delete File',
  resourceDeleteDesc: 'This file will be permanently deleted.',
  resourceUploadFailed: 'Upload failed',
  resourceDeleteFailed: 'Delete failed',
  resourceBytes: 'B',
  resourceKB: 'KB',
  resourceMB: 'MB',
  resourceGB: 'GB',

  skillsTitle: 'Skills',
  skillsDesc: 'Manage installed skills and plugins',
  skillsIntegrations: 'Integrations',
  skillsCommunityMcp: 'Community MCP',
  skillsCustom: 'Custom',
  skillsEmpty: 'No skills installed',
  skillsEmptyDesc: 'Import skills or add custom MCP tools to get started.',
  skillsInstalled: 'Installed',
  skillsNotInstalled: 'Not installed',
  skillsInstall: 'Install',
  skillsUninstall: 'Uninstall',
  skillsUninstallConfirm: 'Uninstall Skill',
  skillsUninstallDesc: 'Are you sure you want to uninstall this skill?',
  skillsConfigure: 'Configure',
  skillsImport: 'Import Skill',
  skillsImportUrl: 'Import from URL',
  skillsImportGithub: 'Import from GitHub',
  skillsImportUrlPlaceholder: 'https://example.com/skill.zip',
  skillsImportGithubPlaceholder: 'https://github.com/user/repo',
  skillsImportSuccess: 'Skill imported successfully',
  skillsImportFailed: 'Failed to import skill',
  skillsImporting: 'Importing...',
  skillsInstallSuccess: 'Skill installed successfully',
  skillsInstallFailed: 'Failed to install skill',
  skillsAddCustomMcp: 'Add Custom MCP',
  skillsCustomMcpName: 'Name',
  skillsCustomMcpNamePlaceholder: 'Enter MCP server name',
  skillsCustomMcpUrl: 'Server URL',
  skillsCustomMcpUrlPlaceholder: 'http://localhost:3001/mcp',
  skillsCustomMcpSaved: 'Custom MCP saved',
  skillsDelete: 'Delete',
  skillsDeleteConfirm: 'Delete Skill',
  skillsDeleteDesc: 'Are you sure you want to delete this skill? This action cannot be undone.',
  skillsBuiltin: 'Built-in',
  skillsCommunity: 'Community',
  skillsUser: 'User',
  skillsMarket: 'Market',
  skillsMcp: 'MCP',
  skillsAgentSkill: 'Agent Skill',
  skillsPlugin: 'Plugin',
  skillsMarketTitle: 'Skill Store',
  skillsMarketSearch: 'Search skills...',
  skillsMarketEmpty: 'No skills found',
  skillsMarketUnavailable: 'Skill marketplace is currently unavailable. Please check your server configuration.',
  skillsMarketFeatured: 'Official skills',
  skillsMarketConnect: 'Connect',
  skillsMarketConnected: 'Connected',
  retry: 'Retry',
  skillsMarketInstalled: 'Installed',
  skillsMarketInstalledDesc: 'Skill has been installed successfully.',
  skillsDetailContent: 'Content',
  skillsDetailManifest: 'Manifest',
  skillsDetailNotFound: 'Skill not found',
  skillsStore: 'Store',
  skillsMemorySource: 'Source',
  skillsUploadZip: 'Upload ZIP',
  skillsCustomMcpQuickImport: 'Quick Import',
  skillsCustomMcpQuickImportPlaceholder: '{\n  "mcpServers": {\n    "my-server": {\n      "url": "https://mcp.example.com/mcp"\n    }\n  }\n}',
  skillsCustomMcpQuickImportError: 'Input cannot be empty',
  skillsCustomMcpQuickImportInvalidJson: 'Invalid JSON format',
  skillsCustomMcpQuickImportInvalidStructure: 'Invalid MCP configuration structure',
  skillsCustomMcpIdentifier: 'Identifier',
  skillsCustomMcpIdentifierPlaceholder: 'my-mcp-server',
  skillsCustomMcpIdentifierRequired: 'Identifier is required',
  skillsCustomMcpIdentifierInvalid: 'Only letters, numbers, hyphens and underscores',
  skillsCustomMcpUrlRequired: 'Server URL is required',
  skillsCustomMcpUrlInvalid: 'Invalid URL format',
  skillsCustomMcpAuth: 'Authentication',
  skillsCustomMcpAuthNone: 'None',
  skillsCustomMcpAuthBearer: 'Bearer Token',
  skillsCustomMcpToken: 'Token',
  skillsCustomMcpTokenPlaceholder: 'Enter Bearer token',
  skillsCustomMcpHeaders: 'Custom Headers',
  skillsCustomMcpHeadersAdd: 'Add Header',
  skillsCustomMcpHeaderKey: 'Key',
  skillsCustomMcpHeaderValue: 'Value',
  skillsCustomMcpAdvanced: 'Advanced Settings',
  skillsCustomMcpTestConnection: 'Test Connection',
  skillsCustomMcpTesting: 'Testing...',
  skillsCustomMcpTestSuccess: 'Connection successful',
  skillsCustomMcpTestFailed: 'Connection failed',
  skillsCustomMcpDesc: 'Description',
  skillsCustomMcpDescPlaceholder: 'Optional description',
  skillsCustomMcpAvatar: 'Avatar URL',
  skillsCustomMcpAvatarPlaceholder: 'https://example.com/avatar.png',

  statsTitle: 'Statistics',
  statsOverview: 'Overview',
  statsTotalMessages: 'Messages',
  statsTotalSessions: 'Assistants',
  statsTotalTopics: 'Topics',
  statsTotalWords: 'Words',
  statsVsPrevMonth: 'vs last month',
  statsWelcome: 'You have been using Avato for {days} days',
  statsRegisteredDays: '{days} days',
  statsCreatedAt: 'Account created',
  statsUpdatedAt: 'Last active',
  statsActivity: 'Activity',
  statsActiveDays: '{count} active days',
  statsHotDays: '{count} hot days',
  statsModelsRank: 'Models',
  statsAssistantsRank: 'Assistants',
  statsTopicsRank: 'Topics',
  statsRankCount: 'Count',
  statsRankName: 'Name',
  statsEmpty: 'No data yet',
  statsEmptyDesc: 'Start chatting to see your statistics.',
  statsViewAll: 'View All',

  memoryTitle: 'Memory',
  memoryDesc: 'AI remembers your preferences, identity, and experiences',
  memoryRoles: 'Roles',
  memoryToolOffTitle: 'Disable Memory Tool',
  memoryToolOffDesc: 'AI will not search, create, or update memories in this conversation.',
  memoryToolOnTitle: 'Enable Memory Tool',
  memoryToolOnDesc: 'Allow AI to actively search and manage your memories during conversation.',
  memoryToolEffortTitle: 'Aggressiveness',
  memoryToolEffortDesc: 'Control how aggressively the AI retrieves and updates memory.',
  memoryToolEffortLow: 'Low',
  memoryToolEffortMedium: 'Medium',
  memoryToolEffortHigh: 'High',
  memoryHome: 'Home',
  memoryIdentity: 'Identity',
  memoryContext: 'Context',
  memoryActivity: 'Activity',
  memoryExperience: 'Experience',
  memoryPreference: 'Preference',
  memoryEmpty: 'No memories yet',
  memoryEmptyDesc: 'AI will automatically extract memories from your conversations.',
  memoryPersona: 'Persona',
  memoryPersonaEmpty: 'No persona generated yet. Chat more to build your profile.',
  memorySearch: 'Search memories...',
  memoryDeleteConfirm: 'Delete Memory',
  memoryDeleteDesc: 'Are you sure you want to delete this memory? This action cannot be undone.',
  memoryDeleted: 'Memory deleted',
  memoryDetail: 'Memory Detail',
  memoryType: 'Type',
  memoryTags: 'Tags',
  memoryCapturedAt: 'Captured',
  memoryCreatedAt: 'Created',
  memoryUpdatedAt: 'Updated',
  memorySummary: 'Summary',
  memoryNarrative: 'Narrative',
  memoryNotes: 'Notes',
  memoryFeedback: 'Feedback',
  memorySituation: 'Situation',
  memoryAction: 'Action',
  memoryKeyLearning: 'Key Learning',
  memoryReasoning: 'Reasoning',
  memoryOutcome: 'Possible Outcome',
  memoryConclusion: 'Conclusion',
  memorySuggestions: 'Suggestions',
  memoryDescription: 'Description',
  memoryStatus: 'Status',
  memoryImpact: 'Impact',
  memoryUrgency: 'Urgency',
  memoryPriority: 'Priority',
  memoryConfidence: 'Confidence',
  memoryStartsAt: 'Starts At',
  memoryEndsAt: 'Ends At',
  memoryTimezone: 'Timezone',
  memoryAssociatedObjects: 'Objects',
  memoryAssociatedSubjects: 'Subjects',
  memoryAssociatedLocations: 'Locations',
  memoryTotalCount: '{count} memories',
  memoryEdit: 'Edit',
  memorySave: 'Save',
  memorySaved: 'Memory saved',
  memoryCreateIdentity: 'Create Identity',
  memoryCreateTitle: 'Title',
  memoryCreateTitlePlaceholder: 'Enter identity title...',
  memoryCreateSummary: 'Summary',
  memoryCreateSummaryPlaceholder: 'Optional summary...',
  memoryCreateSave: 'Save',
  memoryExtractTitle: 'Extract Memories',
  memoryExtractDesc: 'Memories are extracted from your chat conversations. Start a conversation and use the extraction feature in chat to build your memory profile.',
  memoryExtractAction: 'Run extraction',
  memoryExtractQueued: 'Queued and waiting to start.',
  memoryExtractRunning: 'Extraction is in progress.',
  memoryExtractReady: 'Your latest extraction has completed.',
  memoryExtractRetry: 'Run again',
  memoryExtractProgress: '{completed} of {total} topics processed',
  memoryExtractProgressUnknown: '{completed} topics processed',
  memoryExtractFailed: 'Extraction failed',
  memoryExtractSuccess: 'Memory extraction started',

  artworkTitle: 'Artwork',
  artworkEmpty: 'Create your first artwork',
  artworkEmptyDesc: 'Enter a prompt and generate stunning images with AI.',
  artworkModel: 'Model',
  artworkReferenceImages: 'Reference Images',
  artworkReferenceImagesDesc: 'Click or drag to upload images\nSupports multiple image selection',
  artworkResolution: 'Resolution',
  artworkAspectRatio: 'Aspect Ratio',
  artworkImageCount: 'Number of Images',
  artworkPromptPlaceholder: 'Describe the image you want to create...',
  artworkGenerate: 'Generate',
  artworkGenerating: 'Generating...',
  artworkTopics: 'History',
  artworkTopicsEmpty: 'No generation history',
  artworkNewTopic: 'New Topic',
  artworkDeleteTopic: 'Delete Topic',
  artworkDeleteTopicConfirm: 'Delete this topic and all its generations?',
  artworkDeleteBatch: 'Delete Batch',
  artworkDeleteBatchConfirm: 'Delete this generation batch?',
  artworkCopyPrompt: 'Copy Prompt',
  artworkPromptCopied: 'Prompt copied',
  artworkPending: 'Pending',
  artworkProcessing: 'Processing',
  artworkSuccess: 'Complete',
  artworkError: 'Failed',
  artworkErrorDesc: 'Image generation failed. Please try again.',
  artworkNoModels: 'No image models available',
  artworkNoModelsDesc: 'Enable an image generation provider in Settings.',
  artworkSelectModel: 'Select Model',
  artworkImageCountCustom: 'Custom',
};

const zh_tw: TranslationKeys = {
  cancel: '取消',
  confirm: '確認',
  delete: '刪除',
  done: '完成',
  save: '儲存',
  search: '搜尋',

  tabChats: '聊天',
  tabArtwork: '創作',
  tabDiscover: '發現',
  tabMe: '我的',

  chatListTitle: 'Avato',
  chatListSearch: '搜尋對話...',
  chatListEmpty: '開始一段對話',
  chatListEmptyDesc: '點擊上方 + 按鈕建立你的第一個 Avato AI 對話。',
  chatListNewConversation: '新對話',
  chatSearchNoResults: '沒有符合的對話',
  chatSearchResults: '搜尋結果',
  chatSearchSearching: '正在搜尋對話...',
  chatListTapToContinue: '點擊繼續對話',

  chatTitle: '聊天',
  chatThinking: '思考中...',
  chatThought: '已深度思考',
  chatThoughtWithDuration: '已深度思考',
  chatSearchImages: '圖片結果',
  chatSearchQueries: '搜尋查詢',
  chatSearchSources: '網頁來源',
  chatImageSearchQueries: '圖片搜尋查詢',
  chatToolsTitle: '工具調用',
  chatToolRunning: '進行中',
  chatToolDone: '已完成',
  chatToolFailed: '失敗',
  chatToolArguments: '參數',
  chatToolPending: '等待確認',
  chatToolRejected: '已拒絕',
  chatToolResponse: '響應',
  chatToolAborted: '已中止',
  chatAskAnything: '有什麼可以幫助你的嗎？',
  chatGenerating: '產生中...',
  chatEmptyTitle: 'Avato 助手',
  chatEmptyDesc: '準備好幫你腦力激盪、除錯或聊天。傳送訊息開始吧。',

  discoverTitle: '發現',
  discoverTrending: '熱門',
  discoverSearchPlaceholder: '搜尋助手、模型...',
  discoverAgents: '助手',
  discoverModels: '模型',
  discoverProviders: '服務商',
  discoverMcp: 'MCP',
  discoverNoAgents: '未找到助手',
  discoverNoAgentsDesc: '請嘗試調整搜尋關鍵字，或稍後再試。',
  discoverComingSoon: '即將推出',
  discoverComingSoonDesc: '瀏覽功能將在未來版本中提供。',
  discoverPopular: '熱門',

  meTitle: '我的',
  meUser: 'Avato 使用者',
  meTapToSettings: '點擊檢視設定',
  meQuickSettings: '快速設定',
  meDarkMode: '深色模式',
  meLanguage: '語言',
  meTheme: '主題',
  meConfiguration: '設定',
  meServerConfig: '伺服器設定',
  meAiProviders: 'AI 服務商',
  meAllSettings: '所有設定',
  meMoreSettings: '更多設定',
  meMoreSettingsDesc: '資料、語音、關於等更多設定',
  meAbout: '關於',
  meHelpFeedback: '說明與回饋',
  meVersion: '版本',
  meSignOut: '登出',
  meSignOutConfirm: '登出',
  meSignOutDesc: '確定要登出嗎？這將清除你的伺服器設定。',

  serverTitle: '伺服器設定',
  serverConnect: '連線到 Avato',
  serverSubtitle: '輸入你的自架伺服器位址',
  serverDesc: 'Avato 執行在你自己的伺服器上。輸入你的 Avato 實例位址（例如 avato.turingmesh.com 或 192.168.1.100:3010）。',
  serverUrlLabel: '伺服器 URL',
  serverUrlPlaceholder: 'avato.turingmesh.com',
  serverQuickFill: '快速填入',
  serverTestConnection: '測試連線',
  serverTesting: '測試中...',
  serverSuccess: '連線成功！伺服器可達。',
  serverFailed: '連線失敗',
  serverConnectStart: '連線並開始',
  serverSaveConfig: '儲存設定',
  serverTips: '💡 請確保手機和伺服器在同一網路中。你的 Avato 伺服器需要提供 tRPC 行動端點 (/trpc/mobile)。',

  chatSettingsTitle: '聊天設定',
  chatSettingsModel: '模型',
  chatSettingsModelHint: '常用：gpt-4o、gpt-4o-mini、claude-3.5-sonnet、deepseek-chat',
  chatSettingsTemperature: '創意活躍度',
  chatSettingsTopP: '思維開放度',
  chatSettingsFrequencyPenalty: '詞彙豐富度',
  chatSettingsPresencePenalty: '表述發散度',
  chatSettingsMaxTokens: '單次回覆限制',
  chatSettingsEnableMaxTokens: '開啟單次回覆限制',
  chatSettingsModelParams: '模型參數',
  chatSettingsSystemPrompt: '系統提示詞',
  chatSettingsCustomInstructions: '自訂指令',
  chatSettingsSystemPromptPlaceholder: '輸入自訂系統提示詞來定義助手的行為...',
  chatSettingsDangerZone: '危險區域',
  chatSettingsClearHistory: '清空聊天記錄',
  chatSettingsDeleteConversation: '刪除對話',
  chatSettingsDeleteConfirm: '刪除對話',
  chatSettingsDeleteDesc: '確定要刪除這個對話嗎？此操作無法復原。',
  chatSettingsClearConfirm: '清空記錄',

  notebookTitle: '筆記本',
  notebookEmpty: '暫無文檔',
  notebookNewDoc: '新建文檔',
  notebookDocTitle: '標題',
  notebookDocTitlePlaceholder: '文檔標題...',
  notebookDeleteConfirm: '刪除文檔',
  notebookDeleteDesc: '確定要刪除此文檔嗎？',
  notebookSaved: '文檔已儲存',
  chatSettingsClearDesc: '這將清空此對話中的所有訊息。',

  settingsTitle: '設定',
  settingsServer: '伺服器',
  settingsServerConfig: '伺服器設定',
  settingsServerConfigDesc: '設定你的 Avato 伺服器 URL',
  settingsAiConfig: 'AI 設定',
  settingsAiProviders: 'AI 服務商',
  settingsAiProvidersDesc: '管理 API 金鑰和服務商設定',
  settingsDefaultModel: '預設模型',
  settingsDefaultAgent: '預設助手',
  settingsGeneral: '一般',
  settingsLanguage: '語言',
  settingsTheme: '主題',
  settingsDataStorage: '資料與儲存',
  settingsSyncBackup: '同步與備份',
  settingsNotConfigured: '未設定',
  settingsStorageManagement: '儲存管理',
  settingsStorageManagementDesc: '管理本機資料',
  settingsVoice: '語音',
  settingsSpeechRecognition: '語音辨識',
  settingsTts: '文字轉語音',
  settingsAbout: '關於',
  settingsPrivacyPolicy: '隱私權政策',
  settingsAboutAvato: '關於 Avato',
  settingsAboutAvatoDesc: 'v1.0.0 • Avato 行動應用',

  aiProvidersTitle: 'AI 服務商',
  aiProvidersDesc: '設定你的 AI 服務商和 API 金鑰。',
  aiProvidersAddKey: '新增 API 金鑰',
  aiProvidersApiKey: 'API 金鑰',
  aiProvidersEndpoint: '自訂端點（選填）',
  aiProvidersSave: '儲存',
  aiProvidersEnabled: '已啟用',

  modelPickerTitle: '選擇模型',
  modelPickerSearch: '搜尋模型...',
  modelPickerRecent: '最近使用',
  modelPickerAll: '全部模型',

  languageTitle: '語言',

  themeTitle: '主題',
  themeLight: '淺色',
  themeDark: '深色',
  themeSystem: '跟隨系統',
  themeDesc: '應用程式使用淺色主題以提供最佳視覺體驗。',

  homeHeroPlaceholder: '你想做什麼？',
  homeQuickWrite: '寫作',
  homeQuickCode: '創建助理',
  homeQuickAnalyze: '創建群組',
  homeQuickCreate: '作圖',
  homeRecents: '最近',
  homeSeeAll: '檢視全部',
  homeAssistants: '助手',
  homeStartChat: '開始聊天',

  studioTitle: '工作室',
  studioFeatured: '精選',
  studioAssistants: '助手',
  studioModels: '模型',
  studioTools: '工具',
  studioViewAll: '檢視全部',

  workspaceTitle: '工作區',
  workspaceRuntime: '執行環境',
  workspaceModel: '預設模型',
  workspaceEndpoint: '端點',
  workspacePreferences: '偏好',
  workspaceSystem: '系統',
  workspaceConnected: '已連線',
  workspaceNotConnected: '未連線',
  workspaceProviders: '服務商',

  msgActionCopy: '複製',
  msgActionEdit: '編輯',
  msgActionRegenerate: '重新產生',
  msgActionDelete: '刪除',
  msgActionDeleteConfirm: '確定刪除這則訊息嗎？',
  msgActionCopied: '已複製',
  msgActionSaveToTopic: '儲存為話題',
  msgStatTokens: 'tokens',
  msgStatUncachedInput: '未快取輸入',
  msgStatCachedInput: '快取輸入',
  msgStatOutput: '輸出',
  msgStatTotal: '總消耗',
  msgStatTPS: 'TPS',
  msgStatTTFT: 'TTFT',

  topicTitle: '話題',
  topicCreate: '新建話題',
  topicCreatePlaceholder: '輸入話題名稱...',
  topicEmpty: '暫無話題',
  topicEmptyDesc: '建立一個話題來組織對話。',
  topicDeleteConfirm: '確定刪除這個話題嗎？',
  topicSearch: '搜尋話題...',

  groupTitle: '工作階段群組',
  groupCreate: '新建群組',
  groupCreatePlaceholder: '輸入群組名稱...',
  groupRename: '重新命名群組',
  groupDelete: '刪除群組',
  groupDeleteConfirm: '確定刪除此群組嗎？工作階段將移至預設群組。',
  groupMoveSession: '移動到群組',
  groupPinned: '已釘選',
  groupDefault: '預設',
  groupManage: '管理群組',

  discoverUseAgent: '使用助手',
  discoverAgentDetail: '助手詳情',
  discoverModelDetail: '模型詳情',
  discoverProviderDetail: '服務商詳情',
  discoverFeatured: '精選',
  discoverAll: '全部',
  discoverNoResults: '未找到結果',

  fileAttach: '附件',
  fileCamera: '拍照',
  fileGallery: '相簿',
  fileDocument: '文件',
  fileUploading: '上傳中...',
  fileUploadFailed: '上傳失敗',

  onboardingWelcome: '歡迎來到 Avato',
  onboardingWelcomeDesc: '掌控你的 AI 工作流。',
  onboardingGetStarted: '開始使用',
  onboardingSetupProvider: '連線伺服器',
  onboardingSetupProviderDesc: '輸入你的自架 Avato 實例位址。',
  onboardingSkip: '暫時跳過',
  onboardingComplete: '一切就緒！',
  onboardingCompleteDesc: '你的工作區已準備好。開始與 AI 對話吧。',
  onboardingStartChatting: '開始聊天',

  profileEdit: '編輯資料',
  profileTitle: '個人資料',
  profileAccount: '帳戶',
  profileAvatar: '頭像',
  profileFullName: '全名',
  profileUsername: '使用者名稱',
  profileBio: '簡介',
  profileSaved: '資料已儲存',
  profileInterests: '興趣領域',
  profileInterestsWriting: '內容創作',
  profileInterestsCoding: '程式設計與開發',
  profileInterestsDesign: '設計與創意',
  profileInterestsEducation: '學習與研究',
  profileInterestsBusiness: '商業與策略',
  profileInterestsMarketing: '行銷與推廣',
  profileInterestsProduct: '產品與管理',
  profileInterestsSales: '銷售與客戶',
  profileInterestsOther: '其他領域',
  profileInterestsCustomPlaceholder: '新增自訂興趣...',
  profileEmail: '電子郵件',
  profileEmailDisplay: '電子郵件地址',
  profileUpdateEmail: '修改',
  profileEmailPlaceholder: '輸入新電子郵件地址',
  profileEmailInvalid: '請輸入有效的電子郵件地址',
  profileEmailChangeSent: '驗證郵件已傳送至新地址',
  profilePassword: '密碼',
  profileSetPassword: '設定密碼',
  profileChangePassword: '變更密碼',
  profilePasswordResetSent: '密碼重設郵件已傳送',
  profilePasswordResetError: '傳送密碼重設郵件失敗',
  profileUsernameRule: '僅支援英文字母、數字和底線',
  profileUsernameDuplicate: '使用者名稱已被使用',

  dataManageTitle: '資料管理',
  dataManageClearCache: '清除快取',
  dataManageExport: '匯出資料',
  dataManageResetApp: '重設應用程式',
  dataManageResetConfirm: '確定重設所有內容嗎？',
  dataManageResetDesc: '這將清除所有本機資料，包括伺服器設定、工作階段和偏好設定。',
  dataManageComingSoon: '即將推出',

  toastSessionCreated: '對話已建立',
  toastSessionDeleted: '對話已刪除',
  toastMessageDeleted: '訊息已刪除',
  toastCopied: '已複製到剪貼簿',
  toastPinned: '已釘選',
  toastUnpinned: '已取消釘選',
  toastTopicCreated: '話題已建立',
  toastTopicDeleted: '話題已刪除',
  toastSaved: '已儲存',
  toastFilePicked: '檔案已新增',
  toastConnectionRestored: '連線已恢復',

  errorNetwork: '網路錯誤，請檢查連線。',
  errorServer: '伺服器錯誤，請稍後重試。',
  errorAuth: '驗證失敗，請重新設定伺服器。',
  errorTimeout: '要求逾時，請重試。',
  errorUnknown: '發生了一些問題。',
  errorRetry: '重試',
  errorOffline: '目前處於離線狀態',
  errorSendFailed: '訊息傳送失敗',
  errorDeleteFailed: '刪除失敗',
  errorEditFailed: '編輯儲存失敗',
  errorSaveFailed: '儲存失敗',
  loginChangeServer: '伺服器',
  loginContinueWithEmail: '使用郵箱或密碼繼續',
  loginContinueWithProvider: '使用 {provider} 繼續',
  loginFeishuConfigMismatch:
    '飛書移動端登入尚未正確配置，請檢查飛書開放平台中的 Android 包名與 MD5 簽名。',
  loginMissingProviders: '此伺服器只允許 SSO 登入，但目前沒有設定任何提供商。',
  loginProviderFailed: '{provider} 登入失敗，請稍後再試。',
  loginProviderLaunchFailed: '無法打開 {provider}，請確認已安裝後重試。',
  loginIncomplete: '登入流程未完成，請再試一次。',
  loginOpenInBrowser: '登入會在瀏覽器中完成，之後會返回 App。',
  loginOpenInProviderApp: '授權會在 {provider} 中完成，之後會返回 App。',
  loginQrHint: '會在瀏覽器中開啟二維碼頁面。',
  loginScanWithProvider: '使用 {provider} 掃碼登入',
  loginSubtitle: '使用你的伺服器帳號繼續',
  loginTitle: '登入',
  loginUnsupportedDesc:
    '此伺服器尚未啟用 OIDC 行動端登入。請在伺服器上配置 JWKS_KEY，或切換到其他伺服器。',
  loginUnsupportedTitle: '尚未啟用行動端登入',

  deleteSessionConfirm: '刪除對話',
  deleteSessionDesc: '此對話及所有訊息將被永久刪除。',
  deleteMessageConfirm: '刪除訊息',
  deleteMessageDesc: '此訊息將被永久刪除。',

  greetingMorning: '早安',
  greetingAfternoon: '午安',
  greetingEvening: '晚安',
  greetingNight: '夜深了',
  welcomeBack: '歡迎回來',
  streakMessage: '連續使用 {count} 天',
  statsMessages: '訊息',
  statsSessions: '工作階段',
  statsStreak: '連續天數',

  editCancel: '取消',
  editSave: '儲存',
  dataClearCacheSubtitle: '清除暫存檔和快取資料',
  dataResetSubtitle: '清除所有資料並重新開始',
  dataCacheCleared: '快取已清除',
  providerSavedTitle: '已儲存',
  providerSavedDesc: '{name} 設定已儲存。',
  validationError: '錯誤',
  validationEnterUrl: '請輸入伺服器 URL',
  settingsSavedModel: '預設模型已更新',
  settingsSavedChat: '聊天設定已儲存',
  fileUploadError: '檔案上傳失敗',

  actionPin: '釘選',
  actionUnpin: '取消釘選',
  actionFavorite: '收藏',
  actionUnfavorite: '取消收藏',

  topicAllMessages: '全部訊息',
  statusActive: '活躍',
  statusInactive: '未啟用',
  badgeVision: '視覺',
  badgeTools: '工具',
  loading: '載入中...',
  groupEmpty: '暫無群組',
  groupEmptyDesc: '建立群組來整理你的對話。',
  groupDeleteAll: '刪除所有群組',
  groupDeleteAllConfirm: '確定刪除所有群組嗎？工作階段將移至預設群組。',
  groupSessionCount: '{count} 個工作階段',
  serverHealthcheckFailed: '伺服器已回應但健康檢查失敗',
  serverConnectionFailed: '連線失敗',
  profileChangePhoto: '更換頭像',
  profileSaveFailed: '儲存資料失敗',
  providerCountActive: '{count} 個活躍',
  meAllSettingsDesc: '伺服器、AI 服務商、資料、語音、關於',
  aboutDescription:
    '一個開源、現代化設計的 AI Agent 工作空間。你的個人 AI 助手，部署在你自己的伺服器上。',
  aboutLinks: '連結',
  aboutGithubRepository: 'GitHub 倉庫',
  aboutOfficialWebsite: '官方網站',
  aboutSponsor: '贊助',
  aboutBuiltOn: '基於 {name} 建構',
  aboutMadeWith: '由 {name} 用 ❤️ 製作',

  chatSuggest1: '解釋一個概念',
  chatSuggest2: '幫我寫程式',
  chatSuggest3: '腦力激盪',
  chatSuggest4: '摘要文字',
  chatHint1: '試試：解釋量子計算...',
  chatHint2: '試試：寫一首關於程式碼的俳句...',
  chatHint3: '試試：除錯這個錯誤...',
  chatHint4: '試試：規劃我的一週...',
  streakCelebrate: '\u{1F525} 連續 {count} 天！',
  activeChats: '{count} 個對話',
  chatEmptyWave: '嘿 \u{1F44B}',
  relativeTimeNow: '剛剛',
  relativeTimeMinutes: '{count} 分鐘前',
  relativeTimeHours: '{count} 小時前',
  relativeTimeDays: '{count} 天前',

  actionRename: '重新命名',
  sessionRenamed: '對話已重新命名',
  sessionRenameTitle: '重新命名對話',
  sessionRenamePlaceholder: '輸入新名稱...',
  topicRename: '重新命名話題',
  topicRenamed: '話題已重新命名',
  topicRenamePlaceholder: '輸入話題名稱...',
  modelPickerOffline: '顯示內建模型清單，連線伺服器取得完整清單。',

  chatClearTitle: '清空訊息',
  chatClearMessage: '這將清空此對話中的所有訊息。此操作無法復原。',
  chatClearConfirm: '清空',
  chatSearchOn: '網頁搜尋已開啟',
  chatSearchOff: '網頁搜尋已關閉',
  toastCleared: '訊息已清空',

  providerDetailTitle: '服務商設定',
  providerDetailApiKey: 'API Key',
  providerDetailEndpoint: '自訂端點',
  providerDetailSave: '儲存設定',
  providerDetailSaved: '設定已儲存',
  providerDetailNoModels: '暫無可用模型',
  providerDetailEnabled: '已啟用',
  providerDetailDisabled: '已停用',
  providerDetailFetchOnClient: '用戶端請求',
  providerDetailFetchOnClientDesc: '直接從用戶端傳送請求到服務商 API',
  providerDetailChecking: '檢查中...',
  providerDetailCheckSuccess: '連線成功',
  providerDetailCheckFailed: '連線失敗',
  providerDetailDescription: '描述',
  providerDetailAccessKeyId: 'Access Key ID',
  providerDetailSecretAccessKey: 'Secret Access Key',
  providerDetailSessionToken: 'Session Token',
  providerDetailUsername: '使用者名稱',
  providerDetailPassword: '密碼',
  providerDetailBearerToken: 'Bearer Token',
  providerDetailApiProxyUrl: 'API 代理 URL',
  providerDetailBaseUrlOrAccountId: 'Base URL / Account ID',
  providerDetailRegion: '區域',
  providerDetailApiVersion: 'API 版本',
  providerDetailPlaceholderGeneric: '請輸入...',
  providerDetailPlaceholderApiKey: 'sk-...',
  providerDetailPlaceholderAccessKeyId: 'AKIA...',
  providerDetailPlaceholderBaseUrl: 'https://api.example.com/v1',
  providerDetailPlaceholderEndpoint: 'https://...',
  providerDetailPlaceholderRegion: 'us-east-1',
  providerDetailPlaceholderApiVersion: '2024-02-01',

  resourceTitle: '資源',
  resourceTabAll: '全部',
  resourceTabImages: '圖片',
  resourceTabDocuments: '文件',
  resourceTabOthers: '其他',
  resourceEmpty: '暫無檔案',
  resourceEmptyDesc: '上傳圖片或文件以開始使用',
  resourceUpload: '上傳',
  resourceUploadPhoto: '選擇照片',
  resourceUploadFile: '選擇檔案',
  resourceDeleting: '刪除中…',
  resourceDeleteConfirm: '刪除檔案',
  resourceDeleteDesc: '該檔案將被永久刪除。',
  resourceUploadFailed: '上傳失敗',
  resourceDeleteFailed: '刪除失敗',
  resourceBytes: 'B',
  resourceKB: 'KB',
  resourceMB: 'MB',
  resourceGB: 'GB',

  skillsTitle: '技能',
  skillsDesc: '管理已安裝的技能和外掛程式',
  skillsIntegrations: '整合',
  skillsCommunityMcp: '社群 MCP',
  skillsCustom: '自訂',
  skillsEmpty: '暫無已安裝技能',
  skillsEmptyDesc: '匯入技能或新增自訂 MCP 工具開始使用。',
  skillsInstalled: '已安裝',
  skillsNotInstalled: '未安裝',
  skillsInstall: '安裝',
  skillsUninstall: '解除安裝',
  skillsUninstallConfirm: '解除安裝技能',
  skillsUninstallDesc: '確定要解除安裝此技能嗎？',
  skillsConfigure: '設定',
  skillsImport: '匯入技能',
  skillsImportUrl: '從 URL 匯入',
  skillsImportGithub: '從 GitHub 匯入',
  skillsImportUrlPlaceholder: 'https://example.com/skill.zip',
  skillsImportGithubPlaceholder: 'https://github.com/user/repo',
  skillsImportSuccess: '技能匯入成功',
  skillsImportFailed: '技能匯入失敗',
  skillsImporting: '匯入中...',
  skillsInstallSuccess: '技能安裝成功',
  skillsInstallFailed: '技能安裝失敗',
  skillsAddCustomMcp: '新增自訂 MCP',
  skillsCustomMcpName: '名稱',
  skillsCustomMcpNamePlaceholder: '輸入 MCP 伺服器名稱',
  skillsCustomMcpUrl: '伺服器 URL',
  skillsCustomMcpUrlPlaceholder: 'http://localhost:3001/mcp',
  skillsCustomMcpSaved: '自訂 MCP 已儲存',
  skillsDelete: '刪除',
  skillsDeleteConfirm: '刪除技能',
  skillsDeleteDesc: '確定要刪除此技能嗎？此操作無法復原。',
  skillsBuiltin: '內建',
  skillsCommunity: '社群',
  skillsUser: '使用者',
  skillsMarket: '市場',
  skillsMcp: 'MCP',
  skillsAgentSkill: '代理技能',
  skillsPlugin: '外掛程式',
  skillsMarketTitle: '技能商店',
  skillsMarketSearch: '搜尋技能...',
  skillsMarketEmpty: '未找到技能',
  skillsMarketUnavailable: '技能市場暫時不可用，請檢查伺服器配置。',
  skillsMarketFeatured: '官方技能',
  skillsMarketConnect: '連接',
  skillsMarketConnected: '已連接',
  retry: '重試',
  skillsMarketInstalled: '已安裝',
  skillsMarketInstalledDesc: '技能已成功安裝。',
  skillsDetailContent: '內容',
  skillsDetailManifest: '清單',
  skillsDetailNotFound: '找不到技能',
  skillsStore: '商店',
  skillsMemorySource: '來源',
  skillsUploadZip: '上傳 ZIP',
  skillsCustomMcpQuickImport: '快速匯入',
  skillsCustomMcpQuickImportPlaceholder: '{\n  "mcpServers": {\n    "my-server": {\n      "url": "https://mcp.example.com/mcp"\n    }\n  }\n}',
  skillsCustomMcpQuickImportError: '輸入不能為空',
  skillsCustomMcpQuickImportInvalidJson: 'JSON 格式無效',
  skillsCustomMcpQuickImportInvalidStructure: 'MCP 配置結構無效',
  skillsCustomMcpIdentifier: '識別碼',
  skillsCustomMcpIdentifierPlaceholder: 'my-mcp-server',
  skillsCustomMcpIdentifierRequired: '識別碼不能為空',
  skillsCustomMcpIdentifierInvalid: '僅支援英文字母、數字、連字號和底線',
  skillsCustomMcpUrlRequired: '伺服器 URL 不能為空',
  skillsCustomMcpUrlInvalid: 'URL 格式無效',
  skillsCustomMcpAuth: '認證方式',
  skillsCustomMcpAuthNone: '無',
  skillsCustomMcpAuthBearer: 'Bearer Token',
  skillsCustomMcpToken: 'Token',
  skillsCustomMcpTokenPlaceholder: '輸入 Bearer Token',
  skillsCustomMcpHeaders: '自訂標頭',
  skillsCustomMcpHeadersAdd: '新增標頭',
  skillsCustomMcpHeaderKey: '鍵',
  skillsCustomMcpHeaderValue: '值',
  skillsCustomMcpAdvanced: '進階設定',
  skillsCustomMcpTestConnection: '測試連線',
  skillsCustomMcpTesting: '測試中...',
  skillsCustomMcpTestSuccess: '連線成功',
  skillsCustomMcpTestFailed: '連線失敗',
  skillsCustomMcpDesc: '描述',
  skillsCustomMcpDescPlaceholder: '選填描述',
  skillsCustomMcpAvatar: '頭像 URL',
  skillsCustomMcpAvatarPlaceholder: 'https://example.com/avatar.png',

  statsTitle: '統計',
  statsOverview: '總覽',
  statsTotalMessages: '訊息',
  statsTotalSessions: '助手',
  statsTotalTopics: '話題',
  statsTotalWords: '詞彙量',
  statsVsPrevMonth: '較上月',
  statsWelcome: '你已使用 Avato {days} 天',
  statsRegisteredDays: '{days} 天',
  statsCreatedAt: '帳戶建立',
  statsUpdatedAt: '最後活躍',
  statsActivity: '活動',
  statsActiveDays: '{count} 天活躍',
  statsHotDays: '{count} 天高活',
  statsModelsRank: '模型',
  statsAssistantsRank: '助手',
  statsTopicsRank: '話題',
  statsRankCount: '次數',
  statsRankName: '名稱',
  statsEmpty: '暫無資料',
  statsEmptyDesc: '開始聊天後即可檢視統計。',
  statsViewAll: '檢視全部',

  memoryTitle: '記憶',
  memoryDesc: 'AI 記住你的偏好、身分和經驗',
  memoryRoles: '角色',
  memoryToolOffTitle: '關閉記憶工具',
  memoryToolOffDesc: 'AI 不會在此對話中搜尋、建立或更新記憶。',
  memoryToolOnTitle: '啟用記憶工具',
  memoryToolOnDesc: '允許 AI 在對話中主動搜尋和管理你的記憶。',
  memoryToolEffortTitle: '積極性',
  memoryToolEffortDesc: '控制 AI 檢索和更新記憶的積極程度。',
  memoryToolEffortLow: '低',
  memoryToolEffortMedium: '中',
  memoryToolEffortHigh: '高',
  memoryHome: '首頁',
  memoryIdentity: '身分',
  memoryContext: '上下文',
  memoryActivity: '活動',
  memoryExperience: '經驗',
  memoryPreference: '偏好',
  memoryEmpty: '暫無記憶',
  memoryEmptyDesc: 'AI 會自動從你的對話中擷取記憶。',
  memoryPersona: '人格畫像',
  memoryPersonaEmpty: '尚未產生人格畫像。多聊聊天來建構你的畫像。',
  memorySearch: '搜尋記憶...',
  memoryDeleteConfirm: '刪除記憶',
  memoryDeleteDesc: '確定要刪除這則記憶嗎？此操作無法復原。',
  memoryDeleted: '記憶已刪除',
  memoryDetail: '記憶詳情',
  memoryType: '類型',
  memoryTags: '標籤',
  memoryCapturedAt: '擷取時間',
  memoryCreatedAt: '建立時間',
  memoryUpdatedAt: '更新時間',
  memorySummary: '摘要',
  memoryNarrative: '敘述',
  memoryNotes: '備註',
  memoryFeedback: '回饋',
  memorySituation: '情境',
  memoryAction: '行動',
  memoryKeyLearning: '關鍵收穫',
  memoryReasoning: '推理',
  memoryOutcome: '可能結果',
  memoryConclusion: '結論',
  memorySuggestions: '建議',
  memoryDescription: '描述',
  memoryStatus: '狀態',
  memoryImpact: '影響力',
  memoryUrgency: '緊急度',
  memoryPriority: '優先順序',
  memoryConfidence: '信心度',
  memoryStartsAt: '開始時間',
  memoryEndsAt: '結束時間',
  memoryTimezone: '時區',
  memoryAssociatedObjects: '關聯物件',
  memoryAssociatedSubjects: '關聯主體',
  memoryAssociatedLocations: '關聯地點',
  memoryTotalCount: '{count} 則記憶',
  memoryEdit: '編輯',
  memorySave: '儲存',
  memorySaved: '記憶已儲存',
  memoryCreateIdentity: '建立身分',
  memoryCreateTitle: '標題',
  memoryCreateTitlePlaceholder: '輸入身分標題...',
  memoryCreateSummary: '摘要',
  memoryCreateSummaryPlaceholder: '選填摘要...',
  memoryCreateSave: '儲存',
  memoryExtractTitle: '擷取記憶',
  memoryExtractDesc: '記憶會從你的聊天對話中擷取。開始對話並在聊天中使用擷取功能來建構你的記憶檔案。',
  memoryExtractAction: '開始擷取',
  memoryExtractQueued: '已排入佇列，等待開始。',
  memoryExtractRunning: '正在擷取記憶。',
  memoryExtractReady: '最近一次擷取已完成。',
  memoryExtractRetry: '重新執行',
  memoryExtractProgress: '已處理 {completed} / {total} 個話題',
  memoryExtractProgressUnknown: '已處理 {completed} 個話題',
  memoryExtractFailed: '記憶擷取失敗',
  memoryExtractSuccess: '已開始擷取記憶',

  artworkTitle: '畫作',
  artworkEmpty: '建立你的第一幅畫作',
  artworkEmptyDesc: '輸入提示詞，用 AI 產生精彩圖片。',
  artworkModel: '模型',
  artworkReferenceImages: '參考圖片',
  artworkReferenceImagesDesc: '點擊或拖曳上傳圖片\n支援多張圖片選擇',
  artworkResolution: '解析度',
  artworkAspectRatio: '長寬比',
  artworkImageCount: '產生數量',
  artworkPromptPlaceholder: '描述你想建立的圖片...',
  artworkGenerate: '產生',
  artworkGenerating: '產生中...',
  artworkTopics: '歷史紀錄',
  artworkTopicsEmpty: '暫無產生歷史',
  artworkNewTopic: '新主題',
  artworkDeleteTopic: '刪除主題',
  artworkDeleteTopicConfirm: '刪除此主題及其所有產生內容？',
  artworkDeleteBatch: '刪除批次',
  artworkDeleteBatchConfirm: '刪除此產生批次？',
  artworkCopyPrompt: '複製提示詞',
  artworkPromptCopied: '提示詞已複製',
  artworkPending: '等待中',
  artworkProcessing: '處理中',
  artworkSuccess: '已完成',
  artworkError: '失敗',
  artworkErrorDesc: '圖片產生失敗，請重試。',
  artworkNoModels: '暫無圖片模型',
  artworkNoModelsDesc: '請在設定中啟用圖片產生服務商。',
  artworkSelectModel: '選擇模型',
  artworkImageCountCustom: '自訂',
};

const zh: TranslationKeys = {
  cancel: '取消',
  confirm: '确认',
  delete: '删除',
  done: '完成',
  save: '保存',
  search: '搜索',

  tabChats: '聊天',
  tabArtwork: '创作',
  tabDiscover: '发现',
  tabMe: '我的',

  chatListTitle: 'Avato',
  chatListSearch: '搜索对话...',
  chatListEmpty: '开始一段对话',
  chatListEmptyDesc: '点击上方 + 按钮创建你的第一个 Avato AI 对话。',
  chatListNewConversation: '新对话',
  chatSearchNoResults: '没有匹配的对话',
  chatSearchResults: '搜索结果',
  chatSearchSearching: '正在搜索对话...',
  chatListTapToContinue: '点击继续对话',

  chatTitle: '聊天',
  chatThinking: '思考中...',
  chatThought: '已深度思考',
  chatThoughtWithDuration: '已深度思考',
  chatSearchImages: '图片结果',
  chatSearchQueries: '搜索查询',
  chatSearchSources: '网页来源',
  chatImageSearchQueries: '图片搜索查询',
  chatToolsTitle: '工具调用',
  chatToolRunning: '进行中',
  chatToolDone: '已完成',
  chatToolFailed: '失败',
  chatToolArguments: '参数',
  chatToolPending: '等待确认',
  chatToolRejected: '已拒绝',
  chatToolResponse: '响应',
  chatToolAborted: '已中止',
  chatAskAnything: '问我任何问题...',
  chatGenerating: '生成中...',
  chatEmptyTitle: 'Avato 助手',
  chatEmptyDesc: '准备好帮你头脑风暴、调试代码或聊天。发送消息开始吧。',

  discoverTitle: '发现',
  discoverTrending: '热门',
  discoverSearchPlaceholder: '搜索助手、模型...',
  discoverAgents: '助手',
  discoverModels: '模型',
  discoverProviders: '服务商',
  discoverMcp: 'MCP',
  discoverNoAgents: '未找到助手',
  discoverNoAgentsDesc: '请尝试调整搜索关键词，或稍后再试。',
  discoverComingSoon: '即将推出',
  discoverComingSoonDesc: '浏览功能将在未来版本中提供。',
  discoverPopular: '热门',

  meTitle: '我的',
  meUser: 'Avato 用户',
  meTapToSettings: '点击查看设置',
  meQuickSettings: '快捷设置',
  meDarkMode: '深色模式',
  meLanguage: '语言',
  meTheme: '主题',
  meConfiguration: '配置',
  meServerConfig: '服务器配置',
  meAiProviders: 'AI 服务商',
  meAllSettings: '全部设置',
  meMoreSettings: '更多设置',
  meMoreSettingsDesc: '数据、语音、关于等更多配置',
  meAbout: '关于',
  meHelpFeedback: '帮助与反馈',
  meVersion: '版本',
  meSignOut: '退出登录',
  meSignOutConfirm: '退出登录',
  meSignOutDesc: '确定要退出登录吗？这将清除你的服务器配置。',

  serverTitle: '服务器配置',
  serverConnect: '连接到 Avato',
  serverSubtitle: '输入你的自托管服务器地址',
  serverDesc: 'Avato 运行在你自己的服务器上。输入你的 Avato 实例地址（例如 avato.turingmesh.com 或 192.168.1.100:3010）。',
  serverUrlLabel: '服务器 URL',
  serverUrlPlaceholder: 'avato.turingmesh.com',
  serverQuickFill: '快捷填入',
  serverTestConnection: '测试连接',
  serverTesting: '测试中...',
  serverSuccess: '连接成功！服务器可达。',
  serverFailed: '连接失败',
  serverConnectStart: '连接并开始',
  serverSaveConfig: '保存配置',
  serverTips: '💡 请确保手机和服务器在同一网络中。你的 Avato 服务器需要提供 tRPC 移动端点 (/trpc/mobile)。',

  chatSettingsTitle: '聊天设置',
  chatSettingsModel: '模型',
  chatSettingsModelHint: '常用：gpt-4o、gpt-4o-mini、claude-3.5-sonnet、deepseek-chat',
  chatSettingsTemperature: '创意活跃度',
  chatSettingsTopP: '思维开放度',
  chatSettingsFrequencyPenalty: '词汇丰富度',
  chatSettingsPresencePenalty: '表述发散度',
  chatSettingsMaxTokens: '单次回复限制',
  chatSettingsEnableMaxTokens: '开启单次回复限制',
  chatSettingsModelParams: '模型参数',
  chatSettingsSystemPrompt: '系统提示词',
  chatSettingsCustomInstructions: '自定义指令',
  chatSettingsSystemPromptPlaceholder: '输入自定义系统提示词来定义助手的行为...',
  chatSettingsDangerZone: '危险区域',
  chatSettingsClearHistory: '清空聊天记录',
  chatSettingsDeleteConversation: '删除对话',
  chatSettingsDeleteConfirm: '删除对话',
  chatSettingsDeleteDesc: '确定要删除这个对话吗？此操作无法撤销。',
  chatSettingsClearConfirm: '清空记录',
  chatSettingsClearDesc: '这将清空此对话中的所有消息。',

  notebookTitle: '笔记本',
  notebookEmpty: '暂无文档',
  notebookNewDoc: '新建文档',
  notebookDocTitle: '标题',
  notebookDocTitlePlaceholder: '文档标题...',
  notebookDeleteConfirm: '删除文档',
  notebookDeleteDesc: '确定要删除此文档吗？',
  notebookSaved: '文档已保存',

  settingsTitle: '设置',
  settingsServer: '服务器',
  settingsServerConfig: '服务器配置',
  settingsServerConfigDesc: '配置你的 Avato 服务器 URL',
  settingsAiConfig: 'AI 配置',
  settingsAiProviders: 'AI 服务商',
  settingsAiProvidersDesc: '管理 API 密钥和服务商设置',
  settingsDefaultModel: '默认模型',
  settingsDefaultAgent: '默认助手',
  settingsGeneral: '通用',
  settingsLanguage: '语言',
  settingsTheme: '主题',
  settingsDataStorage: '数据与存储',
  settingsSyncBackup: '同步与备份',
  settingsNotConfigured: '未配置',
  settingsStorageManagement: '存储管理',
  settingsStorageManagementDesc: '管理本地数据',
  settingsVoice: '语音',
  settingsSpeechRecognition: '语音识别',
  settingsTts: '文字转语音',
  settingsAbout: '关于',
  settingsPrivacyPolicy: '隐私政策',
  settingsAboutAvato: '关于 Avato',
  settingsAboutAvatoDesc: 'v1.0.0 • Avato 移动应用',

  aiProvidersTitle: 'AI 服务商',
  aiProvidersDesc: '配置你的 AI 服务商和 API 密钥。',
  aiProvidersAddKey: '添加 API 密钥',
  aiProvidersApiKey: 'API 密钥',
  aiProvidersEndpoint: '自定义端点（可选）',
  aiProvidersSave: '保存',
  aiProvidersEnabled: '已启用',

  modelPickerTitle: '选择模型',
  modelPickerSearch: '搜索模型...',
  modelPickerRecent: '最近使用',
  modelPickerAll: '全部模型',

  languageTitle: '语言',

  themeTitle: '主题',
  themeLight: '浅色',
  themeDark: '深色',
  themeSystem: '跟随系统',
  themeDesc: '应用使用浅色主题以提供最佳视觉体验。',

  homeHeroPlaceholder: '你想做什么？',
  homeQuickWrite: '写作',
  homeQuickCode: '创建助理',
  homeQuickAnalyze: '创建群组',
  homeQuickCreate: '作图',
  homeRecents: '最近',
  homeSeeAll: '查看全部',
  homeAssistants: '助手',
  homeStartChat: '开始聊天',

  studioTitle: '工作室',
  studioFeatured: '精选',
  studioAssistants: '助手',
  studioModels: '模型',
  studioTools: '工具',
  studioViewAll: '查看全部',

  workspaceTitle: '工作区',
  workspaceRuntime: '运行时',
  workspaceModel: '默认模型',
  workspaceEndpoint: '端点',
  workspacePreferences: '偏好',
  workspaceSystem: '系统',
  workspaceConnected: '已连接',
  workspaceNotConnected: '未连接',
  workspaceProviders: '服务商',

  msgActionCopy: '复制',
  msgActionEdit: '编辑',
  msgActionRegenerate: '重新生成',
  msgActionDelete: '删除',
  msgActionDeleteConfirm: '确定删除这条消息吗？',
  msgActionCopied: '已复制',
  msgActionSaveToTopic: '存为话题',
  msgStatTokens: 'tokens',
  msgStatUncachedInput: '未缓存输入',
  msgStatCachedInput: '缓存输入',
  msgStatOutput: '输出',
  msgStatTotal: '总消耗',
  msgStatTPS: 'TPS',
  msgStatTTFT: 'TTFT',

  topicTitle: '话题',
  topicCreate: '新建话题',
  topicCreatePlaceholder: '输入话题名称...',
  topicEmpty: '暂无话题',
  topicEmptyDesc: '创建一个话题来组织对话。',
  topicDeleteConfirm: '确定删除这个话题吗？',
  topicSearch: '搜索话题...',

  groupTitle: '会话分组',
  groupCreate: '新建分组',
  groupCreatePlaceholder: '输入分组名称...',
  groupRename: '重命名分组',
  groupDelete: '删除分组',
  groupDeleteConfirm: '确定删除此分组吗？会话将移至默认组。',
  groupMoveSession: '移动到分组',
  groupPinned: '已置顶',
  groupDefault: '默认',
  groupManage: '管理分组',

  discoverUseAgent: '使用助手',
  discoverAgentDetail: '助手详情',
  discoverModelDetail: '模型详情',
  discoverProviderDetail: '服务商详情',
  discoverFeatured: '精选',
  discoverAll: '全部',
  discoverNoResults: '未找到结果',

  fileAttach: '附件',
  fileCamera: '拍照',
  fileGallery: '相册',
  fileDocument: '文档',
  fileUploading: '上传中...',
  fileUploadFailed: '上传失败',

  onboardingWelcome: '欢迎来到 Avato',
  onboardingWelcomeDesc: '掌控你的 AI 工作流。',
  onboardingGetStarted: '开始使用',
  onboardingSetupProvider: '连接服务器',
  onboardingSetupProviderDesc: '输入你的自托管 Avato 实例地址。',
  onboardingSkip: '暂时跳过',
  onboardingComplete: '一切就绪！',
  onboardingCompleteDesc: '你的工作区已准备好。开始与 AI 对话吧。',
  onboardingStartChatting: '开始聊天',

  profileEdit: '编辑资料',
  profileTitle: '个人资料',
  profileAccount: '账户',
  profileAvatar: '头像',
  profileFullName: '全名',
  profileUsername: '用户名',
  profileBio: '简介',
  profileSaved: '资料已保存',
  profileInterests: '兴趣领域',
  profileInterestsWriting: '内容创作',
  profileInterestsCoding: '编程与开发',
  profileInterestsDesign: '设计与创意',
  profileInterestsEducation: '学习与研究',
  profileInterestsBusiness: '商业与战略',
  profileInterestsMarketing: '市场与推广',
  profileInterestsProduct: '产品与管理',
  profileInterestsSales: '销售与客户',
  profileInterestsOther: '其他领域',
  profileInterestsCustomPlaceholder: '添加自定义兴趣...',
  profileEmail: '邮箱',
  profileEmailDisplay: '邮箱地址',
  profileUpdateEmail: '修改',
  profileEmailPlaceholder: '输入新邮箱地址',
  profileEmailInvalid: '请输入有效的邮箱地址',
  profileEmailChangeSent: '验证邮件已发送至新地址',
  profilePassword: '密码',
  profileSetPassword: '设置密码',
  profileChangePassword: '修改密码',
  profilePasswordResetSent: '密码重置邮件已发送',
  profilePasswordResetError: '发送密码重置邮件失败',
  profileUsernameRule: '仅支持字母、数字和下划线',
  profileUsernameDuplicate: '用户名已被占用',

  dataManageTitle: '数据管理',
  dataManageClearCache: '清除缓存',
  dataManageExport: '导出数据',
  dataManageResetApp: '重置应用',
  dataManageResetConfirm: '确定重置所有内容吗？',
  dataManageResetDesc: '这将清除所有本地数据，包括服务器配置、会话和偏好设置。',
  dataManageComingSoon: '即将推出',

  toastSessionCreated: '对话已创建',
  toastSessionDeleted: '对话已删除',
  toastMessageDeleted: '消息已删除',
  toastCopied: '已复制到剪贴板',
  toastPinned: '已置顶',
  toastUnpinned: '已取消置顶',
  toastTopicCreated: '话题已创建',
  toastTopicDeleted: '话题已删除',
  toastSaved: '已保存',
  toastFilePicked: '文件已添加',
  toastConnectionRestored: '连接已恢复',

  errorNetwork: '网络错误，请检查连接。',
  errorServer: '服务器错误，请稍后重试。',
  errorAuth: '认证失败，请重新配置服务器。',
  errorTimeout: '请求超时，请重试。',
  errorUnknown: '出了点问题。',
  errorRetry: '重试',
  errorOffline: '当前处于离线状态',
  errorSendFailed: '消息发送失败',
  errorDeleteFailed: '删除失败',
  errorEditFailed: '编辑保存失败',
  errorSaveFailed: '保存失败',
  loginChangeServer: '服务器',
  loginContinueWithEmail: '使用邮箱或密码继续',
  loginContinueWithProvider: '使用 {provider} 继续',
  loginFeishuConfigMismatch:
    '飞书移动端登录尚未正确配置，请检查飞书开放平台中的 Android 包名和 MD5 签名。',
  loginMissingProviders: '该服务器只允许 SSO 登录，但目前没有配置任何提供商。',
  loginProviderFailed: '{provider} 登录失败，请稍后再试。',
  loginProviderLaunchFailed: '无法打开 {provider}，请确认已安装后重试。',
  loginIncomplete: '登录流程未完成，请再试一次。',
  loginOpenInBrowser: '登录会在浏览器中完成，随后返回 App。',
  loginOpenInProviderApp: '授权会在 {provider} 中完成，随后返回 App。',
  loginQrHint: '会在浏览器中打开二维码页面。',
  loginScanWithProvider: '使用 {provider} 扫码登录',
  loginSubtitle: '使用你的服务器账号继续',
  loginTitle: '登录',
  loginUnsupportedDesc:
    '该服务器尚未启用 OIDC 移动端登录。请在服务器上配置 JWKS_KEY，或切换到其他服务器。',
  loginUnsupportedTitle: '尚未启用移动端登录',

  deleteSessionConfirm: '删除对话',
  deleteSessionDesc: '此对话及所有消息将被永久删除。',
  deleteMessageConfirm: '删除消息',
  deleteMessageDesc: '此消息将被永久删除。',

  greetingMorning: '早上好',
  greetingAfternoon: '下午好',
  greetingEvening: '晚上好',
  greetingNight: '夜深了',
  welcomeBack: '欢迎回来',
  streakMessage: '连续使用 {count} 天',
  statsMessages: '消息',
  statsSessions: '会话',
  statsStreak: '连续天数',

  editCancel: '取消',
  editSave: '保存',
  dataClearCacheSubtitle: '清除临时文件和缓存数据',
  dataResetSubtitle: '清除所有数据并重新开始',
  dataCacheCleared: '缓存已清除',
  providerSavedTitle: '已保存',
  providerSavedDesc: '{name} 配置已保存。',
  validationError: '错误',
  validationEnterUrl: '请输入服务器 URL',
  settingsSavedModel: '默认模型已更新',
  settingsSavedChat: '聊天设置已保存',
  fileUploadError: '文件上传失败',

  actionPin: '置顶',
  actionUnpin: '取消置顶',
  actionFavorite: '收藏',
  actionUnfavorite: '取消收藏',

  topicAllMessages: '全部消息',
  statusActive: '活跃',
  statusInactive: '未启用',
  badgeVision: '视觉',
  badgeTools: '工具',
  loading: '加载中...',
  groupEmpty: '暂无分组',
  groupEmptyDesc: '创建分组来整理你的对话。',
  groupDeleteAll: '删除所有分组',
  groupDeleteAllConfirm: '确定删除所有分组吗？会话将移至默认组。',
  groupSessionCount: '{count} 个会话',
  serverHealthcheckFailed: '服务器已响应但健康检查失败',
  serverConnectionFailed: '连接失败',
  profileChangePhoto: '更换头像',
  profileSaveFailed: '保存资料失败',
  providerCountActive: '{count} 个活跃',
  meAllSettingsDesc: '服务器、AI 服务商、数据、语音、关于',
  aboutDescription:
    '一个开源、现代化设计的 AI Agent 工作空间。你的个人 AI 助手，运行在你自己的服务器上。',
  aboutLinks: '链接',
  aboutGithubRepository: 'GitHub 仓库',
  aboutOfficialWebsite: '官方网站',
  aboutSponsor: '赞助',
  aboutBuiltOn: '基于 {name} 构建',
  aboutMadeWith: '由 {name} 用 ❤️ 制作',

  chatSuggest1: '解释一个概念',
  chatSuggest2: '帮我写代码',
  chatSuggest3: '头脑风暴',
  chatSuggest4: '总结文本',
  chatHint1: '试试：解释量子计算...',
  chatHint2: '试试：写一首关于代码的俳句...',
  chatHint3: '试试：调试这个错误...',
  chatHint4: '试试：规划我的一周...',
  streakCelebrate: '\u{1F525} 连续 {count} 天！',
  activeChats: '{count} 个对话',
  chatEmptyWave: '嘿 \u{1F44B}',
  relativeTimeNow: '刚刚',
  relativeTimeMinutes: '{count} 分钟前',
  relativeTimeHours: '{count} 小时前',
  relativeTimeDays: '{count} 天前',

  actionRename: '重命名',
  sessionRenamed: '对话已重命名',
  sessionRenameTitle: '重命名对话',
  sessionRenamePlaceholder: '输入新名称...',
  topicRename: '重命名话题',
  topicRenamed: '话题已重命名',
  topicRenamePlaceholder: '输入话题名称...',
  modelPickerOffline: '显示内置模型列表，连接服务器获取完整列表。',

  chatClearTitle: '清空消息',
  chatClearMessage: '这将清空此对话中的所有消息。此操作无法撤销。',
  chatClearConfirm: '清空',
  chatSearchOn: '网页搜索已开启',
  chatSearchOff: '网页搜索已关闭',
  toastCleared: '消息已清空',

  providerDetailTitle: '服务商设置',
  providerDetailApiKey: 'API Key',
  providerDetailEndpoint: '自定义端点',
  providerDetailSave: '保存配置',
  providerDetailSaved: '配置已保存',
  providerDetailNoModels: '暂无可用模型',
  providerDetailEnabled: '已启用',
  providerDetailDisabled: '已禁用',
  providerDetailFetchOnClient: '客户端请求',
  providerDetailFetchOnClientDesc: '直接从客户端发送请求到服务商 API',
  providerDetailChecking: '检查中...',
  providerDetailCheckSuccess: '连接成功',
  providerDetailCheckFailed: '连接失败',
  providerDetailDescription: '描述',
  providerDetailAccessKeyId: 'Access Key ID',
  providerDetailSecretAccessKey: 'Secret Access Key',
  providerDetailSessionToken: 'Session Token',
  providerDetailUsername: '用户名',
  providerDetailPassword: '密码',
  providerDetailBearerToken: 'Bearer Token',
  providerDetailApiProxyUrl: 'API 代理 URL',
  providerDetailBaseUrlOrAccountId: 'Base URL / Account ID',
  providerDetailRegion: '区域',
  providerDetailApiVersion: 'API 版本',
  providerDetailPlaceholderGeneric: '请输入...',
  providerDetailPlaceholderApiKey: 'sk-...',
  providerDetailPlaceholderAccessKeyId: 'AKIA...',
  providerDetailPlaceholderBaseUrl: 'https://api.example.com/v1',
  providerDetailPlaceholderEndpoint: 'https://...',
  providerDetailPlaceholderRegion: 'us-east-1',
  providerDetailPlaceholderApiVersion: '2024-02-01',

  // Resources / Files
  resourceTitle: '资源',
  resourceTabAll: '全部',
  resourceTabImages: '图片',
  resourceTabDocuments: '文档',
  resourceTabOthers: '其他',
  resourceEmpty: '暂无文件',
  resourceEmptyDesc: '上传图片或文档以开始使用',
  resourceUpload: '上传',
  resourceUploadPhoto: '选择照片',
  resourceUploadFile: '选择文件',
  resourceDeleting: '删除中…',
  resourceDeleteConfirm: '删除文件',
  resourceDeleteDesc: '该文件将被永久删除。',
  resourceUploadFailed: '上传失败',
  resourceDeleteFailed: '删除失败',
  resourceBytes: 'B',
  resourceKB: 'KB',
  resourceMB: 'MB',
  resourceGB: 'GB',

  skillsTitle: '技能',
  skillsDesc: '管理已安装的技能和插件',
  skillsIntegrations: '集成',
  skillsCommunityMcp: '社区 MCP',
  skillsCustom: '自定义',
  skillsEmpty: '暂无已安装技能',
  skillsEmptyDesc: '导入技能或添加自定义 MCP 工具开始使用。',
  skillsInstalled: '已安装',
  skillsNotInstalled: '未安装',
  skillsInstall: '安装',
  skillsUninstall: '卸载',
  skillsUninstallConfirm: '卸载技能',
  skillsUninstallDesc: '确定要卸载此技能吗？',
  skillsConfigure: '配置',
  skillsImport: '导入技能',
  skillsImportUrl: '从 URL 导入',
  skillsImportGithub: '从 GitHub 导入',
  skillsImportUrlPlaceholder: 'https://example.com/skill.zip',
  skillsImportGithubPlaceholder: 'https://github.com/user/repo',
  skillsImportSuccess: '技能导入成功',
  skillsImportFailed: '技能导入失败',
  skillsImporting: '导入中...',
  skillsInstallSuccess: '技能安装成功',
  skillsInstallFailed: '技能安装失败',
  skillsAddCustomMcp: '添加自定义 MCP',
  skillsCustomMcpName: '名称',
  skillsCustomMcpNamePlaceholder: '输入 MCP 服务器名称',
  skillsCustomMcpUrl: '服务器 URL',
  skillsCustomMcpUrlPlaceholder: 'http://localhost:3001/mcp',
  skillsCustomMcpSaved: '自定义 MCP 已保存',
  skillsDelete: '删除',
  skillsDeleteConfirm: '删除技能',
  skillsDeleteDesc: '确定要删除此技能吗？此操作无法撤销。',
  skillsBuiltin: '内置',
  skillsCommunity: '社区',
  skillsUser: '用户',
  skillsMarket: '市场',
  skillsMcp: 'MCP',
  skillsAgentSkill: '代理技能',
  skillsPlugin: '插件',
  skillsMarketTitle: '技能商店',
  skillsMarketSearch: '搜索技能...',
  skillsMarketEmpty: '未找到技能',
  skillsMarketUnavailable: '技能市场暂时不可用，请检查服务器配置。',
  skillsMarketFeatured: '官方技能',
  skillsMarketConnect: '连接',
  skillsMarketConnected: '已连接',
  retry: '重试',
  skillsMarketInstalled: '已安装',
  skillsMarketInstalledDesc: '技能已成功安装。',
  skillsDetailContent: '内容',
  skillsDetailManifest: '清单',
  skillsDetailNotFound: '技能未找到',
  skillsStore: '商店',
  skillsMemorySource: '来源',
  skillsUploadZip: '上传 ZIP',
  skillsCustomMcpQuickImport: '快速导入',
  skillsCustomMcpQuickImportPlaceholder: '{\n  "mcpServers": {\n    "my-server": {\n      "url": "https://mcp.example.com/mcp"\n    }\n  }\n}',
  skillsCustomMcpQuickImportError: '输入不能为空',
  skillsCustomMcpQuickImportInvalidJson: 'JSON 格式无效',
  skillsCustomMcpQuickImportInvalidStructure: 'MCP 配置结构无效',
  skillsCustomMcpIdentifier: '标识符',
  skillsCustomMcpIdentifierPlaceholder: 'my-mcp-server',
  skillsCustomMcpIdentifierRequired: '标识符不能为空',
  skillsCustomMcpIdentifierInvalid: '仅支持字母、数字、连字符和下划线',
  skillsCustomMcpUrlRequired: '服务器 URL 不能为空',
  skillsCustomMcpUrlInvalid: 'URL 格式无效',
  skillsCustomMcpAuth: '认证方式',
  skillsCustomMcpAuthNone: '无',
  skillsCustomMcpAuthBearer: 'Bearer Token',
  skillsCustomMcpToken: 'Token',
  skillsCustomMcpTokenPlaceholder: '输入 Bearer Token',
  skillsCustomMcpHeaders: '自定义请求头',
  skillsCustomMcpHeadersAdd: '添加请求头',
  skillsCustomMcpHeaderKey: '键',
  skillsCustomMcpHeaderValue: '值',
  skillsCustomMcpAdvanced: '高级设置',
  skillsCustomMcpTestConnection: '测试连接',
  skillsCustomMcpTesting: '测试中...',
  skillsCustomMcpTestSuccess: '连接成功',
  skillsCustomMcpTestFailed: '连接失败',
  skillsCustomMcpDesc: '描述',
  skillsCustomMcpDescPlaceholder: '可选描述',
  skillsCustomMcpAvatar: '头像 URL',
  skillsCustomMcpAvatarPlaceholder: 'https://example.com/avatar.png',

  statsTitle: '统计',
  statsOverview: '总览',
  statsTotalMessages: '消息',
  statsTotalSessions: '助手',
  statsTotalTopics: '话题',
  statsTotalWords: '词汇量',
  statsVsPrevMonth: '较上月',
  statsWelcome: '你已使用 Avato {days} 天',
  statsRegisteredDays: '{days} 天',
  statsCreatedAt: '账户创建',
  statsUpdatedAt: '最后活跃',
  statsActivity: '活动',
  statsActiveDays: '{count} 天活跃',
  statsHotDays: '{count} 天高活',
  statsModelsRank: '模型',
  statsAssistantsRank: '助手',
  statsTopicsRank: '话题',
  statsRankCount: '次数',
  statsRankName: '名称',
  statsEmpty: '暂无数据',
  statsEmptyDesc: '开始聊天后即可查看统计。',
  statsViewAll: '查看全部',

  memoryTitle: '记忆',
  memoryDesc: 'AI 记住你的偏好、身份和经验',
  memoryRoles: '角色',
  memoryToolOffTitle: '关闭记忆工具',
  memoryToolOffDesc: 'AI 将不会在此对话中搜索、创建或更新记忆。',
  memoryToolOnTitle: '启用记忆工具',
  memoryToolOnDesc: '允许 AI 在对话中主动搜索和管理你的记忆。',
  memoryToolEffortTitle: '积极性',
  memoryToolEffortDesc: '控制 AI 检索和更新记忆的积极程度。',
  memoryToolEffortLow: '低',
  memoryToolEffortMedium: '中',
  memoryToolEffortHigh: '高',
  memoryHome: '首页',
  memoryIdentity: '身份',
  memoryContext: '上下文',
  memoryActivity: '活动',
  memoryExperience: '经验',
  memoryPreference: '偏好',
  memoryEmpty: '暂无记忆',
  memoryEmptyDesc: 'AI 会自动从你的对话中提取记忆。',
  memoryPersona: '人格画像',
  memoryPersonaEmpty: '还没有生成人格画像。多聊聊天来构建你的画像。',
  memorySearch: '搜索记忆...',
  memoryDeleteConfirm: '删除记忆',
  memoryDeleteDesc: '确定要删除这条记忆吗？此操作无法撤销。',
  memoryDeleted: '记忆已删除',
  memoryDetail: '记忆详情',
  memoryType: '类型',
  memoryTags: '标签',
  memoryCapturedAt: '捕获时间',
  memoryCreatedAt: '创建时间',
  memoryUpdatedAt: '更新时间',
  memorySummary: '摘要',
  memoryNarrative: '叙述',
  memoryNotes: '备注',
  memoryFeedback: '反馈',
  memorySituation: '场景',
  memoryAction: '行动',
  memoryKeyLearning: '关键收获',
  memoryReasoning: '推理',
  memoryOutcome: '可能结果',
  memoryConclusion: '结论',
  memorySuggestions: '建议',
  memoryDescription: '描述',
  memoryStatus: '状态',
  memoryImpact: '影响力',
  memoryUrgency: '紧急度',
  memoryPriority: '优先级',
  memoryConfidence: '置信度',
  memoryStartsAt: '开始时间',
  memoryEndsAt: '结束时间',
  memoryTimezone: '时区',
  memoryAssociatedObjects: '关联对象',
  memoryAssociatedSubjects: '关联主体',
  memoryAssociatedLocations: '关联地点',
  memoryTotalCount: '{count} 条记忆',
  memoryEdit: '编辑',
  memorySave: '保存',
  memorySaved: '记忆已保存',
  memoryCreateIdentity: '创建身份',
  memoryCreateTitle: '标题',
  memoryCreateTitlePlaceholder: '输入身份标题...',
  memoryCreateSummary: '摘要',
  memoryCreateSummaryPlaceholder: '可选摘要...',
  memoryCreateSave: '保存',
  memoryExtractTitle: '提取记忆',
  memoryExtractDesc: '记忆会从你的聊天对话中提取。开始对话并在聊天中使用提取功能来构建你的记忆档案。',
  memoryExtractAction: '开始提取',
  memoryExtractQueued: '已进入队列，等待开始。',
  memoryExtractRunning: '正在提取记忆。',
  memoryExtractReady: '最近一次提取已经完成。',
  memoryExtractRetry: '重新执行',
  memoryExtractProgress: '已处理 {completed} / {total} 个话题',
  memoryExtractProgressUnknown: '已处理 {completed} 个话题',
  memoryExtractFailed: '记忆提取失败',
  memoryExtractSuccess: '已开始提取记忆',

  artworkTitle: '画作',
  artworkEmpty: '创建你的第一幅画作',
  artworkEmptyDesc: '输入提示词，用 AI 生成精彩图片。',
  artworkModel: '模型',
  artworkReferenceImages: '参考图片',
  artworkReferenceImagesDesc: '点击或拖拽上传图片\n支持多张图片选择',
  artworkResolution: '分辨率',
  artworkAspectRatio: '宽高比',
  artworkImageCount: '生成数量',
  artworkPromptPlaceholder: '描述你想创建的图片...',
  artworkGenerate: '生成',
  artworkGenerating: '生成中...',
  artworkTopics: '历史记录',
  artworkTopicsEmpty: '暂无生成历史',
  artworkNewTopic: '新主题',
  artworkDeleteTopic: '删除主题',
  artworkDeleteTopicConfirm: '删除此主题及其所有生成内容？',
  artworkDeleteBatch: '删除批次',
  artworkDeleteBatchConfirm: '删除此生成批次？',
  artworkCopyPrompt: '复制提示词',
  artworkPromptCopied: '提示词已复制',
  artworkPending: '等待中',
  artworkProcessing: '处理中',
  artworkSuccess: '已完成',
  artworkError: '失败',
  artworkErrorDesc: '图片生成失败，请重试。',
  artworkNoModels: '暂无图片模型',
  artworkNoModelsDesc: '请在设置中启用图片生成服务商。',
  artworkSelectModel: '选择模型',
  artworkImageCountCustom: '自定义',
};

const translations: Record<Locale, TranslationKeys> = {
  'en-US': en,
  'zh-CN': zh,
  'zh-TW': zh_tw,

};

// ── Zustand store ───────────────────────────────────────────────────
interface I18nStore {
  loadLocale: () => Promise<void>;
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  t: TranslationKeys;
}

export const LOCALE_DISPLAY_NAMES: Record<Locale, string> = {
  'en-US': 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',

};

export const useI18n = create<I18nStore>((set) => ({
  locale: 'en-US',
  t: en,
  setLocale: async (locale: Locale) => {
    await AsyncStorage.setItem(STORAGE_KEY, locale);
    set({ locale, t: translations[locale] || en });
  },
  loadLocale: async () => {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved && translations[saved as Locale]) {
      set({ locale: saved as Locale, t: translations[saved as Locale] });
    }
  },
}));
