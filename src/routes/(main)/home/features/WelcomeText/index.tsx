import { Center } from '@lobehub/ui';
import { TypewriterEffect } from '@lobehub/ui/awesome';
import { LoadingDots } from '@lobehub/ui/chat';
import { cssVar } from 'antd-style';
import { shuffle } from 'es-toolkit/compat';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface WelcomeTextProps {
  align?: 'center' | 'left';
  compact?: boolean;
}

const WelcomeText = memo<WelcomeTextProps>(({ align = 'center', compact = false }) => {
  const { t, i18n } = useTranslation('welcome');
  const locale = i18n.language;

  const sentences = useMemo(() => {
    const messages = t('welcomeMessages', { returnObjects: true }) as Record<string, string>;
    return shuffle(Object.values(messages));
  }, [t]);

  return (
    <Center
      style={{
        fontSize: compact ? 18 : 28,
        fontWeight: 'bold',
        justifyContent: align === 'left' ? 'flex-start' : 'center',
        marginBlock: compact ? '0' : '36px 24px',
        width: '100%',
      }}
    >
      <TypewriterEffect
        cursorCharacter={<LoadingDots color={cssVar.colorText} size={20} variant={'pulse'} />}
        cursorFade={false}
        deletePauseDuration={1000}
        deletingSpeed={32}
        hideCursorWhileTyping={'afterTyping'}
        key={locale}
        pauseDuration={16_000}
        sentences={sentences}
        typingSpeed={64}
      />
    </Center>
  );
});

export default WelcomeText;
