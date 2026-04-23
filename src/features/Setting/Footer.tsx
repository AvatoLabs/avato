'use client';

import { BRANDING_NAME } from '@lobechat/business-const';
import { Button, Center, Flexbox, Icon, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { Github, MessageSquareHeart, Star } from 'lucide-react';
import { type PropsWithChildren } from 'react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import GuideModal from '@/components/GuideModal';
import GuideVideo from '@/components/GuideVideo';
import { GITHUB, GITHUB_ISSUES, OFFICIAL_SITE } from '@/const/url';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';
import { isOnServerSide } from '@/utils/env';

const styles = createStaticStyles(({ css, cssVar }) => ({
  actionRow: css`
    width: 100%;

    @media (width <= 768px) {
      flex-direction: column;
      align-items: stretch;
    }
  `,
  container: css`
    width: 100%;
    max-width: 560px;
    padding: 16px;
    border: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 72%, transparent);
    border-radius: 20px;

    background: color-mix(in srgb, ${cssVar.colorBgContainer} 96%, ${cssVar.colorFillSecondary} 4%);
  `,
  desc: css`
    font-size: 12px;
    line-height: 1.6;
    color: ${cssVar.colorTextSecondary};
  `,
  kicker: css`
    font-size: 11px;
    font-weight: 600;
    color: ${cssVar.colorTextDescription};
    text-transform: uppercase;
    letter-spacing: 0.08em;
  `,
  title: css`
    font-size: 14px;
    font-weight: 600;
    line-height: 1.35;
    color: ${cssVar.colorText};
  `,
}));

export const LayoutSettingsFooterClassName = 'settings-layout-footer';

const Footer = memo<PropsWithChildren>(() => {
  const { t } = useTranslation('common');
  const [openStar, setOpenStar] = useState(false);
  const [openFeedback, setOpenFeedback] = useState(false);

  const { hideGitHub } = useServerConfigStore(featureFlagsSelectors);

  return hideGitHub ? null : (
    <>
      <Flexbox className={LayoutSettingsFooterClassName} justify={'flex-end'}>
        <Center horizontal as={'footer'} flex={'none'} padding={16} width={'100%'}>
          <Flexbox className={styles.container} gap={14}>
            <Flexbox gap={6}>
              <Flexbox horizontal align={'center'} gap={8}>
                <Icon icon={MessageSquareHeart} />
                <span className={styles.kicker}>{t('tab.setting')}</span>
              </Flexbox>
              <Text as={'div'} className={styles.title}>
                {t('footer.title')}
              </Text>
              <Text as={'div'} className={styles.desc}>
                {t('footer.feedback.desc', { appName: BRANDING_NAME })}
              </Text>
            </Flexbox>
            <Flexbox horizontal align={'center'} className={styles.actionRow} gap={8}>
              <Button icon={<Icon icon={Star} />} shape={'round'} onClick={() => setOpenStar(true)}>
                {t('footer.action.star')}
              </Button>
              <Button
                icon={<Icon icon={Github} />}
                shape={'round'}
                type={'primary'}
                onClick={() => setOpenFeedback(true)}
              >
                {t('footer.action.feedback')}
              </Button>
            </Flexbox>
          </Flexbox>
        </Center>
      </Flexbox>
      <GuideModal
        cancelText={t('footer.later')}
        desc={t('footer.star.desc')}
        okText={t('footer.star.action')}
        open={openStar}
        title={t('footer.star.title')}
        cover={<GuideVideo height={269} src={`${OFFICIAL_SITE}/assets/star.mp4`} width={358} />}
        onCancel={() => setOpenStar(false)}
        onOk={() => {
          if (isOnServerSide) return;
          window.open(GITHUB, '__blank');
        }}
      />
      <GuideModal
        cancelText={t('footer.later')}
        desc={t('footer.feedback.desc', { appName: BRANDING_NAME })}
        okText={t('footer.feedback.action')}
        open={openFeedback}
        title={t('footer.feedback.title')}
        cover={<GuideVideo height={269} src={`${OFFICIAL_SITE}/assets/feedback.mp4`} width={358} />}
        onCancel={() => setOpenFeedback(false)}
        onOk={() => {
          if (isOnServerSide) return;
          window.open(GITHUB_ISSUES, '__blank');
        }}
      />
    </>
  );
});

Footer.displayName = 'SettingFooter';

export default Footer;
