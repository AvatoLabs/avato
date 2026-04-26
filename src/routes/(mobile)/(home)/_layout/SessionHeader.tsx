'use client';

import { ActionIcon, Flexbox, Text } from '@lobehub/ui';
import { ChatHeader } from '@lobehub/ui/mobile';
import { App } from 'antd';
import { MessageSquarePlus } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { ProductLogo } from '@/components/Branding';
import { MOBILE_HEADER_ICON_SIZE } from '@/const/layoutTokens';
import UserAvatar from '@/features/User/UserAvatar';
import { useSessionStore } from '@/store/session';
import { mobileHeaderSticky } from '@/styles/mobileHeader';

import { styles } from './SessionHeader/style';

const Header = memo(() => {
  const { t } = useTranslation(['common', 'chat']);
  const { message } = App.useApp();
  const [createSession] = useSessionStore((s) => [s.createSession]);
  const navigate = useNavigate();

  return (
    <ChatHeader
      style={mobileHeaderSticky}
      left={
        <Flexbox horizontal align={'center'} className={styles.leftContainer} gap={8}>
          <UserAvatar size={32} onClick={() => navigate('/me')} />
          <Flexbox className={styles.brandMeta} gap={2}>
            <div className={styles.brand}>
              <ProductLogo size={18} type={'text'} />
            </div>
            <Text ellipsis as={'div'} className={styles.brandSubtitle}>
              {t('tab.chat')}
            </Text>
          </Flexbox>
        </Flexbox>
      }
      right={
        <ActionIcon
          aria-label={t('newSession')}
          className={styles.action}
          icon={MessageSquarePlus}
          size={MOBILE_HEADER_ICON_SIZE}
          title={t('newSession')}
          onClick={() => {
            void createSession().catch((error) => {
              console.error('Failed to create session from mobile header:', error);
              message.error({ content: t('createAgentFailed', { ns: 'chat' }) });
            });
          }}
        />
      }
    />
  );
});

export default Header;
