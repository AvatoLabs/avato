/**
 * Notebook CreateDocument Intervention — Edit title, description, content before approve.
 */
import { FileText } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { useI18n } from '../../../../lib/i18n';
import { useThemeColors } from '../../../../theme/colors';
import type { MobileBuiltinInterventionProps } from '../../types';

interface CreateDocumentArgs {
  content?: string;
  description?: string;
  title?: string;
  type?: string;
}

const CreateDocumentIntervention = memo<MobileBuiltinInterventionProps<CreateDocumentArgs>>(
  ({ args, onArgsChange, registerBeforeApprove }) => {
    const { t } = useI18n();
    const colors = useThemeColors();
    const [title, setTitle] = useState(args?.title ?? '');
    const [description, setDescription] = useState(args?.description ?? '');
    const [content, setContent] = useState(args?.content ?? '');

    useEffect(() => {
      setTitle(args?.title ?? '');
      setDescription(args?.description ?? '');
      setContent(args?.content ?? '');
    }, [args?.title, args?.description, args?.content]);

    const save = useCallback(async () => {
      const changes: CreateDocumentArgs = { title, description, content };
      await onArgsChange?.(changes);
    }, [title, description, content, onArgsChange]);

    useEffect(() => {
      return registerBeforeApprove?.('createDocument', save);
    }, [registerBeforeApprove, save]);

    return (
      <View className="gap-3 py-2">
        <View className="flex-row items-center gap-2">
          <FileText color={colors.primary} size={16} strokeWidth={2} />
          <TextInput
            className="flex-1 rounded-lg px-3 py-2 text-[14px]"
            placeholder={t.chatToolNotebookCreateDocTitlePlaceholder}
            placeholderTextColor={colors.tertiaryText}
            style={{
              backgroundColor: colors.overlay,
              borderColor: colors.border,
              borderWidth: 1,
              color: colors.foreground,
            }}
            value={title}
            onChangeText={setTitle}
          />
        </View>
        <TextInput
          className="rounded-lg px-3 py-2 text-[13px]"
          placeholder={t.chatToolNotebookCreateDocDescPlaceholder}
          placeholderTextColor={colors.tertiaryText}
          style={{
            backgroundColor: colors.overlay,
            borderColor: colors.border,
            borderWidth: 1,
            color: colors.foreground,
          }}
          value={description}
          onChangeText={setDescription}
        />
        <TextInput
          className="rounded-lg px-3 py-2 text-[13px] min-h-[80px]"
          multiline
          numberOfLines={4}
          placeholder={t.chatToolNotebookCreateDocContentPlaceholder}
          placeholderTextColor={colors.tertiaryText}
          style={{
            backgroundColor: colors.overlay,
            borderColor: colors.border,
            borderWidth: 1,
            color: colors.foreground,
            textAlignVertical: 'top',
          }}
          value={content}
          onChangeText={setContent}
        />
      </View>
    );
  },
);

CreateDocumentIntervention.displayName = 'NotebookCreateDocumentIntervention';

export default CreateDocumentIntervention;
