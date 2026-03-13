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

declare module 'react-syntax-highlighter/dist/esm/styles/prism/prism' {
  const prism: any;
  export default prism;
}
