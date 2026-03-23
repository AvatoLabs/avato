import { type PrimaryColors } from '@lobehub/ui';
import { ColorSwatches, findCustomThemeName, Flexbox, primaryColors } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

interface IProps {
  disabled?: boolean;
  onChange?: (v?: PrimaryColors) => void;
  value?: PrimaryColors;
}

const ThemeSwatchesPrimary = memo<IProps>(({ disabled, onChange, value }) => {
  const { t } = useTranslation('color');

  const handleSelect = (v: any) => {
    if (disabled) return;
    const name = findCustomThemeName('primary', v) as PrimaryColors | undefined;
    onChange?.(name);
  };

  return (
    <Flexbox style={disabled ? { opacity: 0.45, pointerEvents: 'none' } : undefined}>
      <ColorSwatches
        value={value ? primaryColors[value] : undefined}
        colors={[
          {
            color: 'rgba(0, 0, 0, 0)',
            title: t('default'),
          },
          {
            color: primaryColors.red,
            title: t('red'),
          },
          {
            color: primaryColors.orange,
            title: t('orange'),
          },
          {
            color: primaryColors.gold,
            title: t('gold'),
          },
          {
            color: primaryColors.yellow,
            title: t('yellow'),
          },
          {
            color: primaryColors.lime,
            title: t('lime'),
          },
          {
            color: primaryColors.green,
            title: t('green'),
          },
          {
            color: primaryColors.cyan,
            title: t('cyan'),
          },
          {
            color: primaryColors.blue,
            title: t('blue'),
          },
          {
            color: primaryColors.geekblue,
            title: t('geekblue'),
          },
          {
            color: primaryColors.purple,
            title: t('purple'),
          },
          {
            color: primaryColors.magenta,
            title: t('magenta'),
          },
          {
            color: primaryColors.volcano,
            title: t('volcano'),
          },
        ]}
        onChange={handleSelect}
      />
    </Flexbox>
  );
});

export default ThemeSwatchesPrimary;
