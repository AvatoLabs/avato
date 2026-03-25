'use client';

import { Popover } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { type PropsWithChildren } from 'react';
import { memo, Suspense, useState } from 'react';

import PanelContent from './PanelContent';
import PanelContentSkeleton from './PanelContentSkeleton';
import UpgradeBadge from './UpgradeBadge';
import { useNewVersion } from './useNewVersion';

const styles = createStaticStyles(({ css }) => {
  return {
    /** Do not override inset — User lives in sidebar footer; fixed insets break Base UI positioner */
    popover: css`
      border-radius: 10px;
    `,
    popoverContent: css`
      padding: 0;
    `,
  };
});

const UserPanel = memo<PropsWithChildren>(({ children }) => {
  const hasNewVersion = useNewVersion();
  const [open, setOpen] = useState(false);

  return (
    <Suspense fallback={children}>
      <UpgradeBadge showBadge={hasNewVersion}>
        <Popover
          arrow={false}
          open={open}
          placement="topLeft"
          trigger="click"
          classNames={{
            root: styles.popover,
            content: styles.popoverContent,
          }}
          content={
            <Suspense fallback={<PanelContentSkeleton />}>
              <PanelContent closePopover={() => setOpen(false)} />
            </Suspense>
          }
          onOpenChange={setOpen}
        >
          {children}
        </Popover>
      </UpgradeBadge>
    </Suspense>
  );
});

UserPanel.displayName = 'UserPanel';

export default UserPanel;
