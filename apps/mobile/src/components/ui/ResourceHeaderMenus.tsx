import { ArrowDownUp, Link2, Share2, Trash2 } from 'lucide-react-native';
import React from 'react';
import { Modal, Pressable, Text, TouchableOpacity } from 'react-native';

import { useI18n } from '../../lib/i18n';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';

type SortOrder = 'asc' | 'desc';
type SorterType = 'createdAt' | 'name' | 'size';

interface ResourceHeaderMenusProps {
  dropdownHorizontalPadding: number;
  dropdownTopPadding: number;
  headerMenuMinWidth: number;
  headerVisible: boolean;
  onCloseHeader: () => void;
  onCloseSort: () => void;
  onOpenSharedWithMe: () => void;
  onOpenSort: () => void;
  onOpenSourceSetMenu: () => void;
  onOpenTrash: () => void;
  onSelectSort: (sorter: SorterType, order: SortOrder) => void;
  sorter: SorterType;
  sortLabel: string;
  sortMenuMinWidth: number;
  sortOrder: SortOrder;
  sortVisible: boolean;
  sourceSetSelected: boolean;
}

export default function ResourceHeaderMenus({
  dropdownHorizontalPadding,
  dropdownTopPadding,
  headerMenuMinWidth,
  headerVisible,
  sortMenuMinWidth,
  sortOrder,
  sortVisible,
  sorter,
  sourceSetSelected,
  sortLabel,
  onCloseHeader,
  onCloseSort,
  onOpenSharedWithMe,
  onOpenSort,
  onOpenSourceSetMenu,
  onOpenTrash,
  onSelectSort,
}: ResourceHeaderMenusProps) {
  const colors = useThemeColors();
  const { t } = useI18n();

  const sortOptions = [
    { sorter: 'createdAt' as const, order: 'desc' as const, label: t.resourceSortNewest },
    { sorter: 'createdAt' as const, order: 'asc' as const, label: t.resourceSortOldest },
    { sorter: 'name' as const, order: 'asc' as const, label: `${t.resourceSortName} A-Z` },
    { sorter: 'name' as const, order: 'desc' as const, label: `${t.resourceSortName} Z-A` },
    { sorter: 'size' as const, order: 'asc' as const, label: `${t.resourceSortSize} ↑` },
    { sorter: 'size' as const, order: 'desc' as const, label: `${t.resourceSortSize} ↓` },
  ];

  return (
    <>
      <Modal
        accessibilityViewIsModal
        transparent
        animationType="fade"
        visible={headerVisible}
        onRequestClose={onCloseHeader}
      >
        <Pressable
          className="flex-1 items-end"
          style={{
            backgroundColor: 'rgba(0,0,0,0.3)',
            paddingHorizontal: dropdownHorizontalPadding,
            paddingTop: dropdownTopPadding,
          }}
          onPress={onCloseHeader}
        >
          <Pressable
            className="rounded-2xl bg-card py-2 shadow-lg"
            style={{ minWidth: headerMenuMinWidth }}
            onPress={(e: any) => e.stopPropagation?.()}
          >
            <TouchableOpacity
              activeOpacity={0.72}
              className="flex-row items-center px-4 py-3"
              onPress={onOpenSort}
            >
              <ArrowDownUp color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
              <Text className="ml-3 text-[15px] font-medium text-foreground">
                {`${t.resourceSortBy}: ${sortLabel}`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.72}
              className="flex-row items-center px-4 py-3"
              onPress={onOpenSharedWithMe}
            >
              <Link2 color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
              <Text className="ml-3 text-[15px] font-medium text-foreground">
                {t.resourceSharedWithMe}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.72}
              className="flex-row items-center px-4 py-3"
              onPress={onOpenTrash}
            >
              <Trash2 color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
              <Text className="ml-3 text-[15px] font-medium text-foreground">
                {t.resourceTrash}
              </Text>
            </TouchableOpacity>
            {sourceSetSelected ? (
              <TouchableOpacity
                activeOpacity={0.72}
                className="flex-row items-center px-4 py-3"
                onPress={onOpenSourceSetMenu}
              >
                <Share2 color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
                <Text className="ml-3 text-[15px] font-medium text-foreground">
                  {t.resourceShareSourceSetMenuTitle}
                </Text>
              </TouchableOpacity>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        accessibilityViewIsModal
        transparent
        animationType="fade"
        visible={sortVisible}
        onRequestClose={onCloseSort}
      >
        <Pressable
          className="flex-1 items-end"
          style={{
            backgroundColor: 'rgba(0,0,0,0.3)',
            paddingHorizontal: dropdownHorizontalPadding,
            paddingTop: dropdownTopPadding,
          }}
          onPress={onCloseSort}
        >
          <Pressable
            className="rounded-2xl bg-card py-2 shadow-lg"
            style={{ minWidth: sortMenuMinWidth }}
            onPress={(e: any) => e.stopPropagation?.()}
          >
            {sortOptions.map((option) => (
              <TouchableOpacity
                activeOpacity={0.7}
                className="px-4 py-2.5"
                key={`${option.sorter}-${option.order}`}
                onPress={() => onSelectSort(option.sorter, option.order)}
              >
                <Text
                  className="text-[15px] font-medium"
                  style={{
                    color:
                      sorter === option.sorter && sortOrder === option.order
                        ? colors.primary
                        : colors.foreground,
                  }}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
