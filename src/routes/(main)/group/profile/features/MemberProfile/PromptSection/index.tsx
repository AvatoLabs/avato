'use client';

import { Flexbox, Icon } from '@lobehub/ui';
import { useTheme } from 'antd-style';
import { FileTextIcon, SparklesIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { EditorCanvas } from '@/features/EditorCanvas';

interface PromptSectionProps {
  editor: any;
  editorData: {
    content?: string;
    editorData?: Record<string, any>;
  };
  entityId: string;
  placeholder: string;
  onContentChange: () => void;
}

const PromptSection = memo<PromptSectionProps>(
  ({ editor, editorData, entityId, placeholder, onContentChange }) => {
    const { t } = useTranslation('setting');
    const theme = useTheme();

    return (
      <div
        style={{
          background: theme.colorBgContainer,
          borderRadius: theme.borderRadiusLG,
          marginBottom: 16,
          overflow: 'hidden',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${theme.colorBorderSecondary}`,
        }}
      >
        <Flexbox
          horizontal
          align={'center'}
          gap={12}
          padding={'16px 24px'}
          style={{ borderBottom: `1px solid ${theme.colorBorderSecondary}` }}
        >
          <Icon icon={FileTextIcon} size={{ size: 20 }} style={{ color: theme.colorPrimary }} />
          <span style={{ fontSize: 16, fontWeight: 600, color: theme.colorText }}>
            {t('settingAgent.prompt.title')}
          </span>
          <Flexbox
            horizontal
            align={'center'}
            gap={4}
            padding={'4px 8px'}
            style={{
              background: theme.colorPrimaryBg,
              borderRadius: theme.borderRadiusSM,
              marginLeft: 'auto',
            }}
          >
            <Icon icon={SparklesIcon} size={{ size: 12 }} style={{ color: theme.colorPrimary }} />
            <span style={{ fontSize: 12, color: theme.colorPrimary }}>
              {t('settingAgent.markdown.support')}
            </span>
          </Flexbox>
        </Flexbox>

        <Flexbox flex={1} style={{ padding: '16px 24px', overflow: 'auto' }}>
          <EditorCanvas
            editor={editor}
            editorData={editorData}
            entityId={entityId}
            placeholder={placeholder}
            onContentChange={onContentChange}
          />
        </Flexbox>
      </div>
    );
  },
);

PromptSection.displayName = 'PromptSection';

export default PromptSection;
