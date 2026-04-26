import { ActionIcon, Block, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { X } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { ACTION_ENTRY_ICONS, APP_ENTRY_ICONS } from '@/config/entryIcons';
import { useHomeStore } from '@/store/home/store';

const styles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    padding-inline-start: 12px;
    border-radius: 16px;
  `,
  title: css`
    font-size: 13px;
    font-weight: 500;
    color: ${cssVar.colorTextSecondary};
  `,
}));

const modeConfig = {
  agent: { icon: ACTION_ENTRY_ICONS.createAgent, titleKey: 'starter.createAgent' },
  group: { icon: ACTION_ENTRY_ICONS.createGroup, titleKey: 'starter.createGroup' },
  image: { icon: APP_ENTRY_ICONS.image, titleKey: 'starter.image' },
  research: { icon: APP_ENTRY_ICONS.search, titleKey: 'starter.deepResearch' },
  video: { icon: APP_ENTRY_ICONS.video, titleKey: 'starter.seedance' },
  write: { icon: ACTION_ENTRY_ICONS.write, titleKey: 'starter.write' },
} as const;

const ModeHeader = memo(() => {
  const { t } = useTranslation('home');

  const [inputActiveMode, clearInputMode] = useHomeStore((s) => [
    s.inputActiveMode,
    s.clearInputMode,
  ]);

  if (!inputActiveMode) return null;

  const config = modeConfig[inputActiveMode];
  const IconComponent = config.icon;

  return (
    <Block
      horizontal
      align="center"
      className={styles.container}
      gap={8}
      padding={4}
      variant={'filled'}
    >
      <IconComponent color={cssVar.colorTextDescription} size={16} />
      <Text fontSize={12} type={'secondary'}>
        {t(config.titleKey)}
      </Text>
      <ActionIcon
        icon={X}
        size="small"
        style={{
          borderRadius: 16,
        }}
        onClick={clearInputMode}
      />
    </Block>
  );
});

export default ModeHeader;
