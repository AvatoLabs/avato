import { type NeutralColors } from '@lobehub/ui';
import { ColorSwatches, findCustomThemeName, Flexbox, neutralColors } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

interface IProps {
  disabled?: boolean;
  onChange?: (v?: NeutralColors) => void;
  value?: NeutralColors;
}

const ThemeSwatchesNeutral = memo<IProps>(({ disabled, value, onChange }) => {
  const { t } = useTranslation('color');

  const handleSelect = (v: any) => {
    if (disabled) return;
    const name = findCustomThemeName('neutral', v) as NeutralColors | undefined;
    onChange?.(name);
  };

  return (
    <Flexbox style={disabled ? { opacity: 0.45, pointerEvents: 'none' } : undefined}>
      <ColorSwatches
        value={value ? neutralColors[value] : undefined}
        colors={[
          {
            color: 'rgba(0, 0, 0, 0)',
            title: t('default'),
          },
          {
            color: neutralColors.mauve,
            title: t('mauve'),
          },
          {
            color: neutralColors.olive,
            title: t('olive'),
          },
          {
            color: neutralColors.sage,
            title: t('sage'),
          },
          {
            color: neutralColors.sand,
            title: t('sand'),
          },
          {
            color: neutralColors.slate,
            title: t('slate'),
          },
        ]}
        onChange={handleSelect}
      />
    </Flexbox>
  );
});

export default ThemeSwatchesNeutral;
