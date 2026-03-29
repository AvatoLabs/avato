import { Button, Checkbox, Flexbox, Icon, Skeleton } from '@lobehub/ui';
import { App } from 'antd';
import { createStaticStyles, cssVar } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';

const styles = createStaticStyles(({ css }) => ({
  total: css`
    cursor: pointer;
    height: 27px;
  `,
}));

export type MultiSelectActionType =
  | 'addToSourceSet'
  | 'moveToSourceSet'
  | 'batchChunking'
  | 'delete'
  | 'deleteSourceSet'
  | 'removeFromSourceSet';

interface MultiSelectActionsProps {
  onActionClick: (type: MultiSelectActionType) => Promise<void>;
  onClickCheckbox: () => void;
  selectCount: number;
  total?: number;
}

const MultiSelectActions = memo<MultiSelectActionsProps>(
  ({ selectCount, total, onActionClick, onClickCheckbox }) => {
    const { t } = useTranslation(['components', 'common']);

    const isSelectedFiles = selectCount > 0;
    const { modal, message } = App.useApp();

    const sourceSetId = useContentManagerStore((s) => s.sourceSetId);

    return (
      <Flexbox
        horizontal
        align={'center'}
        gap={12}
        style={{
          borderBlockEnd: `1px solid ${cssVar.colorBorderSecondary}`,
          height: 40,
          paddingBlockEnd: 12,
        }}
      >
        <Flexbox
          horizontal
          align={'center'}
          className={styles.total}
          gap={8}
          paddingInline={4}
          onClick={onClickCheckbox}
        >
          <Checkbox
            checked={selectCount === total}
            indeterminate={isSelectedFiles && selectCount !== total}
          />
          {typeof total === 'undefined' ? (
            <Skeleton
              active
              paragraph={{ rows: 1, style: { marginBottom: 0, width: 60 }, width: '100%' }}
              title={false}
            />
          ) : (
            <div style={{ height: 18 }}>
              {isSelectedFiles
                ? t('FileManager.total.selectedCount', { count: selectCount })
                : t('FileManager.total.fileCount', { count: total })}
            </div>
          )}
        </Flexbox>
        {isSelectedFiles && (
          <Flexbox horizontal gap={8}>
            {sourceSetId ? (
              <>
                <Button
                  icon={RESOURCE_ENTRY_ICONS.sourceSetRemove}
                  size={'small'}
                  onClick={() => {
                    modal.confirm({
                      okButtonProps: {
                        danger: true,
                      },
                      onOk: async () => {
                        await onActionClick('removeFromSourceSet');
                        message.success(t('FileManager.actions.removeFromSourceSetSuccess'));
                      },
                      title: t('FileManager.actions.confirmRemoveFromSourceSet', {
                        count: selectCount,
                      }),
                    });
                  }}
                >
                  {t('FileManager.actions.removeFromSourceSet')}
                </Button>
                <Button
                  color={'default'}
                  icon={<Icon icon={RESOURCE_ENTRY_ICONS.sourceSetAdd} />}
                  size={'small'}
                  variant={'filled'}
                  onClick={() => {
                    onActionClick('moveToSourceSet');
                  }}
                >
                  {t('FileManager.actions.moveToOtherSourceSet')}
                </Button>
              </>
            ) : (
              <Button
                color={'default'}
                icon={<Icon icon={RESOURCE_ENTRY_ICONS.sourceSetAdd} />}
                size={'small'}
                variant={'filled'}
                onClick={() => {
                  onActionClick('addToSourceSet');
                }}
              >
                {t('FileManager.actions.addToSourceSet')}
              </Button>
            )}
            <Button
              color={'default'}
              icon={<Icon icon={RESOURCE_ENTRY_ICONS.chunk} />}
              size={'small'}
              variant={'filled'}
              onClick={async () => {
                await onActionClick('batchChunking');
              }}
            >
              {t('FileManager.actions.batchChunking')}
            </Button>
            <Button
              danger
              color={'danger'}
              icon={<Icon icon={RESOURCE_ENTRY_ICONS.trash} />}
              size={'small'}
              variant={'filled'}
              onClick={async () => {
                modal.confirm({
                  okButtonProps: {
                    danger: true,
                  },
                  onOk: async () => {
                    await onActionClick('delete');
                    message.success(t('FileManager.actions.deleteSuccess'));
                  },
                  title: t('FileManager.actions.confirmDeleteMultiFiles', { count: selectCount }),
                });
              }}
            >
              {t('delete', { ns: 'common' })}
            </Button>
          </Flexbox>
        )}
      </Flexbox>
    );
  },
);

export default MultiSelectActions;
