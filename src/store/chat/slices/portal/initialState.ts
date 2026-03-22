import { type PortalArtifact } from '@/types/artifact';

export enum ArtifactDisplayMode {
  Code = 'code',
  Preview = 'preview',
}

// ============== Portal View Stack Types ==============

export enum PortalViewType {
  Artifact = 'artifact',
  Document = 'document',
  FilePreview = 'filePreview',
  GroupThread = 'groupThread',
  Home = 'home',
  MessageDetail = 'messageDetail',
  Notebook = 'notebook',
  Thread = 'thread',
  ToolUI = 'toolUI',
}

export interface PortalFile {
  chunkId?: string;
  chunkText?: string;
  fileId: string;
}

export type PortalViewData =
  | { type: PortalViewType.Home }
  | { artifact: PortalArtifact; type: PortalViewType.Artifact }
  | { documentId: string; type: PortalViewType.Document }
  | { type: PortalViewType.Notebook }
  | { file: PortalFile; type: PortalViewType.FilePreview }
  | { messageId: string; type: PortalViewType.MessageDetail }
  | { identifier: string; messageId: string; type: PortalViewType.ToolUI }
  | { startMessageId?: string; threadId?: string; type: PortalViewType.Thread }
  | { agentId: string; type: PortalViewType.GroupThread };

// ============== Portal State ==============

export interface ChatPortalState {
  portalArtifactDisplayMode: ArtifactDisplayMode;
  portalStack: PortalViewData[];
  showPortal: boolean;
}

export const initialChatPortalState: ChatPortalState = {
  portalArtifactDisplayMode: ArtifactDisplayMode.Preview,
  portalStack: [],
  showPortal: false,
};
