'use client';

import { Block, Flexbox, Icon, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { ChevronDownIcon } from 'lucide-react';
import { memo } from 'react';

import { ProductLogo } from '@/components/Branding';
import UserAvatar from '@/features/User/UserAvatar';
import UserPanel from '@/features/User/UserPanel';
import { useUserStore } from '@/store/user';
import { authSelectors, userProfileSelectors } from '@/store/user/selectors';

export const USER_DROPDOWN_ICON_ID = 'user-dropdown-icon';

const styles = createStaticStyles(({ css, cssVar }) => ({
  account: css`
    border-radius: ${cssVar.borderRadiusLG};
    transition:
      background-color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      box-shadow ${cssVar.motionDurationFast} ${cssVar.motionEaseOut};

    &:hover {
      background: ${cssVar.colorFillQuaternary} !important;
    }
  `,
}));

const User = memo<{ lite?: boolean }>(({ lite }) => {
  const [nickname, username, isSignedIn] = useUserStore((s) => [
    userProfileSelectors.nickName(s),
    userProfileSelectors.username(s),
    authSelectors.isLogin(s),
  ]);
  return (
    <UserPanel>
      <Block
        clickable
        horizontal
        align={'center'}
        className={styles.account}
        gap={8}
        paddingBlock={4}
        variant={'borderless'}
        style={{
          minWidth: 32,
          overflow: 'hidden',
          paddingInlineEnd: lite ? 2 : 10,
          paddingInlineStart: 4,
        }}
      >
        <UserAvatar shape={'square'} size={28} />
        {!lite && (
          <Flexbox horizontal align={'center'} gap={4} style={{ overflow: 'hidden' }}>
            {!isSignedIn && (nickname || username) ? (
              <ProductLogo color={cssVar.colorText} size={28} type={'text'} />
            ) : (
              <Text
                ellipsis
                weight={500}
                style={{
                  flex: 1,
                }}
              >
                {nickname || username}
              </Text>
            )}
            <Icon
              color={cssVar.colorTextDescription}
              icon={ChevronDownIcon}
              id={USER_DROPDOWN_ICON_ID}
            />
          </Flexbox>
        )}
      </Block>
    </UserPanel>
  );
});

export default User;
