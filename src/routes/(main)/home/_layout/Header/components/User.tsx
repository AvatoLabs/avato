'use client';

import { Plans } from '@lobechat/types';
import { Block, Flexbox, Icon, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { memo, useMemo } from 'react';

import { ProductLogo } from '@/components/Branding';
import { ENTRY_ICON_STROKE, SIDEBAR_HEADER_ICONS } from '@/config/entryIcons';
import UserAvatar from '@/features/User/UserAvatar';
import UserPanel from '@/features/User/UserPanel';
import { useUserStore } from '@/store/user';
import { authSelectors, userProfileSelectors } from '@/store/user/selectors';

export const USER_DROPDOWN_ICON_ID = 'user-dropdown-icon';

const styles = createStaticStyles(({ css, cssVar }) => ({
  /** ChatGPT-like: no tile until hover */
  account: css`
    width: 100%;
    border-radius: ${cssVar.borderRadiusLG};
    background: transparent !important;
    transition:
      background-color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      box-shadow ${cssVar.motionDurationFast} ${cssVar.motionEaseOut};

    &:hover {
      background: ${cssVar.colorFillQuaternary} !important;
    }
  `,
}));

const User = memo<{ lite?: boolean }>(({ lite }) => {
  const [nickname, username, isSignedIn, subscriptionPlan] = useUserStore((s) => [
    userProfileSelectors.nickName(s),
    userProfileSelectors.username(s),
    authSelectors.isLogin(s),
    s.subscriptionPlan,
  ]);

  /** 不展示「免费 / Free」标签；仅付费档显示第二行 */
  const planSubtitle = useMemo(() => {
    if (!isSignedIn || !subscriptionPlan) return null;
    if (subscriptionPlan === Plans.Free) return null;
    return subscriptionPlan.charAt(0).toUpperCase() + subscriptionPlan.slice(1);
  }, [isSignedIn, subscriptionPlan]);

  return (
    <UserPanel>
      <Block
        clickable
        horizontal
        align={'center'}
        className={styles.account}
        gap={0}
        paddingBlock={6}
        paddingInline={8}
        variant={'borderless'}
        style={{
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {lite ? (
          <UserAvatar shape={'circle'} size={24} />
        ) : (
          <Flexbox horizontal align={'center'} flex={1} gap={10} style={{ minWidth: 0 }}>
            <UserAvatar shape={'circle'} size={24} />
            <Flexbox vertical flex={1} gap={2} style={{ minWidth: 0 }}>
              {!isSignedIn && (nickname || username) ? (
                <ProductLogo color={cssVar.colorText} size={26} type={'text'} />
              ) : (
                <>
                  <Text
                    ellipsis
                    style={{
                      fontSize: cssVar.fontSize,
                      fontWeight: 450,
                      lineHeight: 1.25,
                    }}
                  >
                    {nickname || username}
                  </Text>
                  {planSubtitle ? (
                    <Text
                      ellipsis
                      fontSize={12}
                      style={{
                        color: cssVar.colorTextDescription,
                        lineHeight: 1.2,
                      }}
                    >
                      {planSubtitle}
                    </Text>
                  ) : null}
                </>
              )}
            </Flexbox>
            <Icon
              color={cssVar.colorTextDescription}
              icon={SIDEBAR_HEADER_ICONS.more}
              id={USER_DROPDOWN_ICON_ID}
              size={{ size: 16, strokeWidth: ENTRY_ICON_STROKE }}
              style={{ flex: 'none' }}
            />
          </Flexbox>
        )}
      </Block>
    </UserPanel>
  );
});

export default User;
