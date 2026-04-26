import { File, FileAudio, FileImage, FileText, FileVideo } from 'lucide-react-native';
import React from 'react';

import { isAudio, isDocument, isImage, isVideo } from '../../lib/resourceFile';
import { tokens } from '../../theme/tokens';

interface ResourceFileTypeIconProps {
  color: string;
  fileName?: string;
  fileType: string;
  size?: number;
}

export default function ResourceFileTypeIcon({
  color,
  fileName,
  fileType,
  size = 28,
}: ResourceFileTypeIconProps) {
  if (isImage(fileType, fileName)) {
    return <FileImage color={color} size={size} strokeWidth={tokens.icon.strokeWidth} />;
  }
  if (isAudio(fileType)) {
    return <FileAudio color={color} size={size} strokeWidth={tokens.icon.strokeWidth} />;
  }
  if (isVideo(fileType)) {
    return <FileVideo color={color} size={size} strokeWidth={tokens.icon.strokeWidth} />;
  }
  if (isDocument(fileType, fileName)) {
    return <FileText color={color} size={size} strokeWidth={tokens.icon.strokeWidth} />;
  }

  return <File color={color} size={size} strokeWidth={tokens.icon.strokeWidth} />;
}
