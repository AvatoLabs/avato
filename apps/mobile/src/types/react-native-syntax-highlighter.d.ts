declare module 'react-native-syntax-highlighter' {
  import type React from 'react';

  export interface SyntaxHighlighterProps {
    children: string;
    customStyle?: any;
    highlightLineNumbers?: boolean;
    language: string;
    style: any;
    wrapLines?: boolean;
  }

  const SyntaxHighlighter: React.FC<SyntaxHighlighterProps>;
  export default SyntaxHighlighter;
}
