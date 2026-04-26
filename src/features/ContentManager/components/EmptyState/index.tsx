'use client';

import { Center, Flexbox, Icon } from '@lobehub/ui';
import { Button } from 'antd';
import { createStaticStyles, cssVar } from 'antd-style';
import { type LucideIcon } from 'lucide-react';
import { memo, type ReactNode } from 'react';

export interface EmptyStateAction {
  icon?: LucideIcon;
  label: string;
  onClick?: () => void;
  type?: 'primary' | 'default' | 'dashed';
}

export interface EmptyStateProps {
  actions?: EmptyStateAction[];
  description?: ReactNode;
  icon?: LucideIcon;
  title?: ReactNode;
}

const styles = createStaticStyles(({ css }) => ({
  container: css`
    max-width: 300px;
    text-align: center;
  `,
  description: css`
    font-size: 14px;
    line-height: 1.5;
    color: ${cssVar.colorTextSecondary};
  `,
  icon: css`
    color: ${cssVar.colorTextQuaternary};
  `,
  title: css`
    font-size: 16px;
    font-weight: 500;
    color: ${cssVar.colorTextSecondary};
  `,
}));

/**
 * A unified empty state component for various scenarios:
 * - Source set list empty
 * - File list empty
 * - Search no results
 */
const EmptyState = memo<EmptyStateProps>(({ icon, title, description, actions }) => {
  return (
    <Center height="100%" width="100%">
      <Flexbox align="center" className={styles.container} gap={16}>
        {icon && <Icon className={styles.icon} icon={icon} size={48} />}
        <Flexbox align="center" gap={8}>
          {title && <div className={styles.title}>{title}</div>}
          {description && <div className={styles.description}>{description}</div>}
        </Flexbox>
        {actions && actions.length > 0 && (
          <Flexbox horizontal gap={8}>
            {actions.map((action, index) => (
              <Button
                icon={action.icon && <Icon icon={action.icon} />}
                key={index}
                type={action.type || 'default'}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </Flexbox>
        )}
      </Flexbox>
    </Center>
  );
});

EmptyState.displayName = 'EmptyState';

export default EmptyState;
