'use client';

import { SiDiscord, SiGithub, SiMedium, SiX } from '@icons-pack/react-simple-icons';
import { SOCIAL_URL } from '@lobechat/business-const';
import { ActionIcon, Flexbox } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { GITHUB } from '@/const/url';

const styles = createStaticStyles(({ css }) => {
  return {
    icon: css`
      svg {
        fill: ${cssVar.colorTextDescription};
      }

      &:hover {
        svg {
          fill: ${cssVar.colorText};
        }
      }
    `,
  };
});

const Follow = memo(() => {
  const { t } = useTranslation('common');
  const socialItems = [
    { href: GITHUB, icon: SiGithub as any, name: 'GitHub' },
    SOCIAL_URL.x ? { href: SOCIAL_URL.x, icon: SiX as any, name: 'X' } : null,
    SOCIAL_URL.discord
      ? { href: SOCIAL_URL.discord, icon: SiDiscord as any, name: 'Discord' }
      : null,
    SOCIAL_URL.medium ? { href: SOCIAL_URL.medium, icon: SiMedium as any, name: 'Medium' } : null,
  ].filter(Boolean) as Array<{ href: string; icon: any; name: string }>;

  return (
    <Flexbox horizontal gap={8}>
      {socialItems.map((item) => (
        <a href={item.href} key={item.name} rel="noreferrer" target="_blank">
          <ActionIcon
            className={styles.icon}
            icon={item.icon}
            title={t('follow', { name: item.name })}
          />
        </a>
      ))}
    </Flexbox>
  );
});

Follow.displayName = 'Follow';

export default Follow;
