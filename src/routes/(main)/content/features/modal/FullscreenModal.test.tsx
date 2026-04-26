/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import FullscreenModal from './FullscreenModal';

vi.mock('@lobehub/ui', () => ({
  Modal: ({ children, className, classNames, open, onCancel }: any) =>
    open ? (
      <div
        data-testid={'fullscreen-modal'}
        data-body-class={classNames?.body}
        data-class-name={className}
        data-header-class={classNames?.header}
        data-wrapper-class={classNames?.wrapper}
      >
        <button type={'button'} onClick={onCancel}>
          close
        </button>
        {children}
      </div>
    ) : null,
}));

vi.mock('antd', () => ({
  ConfigProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    body: 'body',
    body_withDetail: 'body_withDetail',
    content: 'content',
    extra: 'extra',
    extraContent: 'extraContent',
    extraHandle: 'extraHandle',
    extraInner: 'extraInner',
    header: 'header',
    modal: 'modal',
    modal_withDetail: 'modal_withDetail',
  }),
  cx: (...classNames: Array<string | false | null | undefined>) =>
    classNames.filter(Boolean).join(' '),
}));

describe('FullscreenModal', () => {
  it('renders detail mode with the with-detail body class and side panel', () => {
    render(
      <FullscreenModal detail={<div>detail-panel</div>}>
        <div>preview-panel</div>
      </FullscreenModal>,
    );

    const modal = screen.getByTestId('fullscreen-modal');

    expect(modal).toHaveAttribute('data-class-name', 'modal modal_withDetail');
    expect(modal).toHaveAttribute('data-body-class', 'body body_withDetail');
    expect(screen.getByText('preview-panel')).toBeInTheDocument();
    expect(screen.getByText('detail-panel')).toBeInTheDocument();
    expect(screen.getByTestId('fullscreen-modal-detail')).toHaveAttribute(
      'aria-label',
      'Detail panel',
    );
    expect(screen.getByText('detail-panel').parentElement).toHaveClass('extraContent');
  });

  it('closes the modal and calls onClose', () => {
    const onClose = vi.fn();

    render(
      <FullscreenModal onClose={onClose}>
        <div>preview-panel</div>
      </FullscreenModal>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('fullscreen-modal')).not.toBeInTheDocument();
  });
});
