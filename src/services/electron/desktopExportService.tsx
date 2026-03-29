import { type ShowSaveDialogParams } from '@lobechat/electron-client-ipc';
import { toast } from '@lobehub/ui';
import i18next from 'i18next';

import { localFileService } from './localFileService';

export interface DesktopExportOptions {
  content: string;
  encoding?: 'base64' | 'utf8';
  fileName: string;
  filters: ShowSaveDialogParams['filters'];
}

export interface DesktopExportResult {
  canceled: boolean;
  filePath?: string;
}

class DesktopExportService {
  private async exportFile(options: DesktopExportOptions): Promise<DesktopExportResult> {
    const { content, encoding = 'utf8', fileName, filters } = options;
    const result = await localFileService.showSaveDialog({
      defaultPath: fileName,
      filters,
      title: i18next.t('docEditor.exportDialogTitle', { ns: 'file' }),
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    await localFileService.writeFile({
      content,
      encoding,
      path: result.filePath,
    });

    this.showExportSuccessToast(result.filePath);

    return { canceled: false, filePath: result.filePath };
  }

  async exportCsv(options: Omit<DesktopExportOptions, 'encoding' | 'filters'>) {
    return this.exportFile({
      ...options,
      filters: [{ extensions: ['csv'], name: 'CSV' }],
    });
  }

  async exportMarkdown(options: Omit<DesktopExportOptions, 'encoding' | 'filters'>) {
    return this.exportFile({
      ...options,
      filters: [{ extensions: ['md'], name: 'Markdown' }],
    });
  }

  async exportXlsx(options: { base64Content: string; fileName: string }) {
    return this.exportFile({
      content: options.base64Content,
      encoding: 'base64',
      fileName: options.fileName,
      filters: [{ extensions: ['xlsx'], name: 'Excel Workbook' }],
    });
  }

  private showExportSuccessToast(filePath: string) {
    const t = i18next.t.bind(i18next);

    toast.success({
      actions: [
        {
          label: t('docEditor.exportActions.showInFolder', { ns: 'file' }),
          onClick: () => localFileService.openFileFolder(filePath),
          variant: 'text',
        },
        {
          label: t('docEditor.exportActions.openFile', { ns: 'file' }),
          onClick: () => localFileService.openLocalFile({ path: filePath }),
          variant: 'primary',
        },
      ],
      title: t('docEditor.exportSuccess', { ns: 'file' }),
    });
  }
}

export const desktopExportService = new DesktopExportService();
