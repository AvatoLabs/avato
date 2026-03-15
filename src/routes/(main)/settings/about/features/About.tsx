'use client';

import { SiDiscord, SiGithub, SiX, SiYoutube } from '@icons-pack/react-simple-icons';
import { BRANDING_EMAIL, BRANDING_NAME, SOCIAL_URL } from '@lobechat/business-const';
import { Flexbox, Form } from '@lobehub/ui';
import { Divider } from 'antd';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { GITHUB, mailTo, PRIVACY_URL, TERMS_URL } from '@/const/url';

import AboutList from './AboutList';
import ItemCard from './ItemCard';
import ItemLink from './ItemLink';
import Version from './Version';

const styles = createStaticStyles(({ css, cssVar }) => ({
  title: css`
    font-size: 14px;
    font-weight: bold;
    color: ${cssVar.colorTextSecondary};
  `,
}));

const About = memo<{ mobile?: boolean }>(({ mobile }) => {
  const { t } = useTranslation('common');
  const contactItems = [
    BRANDING_EMAIL.support
      ? {
          href: mailTo(BRANDING_EMAIL.support),
          label: t('mail.support'),
          value: 'support',
        }
      : null,
    BRANDING_EMAIL.business
      ? {
          href: mailTo(BRANDING_EMAIL.business),
          label: t('mail.business'),
          value: 'business',
        }
      : null,
  ].filter(Boolean);
  const infoItems = [
    {
      href: GITHUB,
      icon: SiGithub,
      label: 'GitHub',
      value: 'github',
    },
    SOCIAL_URL.discord
      ? {
          href: SOCIAL_URL.discord,
          icon: SiDiscord,
          label: 'Discord',
          value: 'discord',
        }
      : null,
    SOCIAL_URL.x
      ? {
          href: SOCIAL_URL.x,
          icon: SiX as any,
          label: 'X / Twitter',
          value: 'x',
        }
      : null,
    SOCIAL_URL.youtube
      ? {
          href: SOCIAL_URL.youtube,
          icon: SiYoutube,
          label: 'YouTube',
          value: 'youtube',
        }
      : null,
  ].filter(Boolean);
  const legalItems = [
    {
      href: TERMS_URL,
      label: t('terms'),
      value: 'terms',
    },
    {
      href: PRIVACY_URL,
      label: t('privacy'),
      value: 'privacy',
    },
  ].filter((item) => !!item.href);

  return (
    <Form.Group
      collapsible={false}
      gap={16}
      style={{ maxWidth: '1024px', width: '100%' }}
      title={`${t('about')} ${BRANDING_NAME}`}
      variant={'filled'}
    >
      <Flexbox gap={20} paddingBlock={20} width={'100%'}>
        <div className={styles.title}>{t('version')}</div>
        <Version mobile={mobile} />
        <Divider style={{ marginBlock: 0 }} />
        <div className={styles.title}>{t('contact')}</div>
        <AboutList
          ItemRender={ItemLink}
          items={
            [
              { href: GITHUB, label: t('officialSite'), value: 'officialSite' },
              ...contactItems,
            ] as any
          }
        />
        <Divider style={{ marginBlock: 0 }} />
        <div className={styles.title}>{t('information')}</div>
        <AboutList grid ItemRender={ItemCard} items={infoItems as any} />
        <Divider style={{ marginBlock: 0 }} />
        <div className={styles.title}>{t('legal')}</div>
        <AboutList ItemRender={ItemLink} items={legalItems} />
      </Flexbox>
    </Form.Group>
  );
});

export default About;
