import { Block, Button, Flexbox, Segmented, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
// import { PencilLineIcon } from 'lucide-react';
import { type FC } from 'react';
import { useTranslation } from 'react-i18next';

import Loading from '@/components/Loading/BrandTextLoading';
import WideScreenContainer from '@/features/WideScreenContainer';
import WideScreenButton from '@/features/WideScreenContainer/WideScreenButton';
import { useQueryState } from '@/hooks/useQueryParam';
import MemoryAnalysis from '@/routes/(main)/memory/features/MemoryAnalysis';
import MemoryEmpty from '@/routes/(main)/memory/features/MemoryEmpty';
import { SCROLL_PARENT_ID } from '@/routes/(main)/memory/features/TimeLineView/useScrollParent';
import { useUserMemoryStore } from '@/store/userMemory';

import { ActivitiesArea } from '../activities';
import ActivityRightPanel from '../activities/features/ActivityRightPanel';
import { ContextsArea } from '../contexts';
import ContextRightPanel from '../contexts/features/ContextRightPanel';
import { ExperiencesArea } from '../experiences';
import ExperienceRightPanel from '../experiences/features/ExperienceRightPanel';
import EditableModal from '../features/EditableModal';
import { IdentitiesArea } from '../identities';
import IdentityRightPanel from '../identities/features/IdentityRightPanel';
import { PreferencesArea } from '../preferences';
import PreferenceRightPanel from '../preferences/features/PreferenceRightPanel';
import Persona from './features/Persona';
import PersonaHeader from './features/Persona/PersonaHeader';
import RoleTagCloud from './features/RoleTagCloud';

const useStyles = createStyles(({ css, token }) => ({
  browseGrid: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  `,
  browseCard: css`
    height: 100%;
    padding: 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
    text-align: start;

    &:hover {
      border-color: ${token.colorPrimaryBorder};
      background: ${token.colorFillQuaternary};
    }
  `,
  focusShell: css`
    min-height: 0;
  `,
}));

type MemoryFocus = 'activities' | 'contexts' | 'experiences' | 'identities' | 'preferences';

const memoryFocuses: MemoryFocus[] = [
  'identities',
  'contexts',
  'preferences',
  'experiences',
  'activities',
];

const Home: FC = () => {
  const { t } = useTranslation('memory');
  const { styles } = useStyles();
  const [focusRaw, setFocusRaw] = useQueryState('focus', { clearOnDefault: true });
  const useFetchTags = useUserMemoryStore((s) => s.useFetchTags);
  const useFetchPersona = useUserMemoryStore((s) => s.useFetchPersona);
  const roles = useUserMemoryStore((s) => s.roles);
  const persona = useUserMemoryStore((s) => s.persona);

  const { isLoading: isTagsLoading } = useFetchTags();
  const { isLoading: isPersonaLoading } = useFetchPersona();
  // const { EditorModalElement, openEditor } = usePersonaEditor();
  const focus = memoryFocuses.includes(focusRaw as MemoryFocus) ? (focusRaw as MemoryFocus) : null;

  if (isTagsLoading || isPersonaLoading) return <Loading debugId={'Home'} />;

  if (focus) {
    const focusConfigs = {
      activities: {
        component: <ActivitiesArea />,
        description: t('browse.activities'),
        panel: <ActivityRightPanel />,
      },
      contexts: {
        component: <ContextsArea />,
        description: t('browse.contexts'),
        panel: <ContextRightPanel />,
      },
      experiences: {
        component: <ExperiencesArea />,
        description: t('browse.experiences'),
        panel: <ExperienceRightPanel />,
      },
      identities: {
        component: <IdentitiesArea />,
        description: t('browse.identities'),
        panel: <IdentityRightPanel />,
      },
      preferences: {
        component: <PreferencesArea />,
        description: t('browse.preferences'),
        panel: <PreferenceRightPanel />,
      },
    } satisfies Record<
      MemoryFocus,
      { component: React.ReactNode; description: string; panel: React.ReactNode }
    >;

    const activeFocus = focusConfigs[focus];

    return (
      <>
        <Flexbox className={styles.focusShell} flex={1} gap={16} height={'100%'}>
          <Block padding={16} variant={'outlined'}>
            <Flexbox gap={12}>
              <Flexbox horizontal align={'center'} gap={12} justify={'space-between'} wrap={'wrap'}>
                <Flexbox gap={6}>
                  <Text strong>{t('browse.title')}</Text>
                  <Text type={'secondary'}>{activeFocus.description}</Text>
                </Flexbox>
                <Button onClick={() => setFocusRaw(null)}>{t('tab.home')}</Button>
              </Flexbox>
              <Segmented
                block
                value={focus}
                options={memoryFocuses.map((item) => ({
                  label: t(`tab.${item}`),
                  value: item,
                }))}
                onChange={(value) => setFocusRaw(String(value) as MemoryFocus)}
              />
            </Flexbox>
          </Block>

          <Flexbox horizontal flex={1} style={{ minHeight: 0 }} width={'100%'}>
            {activeFocus.component}
            {activeFocus.panel}
          </Flexbox>
        </Flexbox>
        <EditableModal />
      </>
    );
  }

  return (
    <Flexbox flex={1} height={'100%'} style={{ position: 'relative' }}>
      <Flexbox
        horizontal
        gap={8}
        style={{ position: 'absolute', insetInlineEnd: 12, insetBlockStart: 12, zIndex: 2 }}
      >
        <MemoryAnalysis iconOnly />
        <WideScreenButton />
      </Flexbox>
      <Flexbox
        height={'100%'}
        id={SCROLL_PARENT_ID}
        style={{ overflowY: 'auto', paddingBottom: '16vh' }}
        width={'100%'}
      >
        <WideScreenContainer gap={32} paddingBlock={48}>
          <Flexbox gap={8}>
            <Text as={'h1'} fontSize={32} style={{ margin: 0 }} weight={700}>
              {t('personalTitle')}
            </Text>
            <Text type={'secondary'}>{t('personalSubtitle')}</Text>
          </Flexbox>

          <Block padding={18} variant={'outlined'}>
            <Flexbox gap={8}>
              <Text strong>{t('personalOverview.title')}</Text>
              <Text type={'secondary'}>{t('personalOverview.body')}</Text>
              <Text type={'secondary'}>{t('personalOverview.teamHint')}</Text>
            </Flexbox>
          </Block>

          <Block padding={18} variant={'outlined'}>
            <Flexbox gap={12}>
              <Flexbox gap={6}>
                <Text strong>{t('browse.title')}</Text>
                <Text type={'secondary'}>{t('browse.description')}</Text>
              </Flexbox>

              <div className={styles.browseGrid}>
                {[
                  {
                    description: t('browse.identities'),
                    key: 'identities',
                    title: t('tab.identities'),
                  },
                  {
                    description: t('browse.contexts'),
                    key: 'contexts',
                    title: t('tab.contexts'),
                  },
                  {
                    description: t('browse.preferences'),
                    key: 'preferences',
                    title: t('tab.preferences'),
                  },
                  {
                    description: t('browse.experiences'),
                    key: 'experiences',
                    title: t('tab.experiences'),
                  },
                  {
                    description: t('browse.activities'),
                    key: 'activities',
                    title: t('tab.activities'),
                  },
                ].map((item) => (
                  <Button
                    className={styles.browseCard}
                    key={item.key}
                    variant={'outlined'}
                    onClick={() => setFocusRaw(item.key as MemoryFocus)}
                  >
                    <Flexbox align={'flex-start'} gap={6}>
                      <Text strong>{item.title}</Text>
                      <Text size={'small'} type={'secondary'}>
                        {item.description}
                      </Text>
                    </Flexbox>
                  </Button>
                ))}
              </div>
            </Flexbox>
          </Block>

          {roles?.length > 0 && <RoleTagCloud tags={roles} />}
          {persona ? (
            <>
              <PersonaHeader />
              <Persona />
            </>
          ) : (
            !roles?.length && (
              <MemoryEmpty>
                <MemoryAnalysis />
              </MemoryEmpty>
            )
          )}
        </WideScreenContainer>
      </Flexbox>
      {/* {EditorModalElement} */}
    </Flexbox>
  );
};

export default Home;
