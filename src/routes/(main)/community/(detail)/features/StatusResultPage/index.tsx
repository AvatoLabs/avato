'use client';

import { ExclamationCircleOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { Button, FluentEmoji, Text } from '@lobehub/ui';
import { Result } from 'antd';
import { createStaticStyles, cssVar } from 'antd-style';
import { memo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const SUPPORT_EMAIL = 'support@avatohub.com';

const styles = createStaticStyles(({ css }) => ({
  container: css`
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;

    min-height: 60vh;
    padding: 20px;
  `,
  reasons: css`
    margin-block: 16px;
    padding-inline-start: 20px;
    text-align: start;
  `,
  subtitle: css`
    line-height: 1.6;
    color: ${cssVar.colorTextDescription};
    text-align: start;
  `,
}));

interface StatusResultPageProps {
  backTo: string;
  i18nPrefix: 'assistants.status' | 'groupAgents.status';
  status: 'unpublished' | 'archived' | 'deprecated';
}

const StatusResultPage = memo<StatusResultPageProps>(({ backTo, i18nPrefix, status }) => {
  const { t } = useTranslation('discover');
  const navigate = useNavigate();

  const backButton = (
    <Button size={'large'} type="primary" onClick={() => navigate(backTo)}>
      {t(`${i18nPrefix}.backToMarket`)}
    </Button>
  );

  if (status === 'unpublished') {
    return (
      <div className={styles.container}>
        <Result
          extra={backButton}
          icon={<FluentEmoji emoji={'⌛'} size={96} type={'anim'} />}
          subTitle={
            <Text fontSize={16} type={'secondary'}>
              <Trans
                i18nKey={`${i18nPrefix}.unpublished.subtitle`}
                ns="discover"
                components={{
                  email: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>,
                }}
              />
            </Text>
          }
          title={
            <Text fontSize={28} weight={'bold'}>
              {t(`${i18nPrefix}.unpublished.title`)}
            </Text>
          }
        />
      </div>
    );
  }

  const statusKey = status === 'archived' ? 'archived' : 'deprecated';

  const statusIcon =
    statusKey === 'archived' ? (
      <FolderOpenOutlined style={{ color: cssVar.colorTextDescription }} />
    ) : (
      <ExclamationCircleOutlined style={{ color: cssVar.colorError }} />
    );

  return (
    <div className={styles.container}>
      <Result
        extra={backButton}
        icon={statusIcon}
        title={t(`${i18nPrefix}.${statusKey}.title`)}
        subTitle={
          <div className={styles.subtitle}>
            <p>{t(`${i18nPrefix}.${statusKey}.subtitle`)}</p>
            <ul className={styles.reasons}>
              <li>{t(`${i18nPrefix}.${statusKey}.reasons.owner`)}</li>
              <li>{t(`${i18nPrefix}.${statusKey}.reasons.official`)}</li>
            </ul>
            <p>
              <Trans
                i18nKey={`${i18nPrefix}.support`}
                ns="discover"
                components={{
                  email: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>,
                }}
              />
            </p>
          </div>
        }
      />
    </div>
  );
});

export default StatusResultPage;
