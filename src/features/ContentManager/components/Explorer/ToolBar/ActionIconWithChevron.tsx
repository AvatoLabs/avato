import { Button, Flexbox, Icon } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { type ComponentProps, type ReactNode } from 'react';
import { memo } from 'react';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { type EntryIcon } from '@/config/entryIcons';

interface ActionIconWithChevronProps extends ComponentProps<typeof Button> {
  icon: EntryIcon;
  label?: ReactNode;
}

const ActionIconWithChevron = memo<ActionIconWithChevronProps>(
  ({ icon, label, title, style, disabled, className, ...rest }) => {
    return (
      <Button
        {...rest}
        className={className}
        disabled={disabled}
        style={{ paddingInline: label ? 10 : 4, ...style }}
        title={title}
        type={'text'}
      >
        <Flexbox horizontal align={'center'} gap={4}>
          <Icon color={cssVar.colorIcon} icon={icon} size={18} />
          {label ? (
            <span
              style={{
                color: cssVar.colorText,
                fontSize: 13,
                fontWeight: 500,
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </span>
          ) : null}
          <Icon color={cssVar.colorIcon} icon={RESOURCE_ENTRY_ICONS.chevronDown} size={14} />
        </Flexbox>
      </Button>
    );
  },
);

ActionIconWithChevron.displayName = 'ActionIconWithChevron';

export default ActionIconWithChevron;
