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
  chatListAll: string;
  chatListAgents: string;
  chatListCollapseAssistant: string;
  chatListExpandAssistant: string;
  chatListViewAssistant: string;
  chatListViewGroup: string;
  chatListViewSession: string;
  chatListViewTopic: string;
  chatListAssistants: string;
  chatListTopicRecent: string;
  chatListTopics: string;
  chatListTopicEmpty: string;
  chatListTopicEmptyDesc: string;
  chatListEmpty: string;
  chatListEmptyDesc: string;
  chatListGroupEmpty: string;
  chatListGroupEmptyDesc: string;
  chatListCreateAgent: string;
  chatListCreateGroup: string;
  chatListCreateTag: string;
  chatListGroupTag: string;
  chatListNewAssistant: string;
  chatListNewConversation: string;
  deleteTopicConfirm: string;
  deleteTopicDesc: string;
  chatSearchMatchMessage: string;
  chatSearchMatchSession: string;
  chatSearchMatchTopic: string;
  chatSearchNoResults: string;
  chatSearchResults: string;
  chatSearchSearching: string;
  accessibilityAddResource: string;
  accessibilityAddStore: string;
  accessibilityAddTopic: string;
  accessibilityChatDirectory: string;
  accessibilityOpenStore: string;
  accessibilityCreateMenu: string;
  accessibilityGoBack: string;
  accessibilitySave: string;
  accessibilitySettings: string;
  accessibilityHintGoBack: string;
  accessibilityHintRetry: string;
  accessibilityHintSave: string;
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
  chatToolCompleted: string;
  chatToolPending: string;
  chatToolRejected: string;
  chatToolResponse: string;
  chatToolAborted: string;
  chatToolApprove: string;
  chatToolApproveNotSupported: string;
  chatToolReject: string;
  chatToolAbortedDesc: string;
  chatToolRejectedDesc: string;
  chatToolPendingDesc: string;
  chatToolGtdTodoCount: string;
  chatToolGtdPlanGoalPlaceholder: string;
  chatToolGtdPlanDescPlaceholder: string;
  chatToolGtdPlanContextPlaceholder: string;
  chatToolGtdAddTodoPlaceholder: string;
  chatToolNotebookCreateDocTitlePlaceholder: string;
  chatToolNotebookCreateDocDescPlaceholder: string;
  chatToolNotebookCreateDocContentPlaceholder: string;
  chatToolStreamingCreatePlan: string;
  chatToolStreamingExecTask: string;
  chatToolStreamingCreateDocument: string;
  chatToolStreamingExecuteCode: string;
  chatToolStreamingAddExperience: string;
  chatToolStreamingAddPreference: string;
  chatToolStreamingWebSearch: string;
  chatToolStreamingKnowledgeBase: string;
  chatToolStreamingSearchSkill: string;
  chatShowMore: string;
  chatShowLess: string;
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
  meAgents: string;
  meAgentsDesc: string;
  meAgentConfigureFirst: string;
  agentDeleteConfirm: string;
  agentDeleteDesc: string;
  agentDeleteDefaultForbidden: string;
  meDiscover: string;
  meDiscoverDesc: string;
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
  chatSettingsAgentProfile: string;
  chatSettingsAgentTitlePlaceholder: string;
  chatSettingsAgentDescPlaceholder: string;
  chatSettingsSystemPrompt: string;
  chatSettingsCustomInstructions: string;
  chatSettingsSystemPromptPlaceholder: string;
  chatSettingsGroup: string;
  chatSettingsTag: string;
  chatSettingsDangerZone: string;
  chatSettingsClearHistory: string;
  chatSettingsDeleteConversation: string;
  chatSettingsDeleteConfirm: string;
  chatSettingsDeleteDesc: string;
  chatSettingsClearConfirm: string;
  chatSettingsClearDesc: string;
  groupSettingsAllowDM: string;
  groupSettingsAllowDMDesc: string;
  groupSettingsRevealDM: string;
  groupSettingsRevealDMDesc: string;
  groupSettingsMembers: string;
  groupSettingsMembersEmpty: string;
  groupSettingsSupervisor: string;
  groupSettingsRemoveMemberConfirm: string;
  groupSettingsRemoveMemberDesc: string;
  groupAddMembers: string;
  groupCreateDefaultTitle: string;
  groupStartConversation: string;
  groupCreateSupervisorModel: string;
  groupMentionAllMembers: string;
  groupMentionTitle: string;
  taskGroupTasks: string;
  taskGroupTasksTitle: string;
  taskGroupTasksTitleSimple: string;

  // Notebook
  notebookTitle: string;
  notebookDesc: string;
  notebookEmpty: string;
  notebookNewDoc: string;
  notebookDocTitle: string;
  notebookDocTitlePlaceholder: string;
  notebookDocContentPlaceholder: string;
  notebookDeleteConfirm: string;
  notebookDeleteDesc: string;
  notebookSaved: string;
  notebookUnsavedTitle: string;
  notebookUnsavedDesc: string;
  notebookDiscard: string;
  notebookPreview: string;
  notebookEdit: string;

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
  agentCurrent: string;
  agentNoDescription: string;
  agentsEmpty: string;
  agentsEmptyDesc: string;
  agentConfigAvatar: string;
  agentConfigBasic: string;
  agentConfigChats: string;
  agentConfigInstruction: string;
  agentConfigModel: string;
  agentConfigName: string;
  agentConfigProvider: string;
  agentConfigMeta: string;
  agentConfigTitle: string;
  agentConfigOpening: string;
  agentConfigModal: string;
  agentConfigDescription: string;
  agentConfigTags: string;
  agentConfigBackgroundColor: string;
  agentConfigOpeningMessage: string;
  agentConfigOpeningQuestions: string;
  agentConfigOpeningQuestionsPlaceholder: string;
  agentConfigAutoCreateTopic: string;
  agentConfigAutoCreateTopicThreshold: string;
  agentConfigEnableHistory: string;
  agentConfigHistoryCount: string;
  agentConfigCompressHistory: string;
  agentConfigAutoScroll: string;
  agentConfigTemperature: string;
  agentConfigTopP: string;
  agentConfigPresencePenalty: string;
  agentConfigFrequencyPenalty: string;
  agentConfigMaxTokens: string;
  agentConfigStreaming: string;
  agentConfigSaved: string;
  agentConfigLegacyTitle: string;
  agentConfigSessionOnlyTitle: string;
  agentConfigSessionOnlyDesc: string;
  agentConfigOpenStore: string;
  agentConfigSkills: string;
  agentConfigSkillsIds: string;
  agentConfigAdvanced: string;
  agentConfigNamePlaceholder: string;
  agentConfigDescriptionPlaceholder: string;
  agentConfigAvatarPlaceholder: string;
  agentConfigSearchMode: string;
  agentConfigSearchOff: string;
  agentConfigSearchAuto: string;
  agentConfigSkillsEmpty: string;
  agentConfigSkillsCount: string;
  agentFirstHint: string;
  agentFirstHintDesc: string;
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
  settingsGroupWorkspace: string;
  settingsGroupConnection: string;
  settingsGroupServerInfo: string;
  settingsGroupAppearance: string;
  settingsGroupI18n: string;
  settingsGroupMemory: string;
  settingsGroupData: string;
  settingsGroupAccount: string;

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
  themeColorScheme: string;
  themeColorAmber: string;
  themeColorBlue: string;
  themeColorViolet: string;
  themeColorGreen: string;
  themeColorSlate: string;
  themeColorRose: string;
  themeColorSage: string;
  themeColorDustBlue: string;

  // Home / Command Surface
  homeHeroPlaceholder: string;
  homeQuickWrite: string;
  homeQuickCode: string;
  homeQuickAnalyze: string;
  homeQuickCreate: string;
  homeAgentAll: string;
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
  msgActionShare: string;
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
  tagCreate: string;
  tagEdit: string;
  tagPlaceholder: string;
  tagColor: string;
  tagMoveSession: string;
  tagNone: string;
  tagDeleteConfirm: string;
  tagDeleteDesc: string;

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
  fileDocument: string;
  fileFromWorkspace: string;
  fileFromWorkspaceDesc: string;
  fileGallery: string;
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
  logsCapture: string;
  logsCaptureDesc: string;
  logsView: string;
  logsViewDesc: string;
  logsTitle: string;
  logsCopy: string;
  logsClear: string;
  logsEmpty: string;
  logsCopied: string;
  logsEnabled: string;
  logsDisabled: string;
  logsCrashHint: string;
  chatListLoadFailed: string;

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
  toastTitleGenerationFailed: string;
  toastTitleGenerationFailedHint: string;
  toastTopicCreateFailed: string;
  toastGenerationStopped: string;
  toastFilePicked: string;
  toastConnectionRestored: string;

  // Error messages
  errorNetwork: string;
  errorServer: string;
  errorAuth: string;
  errorAuthGoToLogin: string;
  errorTimeout: string;
  errorProviderOverloaded: string;
  errorUnknown: string;
  errorRetry: string;
  errorOffline: string;
  errorSendFailed: string;
  errorDeleteFailed: string;
  errorEditFailed: string;
  errorSaveFailed: string;
  loginChangeServer: string;
  loginDesc: string;
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
  activeAssistants: string;
  activeGroups: string;
  activeTopics: string;
  activeChats: string;
  chatEmptyWave: string;
  relativeTimeNow: string;
  relativeTimeMinutes: string;
  relativeTimeHours: string;
  relativeTimeDays: string;

  actionRename: string;
  actionSmartRename: string;
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
  chatScrollToTop: string;
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
  resourceUploaded: string;
  resourceDownload: string;
  resourceDownloaded: string;
  resourceDownloadFailed: string;
  resourceCachedLocal: string;
  resourceCachingPreview: string;
  resourceCollapseAll: string;
  resourceCurrentFolder: string;
  resourceExpandAll: string;
  resourceExplorer: string;
  resourceOpenExternal: string;
  resourcePreviewUnavailable: string;
  resourceDeleteFailed: string;
  resourceRenameFailed: string;
  resourceRenamePlaceholder: string;
  resourceRenamed: string;
  resourceShareFailed: string;
  resourceBytes: string;
  resourceKB: string;
  resourceMB: string;
  resourceGB: string;
  resourceLibraryAll: string;
  resourceLibraryInbox: string;
  resourceLibrarySelect: string;
  resourceFolderRoot: string;
  resourceNewFolder: string;
  resourceMoveToFolder: string;
  resourceFolderDeleteConfirm: string;
  resourceFolderDeleteDesc: string;
  resourceCreateFolder: string;
  resourceCreateFolderPlaceholder: string;
  resourceSortBy: string;
  resourceSortNewest: string;
  resourceSortOldest: string;
  resourceSortName: string;
  resourceSortSize: string;
  resourceLoadMore: string;
  resourceFolderEmpty: string;
  resourceFolderEmptyDesc: string;
  resourceViewList: string;
  resourceViewGrid: string;
  resourceViewModeToggle: string;
  resourceSelect: string;
  resourceSelectCount: string;
  resourceBatchDelete: string;
  resourceBatchMove: string;
  resourceCancelSelect: string;

  // Store
  tabStore: string;
  storeSearch: string;
  storeExplore: string;
  storeMcp: string;
  storeSkills: string;
  storeInstalled: string;
  storeEmpty: string;
  storeLoadFailed: string;
  storeInstall: string;
  storeManage: string;
  storeFeatured: string;
  storeCustom: string;
  storeBuiltIn: string;
  storeFromStore: string;
  storeImported: string;
  storeRemove: string;
  storeRemoveConfirm: string;
  storeRemoveDesc: string;
  storeRemoved: string;
  storeRemoveFailed: string;
  storeAddTitle: string;
  storeImportUrl: string;
  storeImportGithub: string;
  storeUploadZip: string;
  storeImportUrlPlaceholder: string;
  storeImportGithubPlaceholder: string;
  storeImportSuccess: string;
  storeImportFailed: string;
  storeInstallSuccess: string;
  storeInstallFailed: string;
  storeAddCustomMcp: string;
  storeCustomMcpSaved: string;

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
  skillsRecommendedBuiltins: string;
  skillsBuiltinArtifactsTitle: string;
  skillsBuiltinArtifactsDesc: string;
  skillsBuiltinMemoryTitle: string;
  skillsBuiltinMemoryDesc: string;
  skillsBuiltinCloudSandboxTitle: string;
  skillsBuiltinCloudSandboxDesc: string;
  skillsBuiltinGtdTitle: string;
  skillsBuiltinGtdDesc: string;
  skillsBuiltinNotebookTitle: string;
  skillsBuiltinNotebookDesc: string;
  skillsBuiltinCalculatorTitle: string;
  skillsBuiltinCalculatorDesc: string;
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
  chatListSearch: 'Search sessions and messages',
  chatListAll: 'All',
  chatListAgents: 'Agents',
  chatListCollapseAssistant: 'Collapse',
  chatListExpandAssistant: 'Expand',
  chatListViewAssistant: 'Assistants',
  chatListViewGroup: 'Groups',
  chatListViewSession: 'Sessions',
  chatListViewTopic: 'Topics',
  chatListAssistants: 'Assistants',
  chatListTopicRecent: 'Recent',
  chatListTopics: 'Topics',
  chatListTopicEmpty: 'No topics yet',
  chatListTopicEmptyDesc: 'Your recent conversations will appear here.',
  chatListEmpty: 'No sessions yet',
  chatListEmptyDesc: 'Tap the + button below to create your first topic or group.',
  chatListGroupEmpty: 'No groups yet',
  chatListGroupEmptyDesc: 'Tap the + button below to create a new group chat.',
  chatListCreateAgent: 'New Agent',
  chatListCreateGroup: 'New Group Chat',
  chatListCreateTag: 'New Tag',
  chatListGroupTag: 'Group Chat',
  chatListNewAssistant: 'New Assistant',
  chatListNewConversation: 'New Session',
  deleteTopicConfirm: 'Delete this topic?',
  deleteTopicDesc: 'This conversation will be permanently deleted.',
  chatSearchMatchMessage: 'message',
  chatSearchMatchSession: 'session',
  chatSearchMatchTopic: 'topic',
  chatSearchNoResults: 'No matching sessions or topics',
  chatSearchResults: 'Search Results',
  chatSearchSearching: 'Searching sessions and topics...',
  accessibilityAddResource: 'Add resource',
  accessibilityAddStore: 'Add to store',
  accessibilityAddTopic: 'Add topic',
  accessibilityChatDirectory: 'Open chat directory',
  accessibilityOpenStore: 'Open store',
  accessibilityCreateMenu: 'Create topic or group',
  accessibilityGoBack: 'Go back',
  accessibilitySave: 'Save',
  accessibilitySettings: 'Session settings',
  accessibilityHintGoBack: 'Returns to the previous screen',
  accessibilityHintRetry: 'Double tap to retry',
  accessibilityHintSave: 'Saves changes and returns',
  chatListTapToContinue: 'Tap to continue the session',

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
  chatToolCompleted: 'Done',
  chatToolPending: 'Pending approval',
  chatToolRejected: 'Rejected',
  chatToolResponse: 'Response',
  chatToolAborted: 'Aborted',
  chatToolApprove: 'Approve',
  chatToolApproveNotSupported: 'Tool approval is not yet supported for this flow.',
  chatToolReject: 'Reject',
  chatToolAbortedDesc: 'This tool call was aborted.',
  chatToolRejectedDesc: 'This tool call was rejected.',
  chatToolPendingDesc: 'This tool needs your approval to run.',
  chatToolGtdTodoCount: '{{count}} todos',
  chatToolGtdPlanGoalPlaceholder: 'Goal or objective',
  chatToolGtdPlanDescPlaceholder: 'Brief summary',
  chatToolGtdPlanContextPlaceholder: 'Context and constraints',
  chatToolGtdAddTodoPlaceholder: 'Add todo item',
  chatToolNotebookCreateDocTitlePlaceholder: 'Document title',
  chatToolNotebookCreateDocDescPlaceholder: 'Brief description',
  chatToolNotebookCreateDocContentPlaceholder: 'Content (Markdown)',
  chatToolStreamingCreatePlan: 'Creating plan…',
  chatToolStreamingExecTask: 'Executing task…',
  chatToolStreamingCreateDocument: 'Creating document…',
  chatToolStreamingExecuteCode: 'Executing code…',
  chatToolStreamingAddExperience: 'Adding experience…',
  chatToolStreamingAddPreference: 'Adding preference…',
  chatToolStreamingWebSearch: 'Searching…',
  chatToolStreamingKnowledgeBase: 'Searching knowledge base…',
  chatToolStreamingSearchSkill: 'Searching skills…',
  chatShowMore: 'Show more',
  chatShowLess: 'Show less',
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
  meAgents: 'Agents',
  meAgentsDesc: 'Manage and configure your assistants',
  meAgentConfigureFirst: 'Start a chat first to configure this agent',
  agentDeleteConfirm: 'Delete Assistant',
  agentDeleteDesc: 'This assistant and its chat history will be permanently removed.',
  agentDeleteDefaultForbidden: 'The default assistant cannot be deleted.',
  meDiscover: 'Discover',
  meDiscoverDesc: 'Browse agents, models & providers',
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

  chatSettingsTitle: 'Session Settings',
  chatSettingsModel: 'Model',
  chatSettingsModelHint: 'Popular: gpt-4o, gpt-4o-mini, claude-3.5-sonnet, deepseek-chat',
  chatSettingsTemperature: 'Temperature',
  chatSettingsTopP: 'Top P',
  chatSettingsFrequencyPenalty: 'Frequency Penalty',
  chatSettingsPresencePenalty: 'Presence Penalty',
  chatSettingsMaxTokens: 'Max Tokens',
  chatSettingsEnableMaxTokens: 'Enable Max Tokens',
  chatSettingsModelParams: 'Model Parameters',
  chatSettingsAgentProfile: 'Agent Profile',
  chatSettingsAgentTitlePlaceholder: 'Agent name',
  chatSettingsAgentDescPlaceholder: 'Add a description...',
  chatSettingsSystemPrompt: 'System Prompt',
  chatSettingsCustomInstructions: 'Custom Instructions',
  chatSettingsSystemPromptPlaceholder: 'Enter a custom system prompt to define the assistant\'s behavior...',
  chatSettingsGroup: 'Group',
  chatSettingsTag: 'Tag',
  chatSettingsDangerZone: 'Danger Zone',
  chatSettingsClearHistory: 'Clear History',
  chatSettingsDeleteConversation: 'Delete Session',
  chatSettingsDeleteConfirm: 'Delete Session',
  chatSettingsDeleteDesc: 'Delete this session and all its topics? This cannot be undone.',
  chatSettingsClearConfirm: 'Clear History',
  chatSettingsClearDesc: 'This will clear all messages in this session.',
  groupSettingsAllowDM: 'Allow Direct Messages',
  groupSettingsAllowDMDesc: 'Let group members send private replies when needed.',
  groupSettingsRevealDM: 'Show Private Messages',
  groupSettingsRevealDMDesc: 'Make private replies from other members visible in the session.',
  groupSettingsMembers: 'Members',
  groupSettingsMembersEmpty: 'No members yet.',
  groupSettingsSupervisor: 'Host',
  groupSettingsRemoveMemberConfirm: 'Remove Member',
  groupSettingsRemoveMemberDesc:
    'This member will be removed from the group. Virtual members may also be deleted permanently.',
  groupAddMembers: 'Add Members',
  groupCreateDefaultTitle: 'New Group Chat',
  groupStartConversation: 'Start Conversation',
  groupCreateSupervisorModel: 'Host model',
  groupMentionAllMembers: 'All members',
  groupMentionTitle: 'Mention',
  taskGroupTasks: '{{count}} parallel tasks',
  taskGroupTasksTitle: '{{agents}} and {{count}} agents tasks',
  taskGroupTasksTitleSimple: '{{agents}} {{count}} tasks',

  notebookTitle: 'Notebook',
  notebookDesc: 'Your personal notes and documents',
  notebookEmpty: 'No documents yet',
  notebookNewDoc: 'New Document',
  notebookDocTitle: 'Title',
  notebookDocTitlePlaceholder: 'Document title...',
  notebookDocContentPlaceholder: 'Start writing in Markdown...',
  notebookDeleteConfirm: 'Delete Document',
  notebookDeleteDesc: 'Are you sure you want to delete this document?',
  notebookSaved: 'Document saved',
  notebookUnsavedTitle: 'Unsaved Changes',
  notebookUnsavedDesc: 'You have unsaved changes. Discard them?',
  notebookDiscard: 'Discard',
  notebookPreview: 'Preview',
  notebookEdit: 'Edit',

  settingsTitle: 'Settings',
  settingsServer: 'Server',
  settingsServerConfig: 'Server Configuration',
  settingsServerConfigDesc: 'Configure your Avato server URL',
  settingsAiConfig: 'AI Configuration',
  settingsAiProviders: 'AI Providers',
  settingsAiProvidersDesc: 'Manage API keys & provider settings',
  settingsDefaultModel: 'Default Model',
  settingsDefaultAgent: 'Default Agent',
  agentConfigTitle: 'Agent Settings',
  agentConfigLegacyTitle: 'Legacy Agent',
  agentConfigAvatar: 'Avatar',
  agentConfigBasic: 'Basic',
  agentConfigChats: 'Session',
  agentConfigInstruction: 'Instruction',
  agentConfigModel: 'Model',
  agentConfigName: 'Name',
  agentConfigProvider: 'Provider',
  agentConfigMeta: 'Assistant Info',
  agentConfigOpening: 'Opening',
  agentConfigModal: 'Model',
  agentConfigDescription: 'Description',
  agentConfigTags: 'Tags',
  agentConfigBackgroundColor: 'Background Color',
  agentConfigOpeningMessage: 'Opening Message',
  agentConfigOpeningQuestions: 'Opening Questions',
  agentConfigOpeningQuestionsPlaceholder: 'One question per line',
  agentConfigAutoCreateTopic: 'Auto create topic',
  agentConfigAutoCreateTopicThreshold: 'Auto topic threshold',
  agentConfigEnableHistory: 'Use history context',
  agentConfigHistoryCount: 'History count',
  agentConfigCompressHistory: 'Compress history',
  agentConfigAutoScroll: 'Auto scroll while streaming',
  agentConfigTemperature: 'Temperature',
  agentConfigTopP: 'Top P',
  agentConfigPresencePenalty: 'Presence penalty',
  agentConfigFrequencyPenalty: 'Frequency penalty',
  agentConfigMaxTokens: 'Max tokens',
  agentConfigStreaming: 'Enable streaming',
  agentConfigSaved: 'Agent settings saved',
  agentConfigSessionOnlyTitle: 'Session-based agent settings',
  agentConfigSessionOnlyDesc:
    'Agent configuration now lives inside each session, matching the web version. Pick an agent from the store, then edit it from session settings.',
  agentConfigOpenStore: 'Open Agent Store',
  agentConfigSkills: 'Skills',
  agentConfigSkillsIds: 'Skill IDs (comma-separated)',
  agentConfigAdvanced: 'Advanced',
  agentConfigNamePlaceholder: 'Name your assistant',
  agentConfigDescriptionPlaceholder: 'Add a short description',
  agentConfigAvatarPlaceholder: 'Emoji or image URL',
  agentConfigSearchMode: 'Web Search',
  agentConfigSearchOff: 'Off',
  agentConfigSearchAuto: 'Auto',
  agentConfigSkillsEmpty: 'No skills selected',
  agentConfigSkillsCount: '{count} skills selected',
  agentCurrent: 'Current',
  agentNoDescription: 'No description',
  agentsEmpty: 'No agents yet',
  agentsEmptyDesc: 'Create an agent to get started.',
  agentFirstHint: 'Create an agent first',
  agentFirstHintDesc: 'Choose or create an agent to personalize your sessions.',
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
  settingsGroupWorkspace: 'Workspace',
  settingsGroupConnection: 'Connection & AI',
  settingsGroupServerInfo: 'Server',
  settingsGroupAppearance: 'Appearance',
  settingsGroupI18n: 'Internationalization',
  settingsGroupMemory: 'Memory',
  settingsGroupData: 'Data & Voice',
  settingsGroupAccount: 'Account',

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
  themeColorScheme: 'Color',
  themeColorAmber: 'Amber',
  themeColorBlue: 'Blue',
  themeColorViolet: 'Violet',
  themeColorGreen: 'Green',
  themeColorSlate: 'Slate',
  themeColorRose: 'Rose',
  themeColorSage: 'Sage',
  themeColorDustBlue: 'Dust Blue',

  homeHeroPlaceholder: 'What do you want to do?',
  homeQuickWrite: 'New Topic',
  homeQuickCode: 'Agents',
  homeQuickAnalyze: 'Groups',
  homeQuickCreate: 'Art',
  homeAgentAll: 'All',
  homeRecents: 'Assistants',
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
  msgActionShare: 'Share',
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
  topicEmptyDesc: 'Create a topic to organize your conversations.',
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
  tagCreate: 'Create Tag',
  tagEdit: 'Edit Tag',
  tagPlaceholder: 'Enter tag name...',
  tagColor: 'Color',
  tagMoveSession: 'Move to Tag',
  tagNone: 'No Tag',
  tagDeleteConfirm: 'Delete Tag',
  tagDeleteDesc: 'Delete this tag? Topics using it will become untagged.',

  discoverUseAgent: 'Use Agent',
  discoverAgentDetail: 'Agent Detail',
  discoverModelDetail: 'Model Detail',
  discoverProviderDetail: 'Provider Detail',
  discoverFeatured: 'Featured',
  discoverAll: 'All',
  discoverNoResults: 'No results found',

  fileAttach: 'Attach',
  fileCamera: 'Camera',
  fileDocument: 'Document',
  fileFromWorkspace: 'From Workspace',
  fileFromWorkspaceDesc: 'Import files from your resource workspace.',
  fileGallery: 'Photo Library',
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
  logsCapture: 'Capture App Logs',
  logsCaptureDesc: 'When enabled, the app records console errors, crashes, and rejected promises.',
  logsView: 'View Logs',
  logsViewDesc: 'Review recent app errors and copy them for debugging.',
  logsTitle: 'App Logs',
  logsCopy: 'Copy',
  logsClear: 'Clear',
  logsEmpty: 'No logs captured yet.',
  logsCopied: 'Logs copied',
  logsEnabled: 'App logging enabled',
  logsDisabled: 'App logging disabled',
  logsCrashHint: 'Open App Logs after restarting to inspect the captured error.',
  chatListLoadFailed: 'The session list could not be loaded. Try again after the server finishes syncing.',

  toastSessionCreated: 'Session created',
  toastSessionDeleted: 'Session deleted',
  toastMessageDeleted: 'Message deleted',
  toastCopied: 'Copied to clipboard',
  toastPinned: 'Pinned',
  toastUnpinned: 'Unpinned',
  toastTopicCreated: 'Topic created',
  toastTopicDeleted: 'Topic deleted',
  toastSaved: 'Saved',
  toastTitleGenerationFailed: 'Failed to generate title',
  toastTitleGenerationFailedHint:
    'Ensure the chat has messages and the title model is configured.',
  toastTopicCreateFailed: 'Failed to create topic',
  toastGenerationStopped: 'Generation stopped',
  toastFilePicked: 'File added',
  toastConnectionRestored: 'Connection restored',

  errorNetwork: 'Network error. Please check your connection.',
  errorServer: 'Server error. Please try again later.',
  errorAuth: 'Authentication failed. Please go to Settings or Login to reconfigure.',
  errorAuthGoToLogin: 'Go to Login',
  errorTimeout: 'Request timed out. Please try again.',
  errorProviderOverloaded: 'The provider is currently overloaded, please try again later.',
  errorUnknown: 'Something went wrong.',
  errorRetry: 'Retry',
  errorOffline: 'You are offline',
  errorSendFailed: 'Failed to send message',
  errorDeleteFailed: 'Failed to delete',
  errorEditFailed: 'Failed to save edit',
  errorSaveFailed: 'Failed to save',
  loginChangeServer: 'Server',
  loginDesc: 'Sign in to continue to your workspace.',
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

  deleteSessionConfirm: 'Delete Session',
  deleteSessionDesc: 'Delete this session and all its topics? This cannot be undone.',
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
  settingsSavedChat: 'Session settings saved',
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
  groupEmptyDesc: 'Create groups to organize your sessions.',
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
  activeAssistants: '{count} assistants',
  activeGroups: '{count} groups',
  activeTopics: '{count} topics',
  activeChats: '{count} sessions',
  chatEmptyWave: 'Hey there \u{1F44B}',
  relativeTimeNow: 'now',
  relativeTimeMinutes: '{count}m',
  relativeTimeHours: '{count}h',
  relativeTimeDays: '{count}d',

  actionRename: 'Rename',
  actionSmartRename: 'Smart Rename',
  sessionRenamed: 'Session renamed',
  sessionRenameTitle: 'Rename Session',
  sessionRenamePlaceholder: 'Enter new name...',
  topicRename: 'Rename Topic',
  topicRenamed: 'Topic renamed',
  topicRenamePlaceholder: 'Enter topic name...',
  modelPickerOffline: 'Showing built-in models. Connect to server for full list.',

  chatClearTitle: 'Clear Messages',
  chatClearMessage: 'This will clear all messages in this session. This action cannot be undone.',
  chatClearConfirm: 'Clear',
  chatScrollToTop: 'Scroll to top',
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
  resourceUploaded: 'Uploaded successfully',
  resourceDownload: 'Download',
  resourceDownloaded: 'Saved to local files',
  resourceDownloadFailed: 'Download failed',
  resourceCachedLocal: 'Available offline',
  resourceCachingPreview: 'Caching preview',
  resourceCollapseAll: 'Collapse all',
  resourceCurrentFolder: 'Current folder',
  resourceExpandAll: 'Expand all',
  resourceExplorer: 'Explorer',
  resourceOpenExternal: 'Open in Browser',
  resourcePreviewUnavailable: 'Unable to load preview',
  resourceDeleteFailed: 'Delete failed',
  resourceRenameFailed: 'Rename failed',
  resourceRenamePlaceholder: 'Enter new name',
  resourceRenamed: 'Renamed successfully',
  resourceShareFailed: 'Share failed',
  resourceBytes: 'B',
  resourceKB: 'KB',
  resourceMB: 'MB',
  resourceGB: 'GB',
  resourceLibraryAll: 'All Files',
  resourceLibraryInbox: 'Uncategorized',
  resourceFolderRoot: 'Root',
  resourceLibrarySelect: 'Select Library',
  resourceNewFolder: 'New Folder',
  resourceMoveToFolder: 'Move to Folder',
  resourceFolderDeleteConfirm: 'Delete Folder',
  resourceFolderDeleteDesc: 'This folder and its contents will be permanently deleted.',
  resourceCreateFolder: 'Create Folder',
  resourceCreateFolderPlaceholder: 'Folder name',
  resourceSortBy: 'Sort by',
  resourceSortNewest: 'Newest first',
  resourceSortOldest: 'Oldest first',
  resourceSortName: 'Name',
  resourceSortSize: 'Size',
  resourceLoadMore: 'Load more',
  resourceFolderEmpty: 'This folder is empty',
  resourceFolderEmptyDesc: 'Upload files or create subfolders',
  resourceViewList: 'List',
  resourceViewGrid: 'Grid',
  resourceViewModeToggle: 'Toggle list or grid view',
  resourceSelect: 'Select',
  resourceSelectCount: '{count} selected',
  resourceBatchDelete: 'Delete',
  resourceBatchMove: 'Move',
  resourceCancelSelect: 'Cancel',

  tabStore: 'Store',
  storeSearch: 'Search extensions...',
  storeExplore: 'Explore',
  storeMcp: 'MCP',
  storeSkills: 'Skills',
  storeInstalled: 'Installed',
  storeEmpty: 'No extensions found',
  storeLoadFailed: 'Failed to load. Check your connection.',
  storeInstall: 'Install',
  storeManage: 'Manage',
  storeFeatured: 'Featured',
  storeCustom: 'Custom',
  storeBuiltIn: 'Built-in',
  storeFromStore: 'Store',
  storeImported: 'Imported',
  storeRemove: 'Remove',
  storeRemoveConfirm: 'Remove extension',
  storeRemoveDesc: 'Remove this extension?',
  storeRemoved: 'Extension removed',
  storeRemoveFailed: 'Failed to remove extension',
  storeAddTitle: 'Add Extension',
  storeImportUrl: 'Import from URL',
  storeImportGithub: 'Import from GitHub',
  storeUploadZip: 'Upload ZIP',
  storeImportUrlPlaceholder: 'https://example.com/extension.zip',
  storeImportGithubPlaceholder: 'https://github.com/user/repo',
  storeImportSuccess: 'Extension added',
  storeImportFailed: 'Failed to add extension',
  storeInstallSuccess: 'Extension installed',
  storeInstallFailed: 'Failed to install extension',
  storeAddCustomMcp: 'Add Custom MCP',
  storeCustomMcpSaved: 'Custom MCP added',

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
  skillsRecommendedBuiltins: 'Built-in defaults',
  skillsBuiltinArtifactsTitle: 'Artifacts',
  skillsBuiltinArtifactsDesc: 'Generate and preview interactive UI components and visualizations',
  skillsBuiltinMemoryTitle: 'User Memory',
  skillsBuiltinMemoryDesc: 'Remember user preferences, facts and context across sessions',
  skillsBuiltinCloudSandboxTitle: 'Cloud Sandbox',
  skillsBuiltinCloudSandboxDesc:
    'Execute code, run commands, and manage files in a secure cloud environment',
  skillsBuiltinGtdTitle: 'GTD Tools',
  skillsBuiltinGtdDesc: 'Plan goals and track progress with GTD methodology',
  skillsBuiltinNotebookTitle: 'Notebook',
  skillsBuiltinNotebookDesc: 'Create and manage documents in the topic notebook',
  skillsBuiltinCalculatorTitle: 'Calculator',
  skillsBuiltinCalculatorDesc:
    'Perform mathematical calculations, solve equations, and work with symbolic expressions',
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
  memoryToolOffDesc: 'AI will not search, create, or update memories in this session.',
  memoryToolOnTitle: 'Enable Memory Tool',
  memoryToolOnDesc: 'Allow AI to actively search and manage your memories during the session.',
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
  chatListSearch: '搜尋會話與訊息',
  chatListAll: '全部',
  chatListAgents: '助手',
  chatListCollapseAssistant: '收起',
  chatListExpandAssistant: '展開',
  chatListViewAssistant: '助理',
  chatListViewGroup: '群聊',
  chatListViewSession: '會話',
  chatListViewTopic: '話題',
  chatListAssistants: '助理',
  chatListTopicRecent: '最近',
  chatListTopics: '話題',
  chatListTopicEmpty: '暫無話題',
  chatListTopicEmptyDesc: '對話將顯示在這裡。',
  chatListEmpty: '暫無會話',
  chatListEmptyDesc: '點擊下方 + 按鈕建立你的第一個話題或群聊。',
  chatListGroupEmpty: '暫無群聊',
  chatListGroupEmptyDesc: '點擊下方 + 按鈕建立新的群組會話。',
  chatListCreateAgent: '新建助手',
  chatListCreateGroup: '新建群組會話',
  chatListCreateTag: '新建標籤',
  chatListGroupTag: '群聊',
  chatListNewAssistant: '新助理',
  chatListNewConversation: '新會話',
  deleteTopicConfirm: '刪除此話題？',
  deleteTopicDesc: '此對話將被永久刪除。',
  chatSearchMatchMessage: '訊息',
  chatSearchMatchSession: '會話',
  chatSearchMatchTopic: '話題',
  chatSearchNoResults: '沒有符合的會話或話題',
  chatSearchResults: '搜尋結果',
  chatSearchSearching: '正在搜尋會話與話題...',
  accessibilityAddResource: '新增資源',
  accessibilityAddStore: '新增至商店',
  accessibilityAddTopic: '新增話題',
  accessibilityChatDirectory: '打開聊天目錄',
  accessibilityOpenStore: '開啟商店',
  accessibilityCreateMenu: '建立話題或群聊',
  accessibilityGoBack: '返回',
  accessibilitySave: '儲存',
  accessibilitySettings: '會話設定',
  accessibilityHintGoBack: '返回上一頁',
  accessibilityHintRetry: '雙擊重試',
  accessibilityHintSave: '儲存變更並返回',
  chatListTapToContinue: '點擊繼續會話',

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
  chatToolCompleted: '已完成',
  chatToolPending: '等待確認',
  chatToolRejected: '已拒絕',
  chatToolResponse: '響應',
  chatToolAborted: '已中止',
  chatToolApprove: '允許',
  chatToolApproveNotSupported: '此流程暫不支援工具批准。',
  chatToolReject: '拒絕',
  chatToolAbortedDesc: '此工具調用已中止。',
  chatToolRejectedDesc: '此工具調用已被拒絕。',
  chatToolPendingDesc: '此工具需要您的批准才能運行。',
  chatToolGtdTodoCount: '{{count}} 項待辦',
  chatToolGtdPlanGoalPlaceholder: '目標或目的',
  chatToolGtdPlanDescPlaceholder: '簡要說明',
  chatToolGtdPlanContextPlaceholder: '背景與約束',
  chatToolGtdAddTodoPlaceholder: '添加待辦',
  chatToolNotebookCreateDocTitlePlaceholder: '文檔標題',
  chatToolNotebookCreateDocDescPlaceholder: '簡要說明',
  chatToolNotebookCreateDocContentPlaceholder: '內容（Markdown）',
  chatToolStreamingCreatePlan: '正在創建計劃…',
  chatToolStreamingExecTask: '正在執行任務…',
  chatToolStreamingCreateDocument: '正在創建文檔…',
  chatToolStreamingExecuteCode: '正在執行代碼…',
  chatToolStreamingAddExperience: '正在添加經驗記憶…',
  chatToolStreamingAddPreference: '正在添加偏好記憶…',
  chatToolStreamingWebSearch: '正在搜索…',
  chatToolStreamingKnowledgeBase: '正在檢索知識庫…',
  chatToolStreamingSearchSkill: '正在搜索技能…',
  chatShowMore: '展開更多',
  chatShowLess: '收起',
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
  meAgents: '助手',
  meAgentsDesc: '管理並配置你的助手',
  meAgentConfigureFirst: '請先開始對話以配置此助手',
  agentDeleteConfirm: '刪除助手',
  agentDeleteDesc: '此助手及其聊天記錄將被永久刪除。',
  agentDeleteDefaultForbidden: '預設助手不可刪除。',
  meDiscover: '發現',
  meDiscoverDesc: '瀏覽助手、模型與服務商',
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

  chatSettingsTitle: '會話設定',
  chatSettingsModel: '模型',
  chatSettingsModelHint: '常用：gpt-4o、gpt-4o-mini、claude-3.5-sonnet、deepseek-chat',
  chatSettingsTemperature: '創意活躍度',
  chatSettingsTopP: '思維開放度',
  chatSettingsFrequencyPenalty: '詞彙豐富度',
  chatSettingsPresencePenalty: '表述發散度',
  chatSettingsMaxTokens: '單次回覆限制',
  chatSettingsEnableMaxTokens: '開啟單次回覆限制',
  chatSettingsModelParams: '模型參數',
  chatSettingsAgentProfile: '智能體設定',
  chatSettingsAgentTitlePlaceholder: '智能體名稱',
  chatSettingsAgentDescPlaceholder: '添加描述...',
  chatSettingsSystemPrompt: '系統提示詞',
  chatSettingsCustomInstructions: '自訂指令',
  chatSettingsSystemPromptPlaceholder: '輸入自訂系統提示詞來定義助手的行為...',
  chatSettingsGroup: '群組',
  chatSettingsTag: '標籤',
  chatSettingsDangerZone: '危險區域',
  chatSettingsClearHistory: '清空記錄',
  chatSettingsDeleteConversation: '刪除會話',
  chatSettingsDeleteConfirm: '刪除會話',
  chatSettingsDeleteDesc: '刪除此會話及其中所有話題？此操作無法復原。',
  chatSettingsClearConfirm: '清空記錄',
  groupSettingsAllowDM: '允許私訊',
  groupSettingsAllowDMDesc: '允許群組成員在需要時發送私密回覆。',
  groupSettingsRevealDM: '顯示私訊內容',
  groupSettingsRevealDMDesc: '讓其他成員的私密回覆也顯示在當前會話中。',
  groupSettingsMembers: '成員',
  groupSettingsMembersEmpty: '暫無成員。',
  groupSettingsSupervisor: '主持人',
  groupSettingsRemoveMemberConfirm: '移除成員',
  groupSettingsRemoveMemberDesc: '此成員將從群組中移除，虛擬成員也可能被永久刪除。',
  groupAddMembers: '新增成員',
  groupCreateDefaultTitle: '新群組會話',
  groupStartConversation: '開始對話',
  groupCreateSupervisorModel: '主持人模型',
  groupMentionAllMembers: '全體成員',
  groupMentionTitle: '提及',
  taskGroupTasks: '{{count}} 個並行任務',
  taskGroupTasksTitle: '{{agents}} 和 {{count}} 個代理任務',
  taskGroupTasksTitleSimple: '{{agents}} {{count}} 個任務',

  notebookTitle: '筆記本',
  notebookDesc: '你的個人筆記和文檔',
  notebookEmpty: '暫無文檔',
  notebookNewDoc: '新建文檔',
  notebookDocTitle: '標題',
  notebookDocTitlePlaceholder: '文檔標題...',
  notebookDocContentPlaceholder: '開始用 Markdown 撰寫...',
  notebookDeleteConfirm: '刪除文檔',
  notebookDeleteDesc: '確定要刪除此文檔嗎？',
  notebookSaved: '文檔已儲存',
  notebookUnsavedTitle: '未儲存的變更',
  notebookUnsavedDesc: '你有未儲存的變更。確定要捨棄嗎？',
  notebookDiscard: '捨棄',
  notebookPreview: '預覽',
  notebookEdit: '編輯',
  chatSettingsClearDesc: '這將清空此會話中的所有訊息。',

  settingsTitle: '設定',
  settingsServer: '伺服器',
  settingsServerConfig: '伺服器設定',
  settingsServerConfigDesc: '設定你的 Avato 伺服器 URL',
  settingsAiConfig: 'AI 設定',
  settingsAiProviders: 'AI 服務商',
  settingsAiProvidersDesc: '管理 API 金鑰和服務商設定',
  settingsDefaultModel: '預設模型',
  settingsDefaultAgent: '預設助手',
  agentConfigTitle: '助手設定',
  agentConfigLegacyTitle: '舊版助手',
  agentConfigAvatar: '頭像',
  agentConfigBasic: '基本',
  agentConfigChats: '會話偏好',
  agentConfigInstruction: '指令',
  agentConfigModel: '模型',
  agentConfigName: '名稱',
  agentConfigProvider: '供應商',
  agentConfigMeta: '助手資訊',
  agentConfigOpening: '開場',
  agentConfigModal: '模型',
  agentConfigDescription: '描述',
  agentConfigTags: '標籤',
  agentConfigBackgroundColor: '背景色',
  agentConfigOpeningMessage: '開場訊息',
  agentConfigOpeningQuestions: '開場問題',
  agentConfigOpeningQuestionsPlaceholder: '每行一個問題',
  agentConfigAutoCreateTopic: '自動建立話題',
  agentConfigAutoCreateTopicThreshold: '自動建話題門檻',
  agentConfigEnableHistory: '使用歷史上下文',
  agentConfigHistoryCount: '歷史數量',
  agentConfigCompressHistory: '壓縮歷史',
  agentConfigAutoScroll: '串流時自動捲動',
  agentConfigTemperature: 'Temperature',
  agentConfigTopP: 'Top P',
  agentConfigPresencePenalty: 'Presence penalty',
  agentConfigFrequencyPenalty: 'Frequency penalty',
  agentConfigMaxTokens: '最大 Token',
  agentConfigStreaming: '啟用串流',
  agentConfigSaved: '助手設定已儲存',
  agentConfigSessionOnlyTitle: '僅支援會話內助手設定',
  agentConfigSessionOnlyDesc:
    '助手設定現在和 Web 版一樣綁定在每段會話裡。先從商店選擇助手，再到會話設定中編輯。',
  agentConfigOpenStore: '打開助手商店',
  agentConfigSkills: '技能',
  agentConfigSkillsIds: '技能 ID（逗號分隔）',
  agentConfigAdvanced: '進階設定',
  agentConfigNamePlaceholder: '為你的助手命名',
  agentConfigDescriptionPlaceholder: '新增簡短描述',
  agentConfigAvatarPlaceholder: 'Emoji 或圖片 URL',
  agentConfigSearchMode: '網頁搜尋',
  agentConfigSearchOff: '關閉',
  agentConfigSearchAuto: '自動',
  agentConfigSkillsEmpty: '尚未選擇技能',
  agentConfigSkillsCount: '已選擇 {count} 個技能',
  agentCurrent: '當前',
  agentNoDescription: '暫無描述',
  agentsEmpty: '暫無助手',
  agentsEmptyDesc: '建立助手以開始使用。',
  agentFirstHint: '先建立助手',
  agentFirstHintDesc: '建立或選擇助手以開始個性化會話。',
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
  settingsGroupWorkspace: '工作區',
  settingsGroupConnection: '連接與 AI',
  settingsGroupServerInfo: '伺服器',
  settingsGroupAppearance: '外觀',
  settingsGroupI18n: '國際化',
  settingsGroupMemory: '記憶',
  settingsGroupData: '資料與語音',
  settingsGroupAccount: '帳戶',

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
  themeColorScheme: '色系',
  themeColorAmber: '琥珀',
  themeColorBlue: '藍色',
  themeColorViolet: '紫色',
  themeColorGreen: '綠色',
  themeColorSlate: '灰藍',
  themeColorRose: '玫瑰',
  themeColorSage: '鼠尾草',
  themeColorDustBlue: '霧藍',

  homeHeroPlaceholder: '你想做什麼？',
  homeQuickWrite: '新話題',
  homeQuickCode: '助手',
  homeQuickAnalyze: '群組',
  homeQuickCreate: '作圖',
  homeAgentAll: '全部',
  homeRecents: '助理',
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
  msgActionShare: '分享',
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
  topicEmptyDesc: '建立話題來組織你的對話。',
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
  tagCreate: '建立標籤',
  tagEdit: '編輯標籤',
  tagPlaceholder: '輸入標籤名稱...',
  tagColor: '顏色',
  tagMoveSession: '移動到標籤',
  tagNone: '無標籤',
  tagDeleteConfirm: '刪除標籤',
  tagDeleteDesc: '刪除此標籤？使用中的話題會改成未標籤。',

  discoverUseAgent: '使用助手',
  discoverAgentDetail: '助手詳情',
  discoverModelDetail: '模型詳情',
  discoverProviderDetail: '服務商詳情',
  discoverFeatured: '精選',
  discoverAll: '全部',
  discoverNoResults: '未找到結果',

  fileAttach: '附件',
  fileCamera: '拍照',
  fileDocument: '文件',
  fileFromWorkspace: '從工作區',
  fileFromWorkspaceDesc: '從資源工作區導入文件。',
  fileGallery: '相簿',
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
  logsCapture: '記錄 App 日誌',
  logsCaptureDesc: '開啟後會記錄 console 錯誤、崩潰與未處理的 Promise 拒絕。',
  logsView: '查看日誌',
  logsViewDesc: '檢視最近的 App 錯誤，並可複製給開發者。',
  logsTitle: 'App 日誌',
  logsCopy: '複製',
  logsClear: '清除',
  logsEmpty: '目前尚未捕捉到日誌。',
  logsCopied: '日誌已複製',
  logsEnabled: '已開啟 App 日誌',
  logsDisabled: '已關閉 App 日誌',
  logsCrashHint: '重新啟動後可到 App 日誌查看剛才捕捉到的錯誤。',
  chatListLoadFailed: '無法載入會話清單，請稍後再試，或等伺服器同步完成。',

  toastSessionCreated: '會話已建立',
  toastSessionDeleted: '會話已刪除',
  toastMessageDeleted: '訊息已刪除',
  toastCopied: '已複製到剪貼簿',
  toastPinned: '已釘選',
  toastUnpinned: '已取消釘選',
  toastTopicCreated: '話題已建立',
  toastTopicDeleted: '話題已刪除',
  toastSaved: '已儲存',
  toastTitleGenerationFailed: '標題生成失敗',
  toastTitleGenerationFailedHint: '請確保會話已有對話內容並已配置標題模型。',
  toastTopicCreateFailed: '話題創建失敗',
  toastGenerationStopped: '生成已停止',
  toastFilePicked: '檔案已新增',
  toastConnectionRestored: '連線已恢復',

  errorNetwork: '網路錯誤，請檢查連線。',
  errorServer: '伺服器錯誤，請稍後重試。',
  errorAuth: '驗證失敗，請前往設定或登入頁重新配置。',
  errorAuthGoToLogin: '前往登入',
  errorTimeout: '要求逾時，請重試。',
  errorProviderOverloaded: '服務繁忙，請稍後重試。',
  errorUnknown: '發生了一些問題。',
  errorRetry: '重試',
  errorOffline: '目前處於離線狀態',
  errorSendFailed: '訊息傳送失敗',
  errorDeleteFailed: '刪除失敗',
  errorEditFailed: '編輯儲存失敗',
  errorSaveFailed: '儲存失敗',
  loginChangeServer: '伺服器',
  loginDesc: '登入以繼續使用你的工作區。',
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

  deleteSessionConfirm: '刪除會話',
  deleteSessionDesc: '刪除此會話及其中所有話題？此操作無法撤銷。',
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
  settingsSavedChat: '會話設定已儲存',
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
  groupEmptyDesc: '建立群組來整理你的會話。',
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
  activeAssistants: '{count} 個助理',
  activeGroups: '{count} 個群聊',
  activeTopics: '{count} 個話題',
  activeChats: '{count} 個會話',
  chatEmptyWave: '嘿 \u{1F44B}',
  relativeTimeNow: '剛剛',
  relativeTimeMinutes: '{count} 分鐘前',
  relativeTimeHours: '{count} 小時前',
  relativeTimeDays: '{count} 天前',

  actionRename: '重新命名',
  actionSmartRename: '智能重命名',
  sessionRenamed: '會話已重新命名',
  sessionRenameTitle: '重新命名會話',
  sessionRenamePlaceholder: '輸入新名稱...',
  topicRename: '重新命名話題',
  topicRenamed: '話題已重新命名',
  topicRenamePlaceholder: '輸入話題名稱...',
  modelPickerOffline: '顯示內建模型清單，連線伺服器取得完整清單。',

  chatClearTitle: '清空訊息',
  chatClearMessage: '這將清空此會話中的所有訊息。此操作無法復原。',
  chatClearConfirm: '清空',
  chatScrollToTop: '回到頂部',
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
  resourceUploaded: '上傳成功',
  resourceDownload: '下載',
  resourceDownloaded: '已保存到本地檔案',
  resourceDownloadFailed: '下載失敗',
  resourceCachedLocal: '已快取到本地',
  resourceCachingPreview: '正在快取預覽',
  resourceCollapseAll: '全部收合',
  resourceCurrentFolder: '目前資料夾',
  resourceExpandAll: '全部展開',
  resourceExplorer: '資料總管',
  resourceOpenExternal: '在瀏覽器中打開',
  resourcePreviewUnavailable: '無法載入預覽',
  resourceDeleteFailed: '刪除失敗',
  resourceRenameFailed: '重新命名失敗',
  resourceRenamePlaceholder: '輸入新名稱',
  resourceRenamed: '重新命名成功',
  resourceShareFailed: '分享失敗',
  resourceBytes: 'B',
  resourceKB: 'KB',
  resourceMB: 'MB',
  resourceGB: 'GB',
  resourceLibraryAll: '全部檔案',
  resourceLibraryInbox: '未归类',
  resourceFolderRoot: '根目錄',
  resourceLibrarySelect: '選擇資源庫',
  resourceNewFolder: '新建資料夾',
  resourceMoveToFolder: '移至資料夾',
  resourceFolderDeleteConfirm: '刪除資料夾',
  resourceFolderDeleteDesc: '該資料夾及其內容將被永久刪除。',
  resourceCreateFolder: '建立資料夾',
  resourceCreateFolderPlaceholder: '資料夾名稱',
  resourceSortBy: '排序',
  resourceSortNewest: '最新優先',
  resourceSortOldest: '最早優先',
  resourceSortName: '名稱',
  resourceSortSize: '大小',
  resourceLoadMore: '載入更多',
  resourceFolderEmpty: '此資料夾為空',
  resourceFolderEmptyDesc: '上傳檔案或建立子資料夾',
  resourceViewList: '列表',
  resourceViewGrid: '網格',
  resourceViewModeToggle: '切換列表或網格檢視',
  resourceSelect: '選擇',
  resourceSelectCount: '已選 {count} 項',
  resourceBatchDelete: '刪除',
  resourceBatchMove: '移動',
  resourceCancelSelect: '取消',

  tabStore: '商店',
  storeSearch: '搜尋擴充項目...',
  storeExplore: '探索',
  storeMcp: 'MCP',
  storeSkills: '技能',
  storeInstalled: '已安裝',
  storeEmpty: '未找到擴充項目',
  storeLoadFailed: '載入失敗，請檢查網路連線。',
  storeInstall: '安裝',
  storeManage: '管理',
  storeFeatured: '精選',
  storeCustom: '自訂',
  storeBuiltIn: '內建',
  storeFromStore: '商店',
  storeImported: '已匯入',
  storeRemove: '移除',
  storeRemoveConfirm: '移除擴充項目',
  storeRemoveDesc: '要移除此擴充項目嗎？',
  storeRemoved: '已移除擴充項目',
  storeRemoveFailed: '移除擴充項目失敗',
  storeAddTitle: '新增擴充項目',
  storeImportUrl: '從 URL 匯入',
  storeImportGithub: '從 GitHub 匯入',
  storeUploadZip: '上傳 ZIP',
  storeImportUrlPlaceholder: 'https://example.com/extension.zip',
  storeImportGithubPlaceholder: 'https://github.com/user/repo',
  storeImportSuccess: '已新增擴充項目',
  storeImportFailed: '新增擴充項目失敗',
  storeInstallSuccess: '擴充項目已安裝',
  storeInstallFailed: '安裝擴充項目失敗',
  storeAddCustomMcp: '新增自訂 MCP',
  storeCustomMcpSaved: '已新增自訂 MCP',

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
  skillsRecommendedBuiltins: '預設內建技能',
  skillsBuiltinArtifactsTitle: 'Artifacts',
  skillsBuiltinArtifactsDesc: '生成並預覽互動式 UI 元件與視覺化內容',
  skillsBuiltinMemoryTitle: '使用者記憶',
  skillsBuiltinMemoryDesc: '跨會話記住使用者偏好、事實與上下文',
  skillsBuiltinCloudSandboxTitle: '雲沙盒',
  skillsBuiltinCloudSandboxDesc: '在安全的雲端環境中執行程式碼、命令與檔案操作',
  skillsBuiltinGtdTitle: 'GTD 工具',
  skillsBuiltinGtdDesc: '使用 GTD 方法規劃目標並追蹤進度',
  skillsBuiltinNotebookTitle: '筆記本',
  skillsBuiltinNotebookDesc: '在話題筆記本中建立與管理文件',
  skillsBuiltinCalculatorTitle: '計算器',
  skillsBuiltinCalculatorDesc: '進行數學計算、方程求解與符號運算',
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
  memoryToolOffDesc: 'AI 不會在此會話中搜尋、建立或更新記憶。',
  memoryToolOnTitle: '啟用記憶工具',
  memoryToolOnDesc: '允許 AI 在會話中主動搜尋和管理你的記憶。',
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
  chatListSearch: '搜索会话与消息',
  chatListAll: '全部',
  chatListAgents: '助手',
  chatListCollapseAssistant: '收起',
  chatListExpandAssistant: '展开',
  chatListViewAssistant: '助理',
  chatListViewGroup: '群聊',
  chatListViewSession: '会话',
  chatListViewTopic: '话题',
  chatListAssistants: '助理',
  chatListTopicRecent: '最近',
  chatListTopics: '话题',
  chatListTopicEmpty: '暂无话题',
  chatListTopicEmptyDesc: '对话将显示在这里。',
  chatListEmpty: '暂无会话',
  chatListEmptyDesc: '点击下方 + 按钮创建你的第一个话题或群聊。',
  chatListGroupEmpty: '暂无群聊',
  chatListGroupEmptyDesc: '点击下方 + 按钮创建新的群组会话。',
  chatListCreateAgent: '新建助手',
  chatListCreateGroup: '新建群组会话',
  chatListCreateTag: '新建标签',
  chatListGroupTag: '群聊',
  chatListNewAssistant: '新助理',
  chatListNewConversation: '新会话',
  deleteTopicConfirm: '删除此话题？',
  deleteTopicDesc: '此对话将被永久删除。',
  chatSearchMatchMessage: '消息',
  chatSearchMatchSession: '会话',
  chatSearchMatchTopic: '话题',
  chatSearchNoResults: '没有匹配的会话或话题',
  chatSearchResults: '搜索结果',
  chatSearchSearching: '正在搜索会话与话题...',
  accessibilityAddResource: '添加资源',
  accessibilityAddStore: '添加到商店',
  accessibilityAddTopic: '添加话题',
  accessibilityChatDirectory: '打开聊天目录',
  accessibilityOpenStore: '打开商店',
  accessibilityCreateMenu: '创建话题或群聊',
  accessibilityGoBack: '返回',
  accessibilitySave: '保存',
  accessibilitySettings: '会话设置',
  accessibilityHintGoBack: '返回上一屏',
  accessibilityHintRetry: '双击重试',
  accessibilityHintSave: '保存更改并返回',
  chatListTapToContinue: '点击继续会话',

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
  chatToolCompleted: '已完成',
  chatToolPending: '等待确认',
  chatToolRejected: '已拒绝',
  chatToolResponse: '响应',
  chatToolAborted: '已中止',
  chatToolApprove: '允许',
  chatToolApproveNotSupported: '此流程暂不支持工具批准。',
  chatToolReject: '拒绝',
  chatToolAbortedDesc: '此工具调用已中止。',
  chatToolRejectedDesc: '此工具调用已被拒绝。',
  chatToolPendingDesc: '此工具需要您的批准才能运行。',
  chatToolGtdTodoCount: '{{count}} 项待办',
  chatToolGtdPlanGoalPlaceholder: '目标或目的',
  chatToolGtdPlanDescPlaceholder: '简要说明',
  chatToolGtdPlanContextPlaceholder: '背景与约束',
  chatToolGtdAddTodoPlaceholder: '添加待办',
  chatToolNotebookCreateDocTitlePlaceholder: '文档标题',
  chatToolNotebookCreateDocDescPlaceholder: '简要说明',
  chatToolNotebookCreateDocContentPlaceholder: '内容（Markdown）',
  chatToolStreamingCreatePlan: '正在创建计划…',
  chatToolStreamingExecTask: '正在执行任务…',
  chatToolStreamingCreateDocument: '正在创建文档…',
  chatToolStreamingExecuteCode: '正在执行代码…',
  chatToolStreamingAddExperience: '正在添加经验记忆…',
  chatToolStreamingAddPreference: '正在添加偏好记忆…',
  chatToolStreamingWebSearch: '正在搜索…',
  chatToolStreamingKnowledgeBase: '正在检索知识库…',
  chatToolStreamingSearchSkill: '正在搜索技能…',
  chatShowMore: '展开更多',
  chatShowLess: '收起',
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
  meAgents: '助手',
  meAgentsDesc: '管理并配置你的助手',
  meAgentConfigureFirst: '请先开始对话以配置此助手',
  agentDeleteConfirm: '删除助手',
  agentDeleteDesc: '此助手及其聊天记录将被永久删除。',
  agentDeleteDefaultForbidden: '默认助手不可删除。',
  meDiscover: '发现',
  meDiscoverDesc: '浏览助手、模型与服务商',
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

  chatSettingsTitle: '会话设置',
  chatSettingsModel: '模型',
  chatSettingsModelHint: '常用：gpt-4o、gpt-4o-mini、claude-3.5-sonnet、deepseek-chat',
  chatSettingsTemperature: '创意活跃度',
  chatSettingsTopP: '思维开放度',
  chatSettingsFrequencyPenalty: '词汇丰富度',
  chatSettingsPresencePenalty: '表述发散度',
  chatSettingsMaxTokens: '单次回复限制',
  chatSettingsEnableMaxTokens: '开启单次回复限制',
  chatSettingsModelParams: '模型参数',
  chatSettingsAgentProfile: '智能体设置',
  chatSettingsAgentTitlePlaceholder: '智能体名称',
  chatSettingsAgentDescPlaceholder: '添加描述...',
  chatSettingsSystemPrompt: '系统提示词',
  chatSettingsCustomInstructions: '自定义指令',
  chatSettingsSystemPromptPlaceholder: '输入自定义系统提示词来定义助手的行为...',
  chatSettingsGroup: '分组',
  chatSettingsTag: '标签',
  chatSettingsDangerZone: '危险区域',
  chatSettingsClearHistory: '清空记录',
  chatSettingsDeleteConversation: '删除会话',
  chatSettingsDeleteConfirm: '删除会话',
  chatSettingsDeleteDesc: '删除此会话及其中所有话题？此操作无法撤销。',
  chatSettingsClearConfirm: '清空记录',
  chatSettingsClearDesc: '这将清空此会话中的所有消息。',
  groupSettingsAllowDM: '允许私信',
  groupSettingsAllowDMDesc: '允许群组成员在需要时发送私密回复。',
  groupSettingsRevealDM: '显示私信内容',
  groupSettingsRevealDMDesc: '让其他成员的私密回复也显示在当前会话中。',
  groupSettingsMembers: '成员',
  groupSettingsMembersEmpty: '暂无成员。',
  groupSettingsSupervisor: '主持人',
  groupSettingsRemoveMemberConfirm: '移除成员',
  groupSettingsRemoveMemberDesc: '此成员将从群组中移除，虚拟成员也可能被永久删除。',
  groupAddMembers: '添加成员',
  groupCreateDefaultTitle: '新群组会话',
  groupStartConversation: '开始对话',
  groupCreateSupervisorModel: '主持人模型',
  groupMentionAllMembers: '全体成员',
  groupMentionTitle: '提及',
  taskGroupTasks: '{{count}} 个并行任务',
  taskGroupTasksTitle: '{{agents}} 和 {{count}} 个代理任务',
  taskGroupTasksTitleSimple: '{{agents}} {{count}} 个任务',

  notebookTitle: '笔记本',
  notebookDesc: '你的个人笔记和文档',
  notebookEmpty: '暂无文档',
  notebookNewDoc: '新建文档',
  notebookDocTitle: '标题',
  notebookDocTitlePlaceholder: '文档标题...',
  notebookDocContentPlaceholder: '开始用 Markdown 撰写...',
  notebookDeleteConfirm: '删除文档',
  notebookDeleteDesc: '确定要删除此文档吗？',
  notebookSaved: '文档已保存',
  notebookUnsavedTitle: '未保存的更改',
  notebookUnsavedDesc: '你有未保存的更改。确定要丢弃吗？',
  notebookDiscard: '丢弃',
  notebookPreview: '预览',
  notebookEdit: '编辑',

  settingsTitle: '设置',
  settingsServer: '服务器',
  settingsServerConfig: '服务器配置',
  settingsServerConfigDesc: '配置你的 Avato 服务器 URL',
  settingsAiConfig: 'AI 配置',
  settingsAiProviders: 'AI 服务商',
  settingsAiProvidersDesc: '管理 API 密钥和服务商设置',
  settingsDefaultModel: '默认模型',
  settingsDefaultAgent: '默认助手',
  agentConfigTitle: '助手设置',
  agentConfigLegacyTitle: '旧版助手',
  agentConfigAvatar: '头像',
  agentConfigBasic: '基本',
  agentConfigChats: '会话偏好',
  agentConfigInstruction: '指令',
  agentConfigModel: '模型',
  agentConfigName: '名称',
  agentConfigProvider: '供应商',
  agentConfigMeta: '助手信息',
  agentConfigOpening: '开场',
  agentConfigModal: '模型',
  agentConfigDescription: '描述',
  agentConfigTags: '标签',
  agentConfigBackgroundColor: '背景色',
  agentConfigOpeningMessage: '开场消息',
  agentConfigOpeningQuestions: '开场问题',
  agentConfigOpeningQuestionsPlaceholder: '每行一个问题',
  agentConfigAutoCreateTopic: '自动创建话题',
  agentConfigAutoCreateTopicThreshold: '自动建话题阈值',
  agentConfigEnableHistory: '使用历史上下文',
  agentConfigHistoryCount: '历史数量',
  agentConfigCompressHistory: '压缩历史',
  agentConfigAutoScroll: '流式生成时自动滚动',
  agentConfigTemperature: 'Temperature',
  agentConfigTopP: 'Top P',
  agentConfigPresencePenalty: 'Presence penalty',
  agentConfigFrequencyPenalty: 'Frequency penalty',
  agentConfigMaxTokens: '最大 Token',
  agentConfigStreaming: '启用流式输出',
  agentConfigSaved: '助手设置已保存',
  agentConfigSessionOnlyTitle: '仅支持会话内助手设置',
  agentConfigSessionOnlyDesc:
    '助手配置现在和 Web 版一样绑定在每段会话里。先从商店选择助手，再到会话设置中编辑。',
  agentConfigOpenStore: '打开助手商店',
  agentConfigSkills: '技能',
  agentConfigSkillsIds: '技能 ID（逗号分隔）',
  agentConfigAdvanced: '进阶设置',
  agentConfigNamePlaceholder: '给你的助手起个名字',
  agentConfigDescriptionPlaceholder: '添加一句简短描述',
  agentConfigAvatarPlaceholder: 'Emoji 或图片 URL',
  agentConfigSearchMode: '网页搜索',
  agentConfigSearchOff: '关闭',
  agentConfigSearchAuto: '自动',
  agentConfigSkillsEmpty: '暂未选择技能',
  agentConfigSkillsCount: '已选择 {count} 个技能',
  agentCurrent: '当前',
  agentNoDescription: '暂无描述',
  agentsEmpty: '暂无助手',
  agentsEmptyDesc: '创建助手以开始使用。',
  agentFirstHint: '先创建助手',
  agentFirstHintDesc: '创建或选择助手以开始个性化会话。',
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
  settingsGroupWorkspace: '工作区',
  settingsGroupConnection: '连接与 AI',
  settingsGroupServerInfo: '服务器',
  settingsGroupAppearance: '外观',
  settingsGroupI18n: '国际化',
  settingsGroupMemory: '记忆',
  settingsGroupData: '数据与语音',
  settingsGroupAccount: '账户',

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
  themeColorScheme: '色系',
  themeColorAmber: '琥珀',
  themeColorBlue: '蓝色',
  themeColorViolet: '紫色',
  themeColorGreen: '绿色',
  themeColorSlate: '灰蓝',
  themeColorRose: '玫瑰',
  themeColorSage: '鼠尾草',
  themeColorDustBlue: '雾蓝',

  homeHeroPlaceholder: '你想做什么？',
  homeQuickWrite: '新话题',
  homeQuickCode: '助手',
  homeQuickAnalyze: '群组',
  homeQuickCreate: '作图',
  homeAgentAll: '全部',
  homeRecents: '助理',
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
  msgActionShare: '分享',
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
  topicEmptyDesc: '创建话题来组织你的对话。',
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
  tagCreate: '创建标签',
  tagEdit: '编辑标签',
  tagPlaceholder: '输入标签名称...',
  tagColor: '颜色',
  tagMoveSession: '移动到标签',
  tagNone: '无标签',
  tagDeleteConfirm: '删除标签',
  tagDeleteDesc: '删除此标签？使用它的话题会变成未打标签。',

  discoverUseAgent: '使用助手',
  discoverAgentDetail: '助手详情',
  discoverModelDetail: '模型详情',
  discoverProviderDetail: '服务商详情',
  discoverFeatured: '精选',
  discoverAll: '全部',
  discoverNoResults: '未找到结果',

  fileAttach: '附件',
  fileCamera: '拍照',
  fileDocument: '文档',
  fileFromWorkspace: '从工作区',
  fileFromWorkspaceDesc: '从资源工作区导入文件。',
  fileGallery: '相册',
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
  logsCapture: '记录 App 日志',
  logsCaptureDesc: '开启后会记录 console 错误、崩溃和未处理的 Promise 拒绝。',
  logsView: '查看日志',
  logsViewDesc: '查看最近的 App 错误，并可复制给开发者。',
  logsTitle: 'App 日志',
  logsCopy: '复制',
  logsClear: '清除',
  logsEmpty: '暂时还没有捕捉到日志。',
  logsCopied: '日志已复制',
  logsEnabled: '已开启 App 日志',
  logsDisabled: '已关闭 App 日志',
  logsCrashHint: '重启后可以到 App 日志查看刚才捕捉到的错误。',
  chatListLoadFailed: '无法加载会话列表，请稍后重试，或等待服务器同步完成。',

  toastSessionCreated: '会话已创建',
  toastSessionDeleted: '会话已删除',
  toastMessageDeleted: '消息已删除',
  toastCopied: '已复制到剪贴板',
  toastPinned: '已置顶',
  toastUnpinned: '已取消置顶',
  toastTopicCreated: '话题已创建',
  toastTopicDeleted: '话题已删除',
  toastSaved: '已保存',
  toastTitleGenerationFailed: '标题生成失败',
  toastTitleGenerationFailedHint: '请确保会话已有对话内容并已配置标题模型。',
  toastTopicCreateFailed: '话题创建失败',
  toastGenerationStopped: '生成已停止',
  toastFilePicked: '文件已添加',
  toastConnectionRestored: '连接已恢复',

  errorNetwork: '网络错误，请检查连接。',
  errorServer: '服务器错误，请稍后重试。',
  errorAuth: '认证失败，请前往设置或登录页重新配置。',
  errorAuthGoToLogin: '前往登录',
  errorTimeout: '请求超时，请重试。',
  errorProviderOverloaded: '服务繁忙，请稍后重试。',
  errorUnknown: '出了点问题。',
  errorRetry: '重试',
  errorOffline: '当前处于离线状态',
  errorSendFailed: '消息发送失败',
  errorDeleteFailed: '删除失败',
  errorEditFailed: '编辑保存失败',
  errorSaveFailed: '保存失败',
  loginChangeServer: '服务器',
  loginDesc: '登录以继续使用你的工作区。',
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

  deleteSessionConfirm: '删除会话',
  deleteSessionDesc: '删除此会话及其中所有话题？此操作无法撤销。',
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
  settingsSavedChat: '会话设置已保存',
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
  groupEmptyDesc: '创建分组来整理你的会话。',
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
  activeAssistants: '{count} 个助理',
  activeGroups: '{count} 个群聊',
  activeTopics: '{count} 个话题',
  activeChats: '{count} 个会话',
  chatEmptyWave: '嘿 \u{1F44B}',
  relativeTimeNow: '刚刚',
  relativeTimeMinutes: '{count} 分钟前',
  relativeTimeHours: '{count} 小时前',
  relativeTimeDays: '{count} 天前',

  actionRename: '重命名',
  actionSmartRename: '智能重命名',
  sessionRenamed: '会话已重命名',
  sessionRenameTitle: '重命名会话',
  sessionRenamePlaceholder: '输入新名称...',
  topicRename: '重命名话题',
  topicRenamed: '话题已重命名',
  topicRenamePlaceholder: '输入话题名称...',
  modelPickerOffline: '显示内置模型列表，连接服务器获取完整列表。',

  chatClearTitle: '清空消息',
  chatClearMessage: '这将清空此会话中的所有消息。此操作无法撤销。',
  chatClearConfirm: '清空',
  chatScrollToTop: '回到顶部',
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
  resourceUploaded: '上传成功',
  resourceDownload: '下载',
  resourceDownloaded: '已保存到本地文件',
  resourceDownloadFailed: '下载失败',
  resourceCachedLocal: '已缓存到本地',
  resourceCachingPreview: '正在缓存预览',
  resourceCollapseAll: '全部收拢',
  resourceCurrentFolder: '当前文件夹',
  resourceExpandAll: '全部展开',
  resourceExplorer: '资源目录',
  resourceOpenExternal: '在浏览器中打开',
  resourcePreviewUnavailable: '无法加载预览',
  resourceDeleteFailed: '删除失败',
  resourceRenameFailed: '重命名失败',
  resourceRenamePlaceholder: '输入新名称',
  resourceRenamed: '重命名成功',
  resourceShareFailed: '分享失败',
  resourceBytes: 'B',
  resourceKB: 'KB',
  resourceMB: 'MB',
  resourceGB: 'GB',
  resourceLibraryAll: '全部文件',
  resourceLibraryInbox: '未归类',
  resourceFolderRoot: '根目录',
  resourceLibrarySelect: '选择资源库',
  resourceNewFolder: '新建文件夹',
  resourceMoveToFolder: '移动到文件夹',
  resourceFolderDeleteConfirm: '删除文件夹',
  resourceFolderDeleteDesc: '该文件夹及其内容将被永久删除。',
  resourceCreateFolder: '创建文件夹',
  resourceCreateFolderPlaceholder: '文件夹名称',
  resourceSortBy: '排序',
  resourceSortNewest: '最新优先',
  resourceSortOldest: '最早优先',
  resourceSortName: '名称',
  resourceSortSize: '大小',
  resourceLoadMore: '加载更多',
  resourceFolderEmpty: '此文件夹为空',
  resourceFolderEmptyDesc: '上传文件或创建子文件夹',
  resourceViewList: '列表',
  resourceViewGrid: '网格',
  resourceViewModeToggle: '切换列表或网格视图',
  resourceSelect: '选择',
  resourceSelectCount: '已选 {count} 项',
  resourceBatchDelete: '删除',
  resourceBatchMove: '移动',
  resourceCancelSelect: '取消',

  tabStore: '商店',
  storeSearch: '搜索扩展...',
  storeExplore: '探索',
  storeMcp: 'MCP',
  storeSkills: '技能',
  storeInstalled: '已安装',
  storeEmpty: '未找到扩展',
  storeLoadFailed: '加载失败，请检查网络连接。',
  storeInstall: '安装',
  storeManage: '管理',
  storeFeatured: '精选',
  storeCustom: '自定义',
  storeBuiltIn: '内置',
  storeFromStore: '商店',
  storeImported: '已导入',
  storeRemove: '移除',
  storeRemoveConfirm: '移除扩展',
  storeRemoveDesc: '要移除此扩展吗？',
  storeRemoved: '已移除扩展',
  storeRemoveFailed: '移除扩展失败',
  storeAddTitle: '添加扩展',
  storeImportUrl: '从 URL 导入',
  storeImportGithub: '从 GitHub 导入',
  storeUploadZip: '上传 ZIP',
  storeImportUrlPlaceholder: 'https://example.com/extension.zip',
  storeImportGithubPlaceholder: 'https://github.com/user/repo',
  storeImportSuccess: '已添加扩展',
  storeImportFailed: '添加扩展失败',
  storeInstallSuccess: '扩展已安装',
  storeInstallFailed: '安装扩展失败',
  storeAddCustomMcp: '添加自定义 MCP',
  storeCustomMcpSaved: '已添加自定义 MCP',

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
  skillsRecommendedBuiltins: '默认内置技能',
  skillsBuiltinArtifactsTitle: 'Artifacts',
  skillsBuiltinArtifactsDesc: '生成并预览交互式 UI 组件和可视化内容',
  skillsBuiltinMemoryTitle: '用户记忆',
  skillsBuiltinMemoryDesc: '跨会话记住用户偏好、事实和上下文',
  skillsBuiltinCloudSandboxTitle: '云沙盒',
  skillsBuiltinCloudSandboxDesc: '在安全的云端环境中执行代码、命令并管理文件',
  skillsBuiltinGtdTitle: 'GTD 工具',
  skillsBuiltinGtdDesc: '使用 GTD 方法规划目标并跟踪进度',
  skillsBuiltinNotebookTitle: '笔记本',
  skillsBuiltinNotebookDesc: '在话题笔记本中创建和管理文档',
  skillsBuiltinCalculatorTitle: '计算器',
  skillsBuiltinCalculatorDesc: '执行数学计算、解方程并处理符号表达式',
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
  memoryToolOffDesc: 'AI 将不会在此会话中搜索、创建或更新记忆。',
  memoryToolOnTitle: '启用记忆工具',
  memoryToolOnDesc: '允许 AI 在会话中主动搜索和管理你的记忆。',
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
export interface I18nStore {
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
