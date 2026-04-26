import { ActionIcon, type ActionIconProps } from '@lobehub/ui';
import { ChevronLeftIcon } from 'lucide-react';
import { memo, type MouseEvent, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { DESKTOP_HEADER_ICON_SIZE } from '@/const/layoutTokens';
import { isModifierClick, navigateBackOrTo } from '@/utils/navigation';

export const BACK_BUTTON_ID = 'lobe-back-button';

const BackButton = memo<ActionIconProps & { to?: string; useHistory?: boolean }>(
  ({ to = '/', useHistory = true, onClick, ...rest }) => {
    const navigate = useNavigate();

    const handleClick = useCallback(
      (event: MouseEvent<HTMLElement>) => {
        onClick?.(event as never);
        if (event.defaultPrevented || isModifierClick(event)) return;

        if (!useHistory) {
          navigate(to);
          return;
        }

        navigateBackOrTo(navigate, to);
      },
      [navigate, onClick, to, useHistory],
    );

    return (
      <ActionIcon
        icon={ChevronLeftIcon}
        id={BACK_BUTTON_ID}
        size={DESKTOP_HEADER_ICON_SIZE}
        onClick={handleClick}
        {...rest}
      />
    );
  },
);

export default BackButton;
