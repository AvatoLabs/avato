import { Button, Flexbox } from '@lobehub/ui';
import { App } from 'antd';
import { Plus } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useActionSWR } from '@/libs/swr';
import { useServerConfigStore } from '@/store/serverConfig';
import { useSessionStore } from '@/store/session';

const AddButton = memo<{ groupId?: string }>(({ groupId }) => {
  const { t } = useTranslation('chat');
  const { message } = App.useApp();
  const createSession = useSessionStore((s) => s.createSession);
  const mobile = useServerConfigStore((s) => s.isMobile);
  const { mutate, isValidating } = useActionSWR(['session.createSession', groupId], () => {
    return createSession({ group: groupId });
  });

  return (
    <Flexbox flex={1} padding={mobile ? 16 : 0}>
      <Button
        block
        icon={Plus}
        loading={isValidating}
        variant={'filled'}
        style={{
          marginTop: 8,
        }}
        onClick={() => {
          void mutate().catch((error) => {
            console.error('Failed to create session from mobile add button:', error);
            message.error({ content: t('createAgentFailed') });
          });
        }}
      >
        {t('newAgent')}
      </Button>
    </Flexbox>
  );
});

export default AddButton;
