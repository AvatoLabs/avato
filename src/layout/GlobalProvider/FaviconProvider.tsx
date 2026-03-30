'use client';

import { type ReactNode } from 'react';
import { createContext, memo, use, useCallback, useEffect, useMemo, useState } from 'react';

import { isCustomBranding } from '@/const/version';

export type FaviconState = 'default' | 'done' | 'error' | 'progress';

interface FaviconStateContextValue {
  currentState: FaviconState;
  isDevMode: boolean;
}

interface FaviconSettersContextValue {
  setFavicon: (state: FaviconState) => void;
  setIsDevMode: (isDev: boolean) => void;
}

const FaviconStateContext = createContext<FaviconStateContextValue | null>(null);
const FaviconSettersContext = createContext<FaviconSettersContextValue | null>(null);

export const useFaviconState = () => {
  const context = use(FaviconStateContext);
  if (!context) {
    throw new Error('useFaviconState must be used within FaviconProvider');
  }
  return context;
};

export const useFaviconSetters = () => {
  const context = use(FaviconSettersContext);
  if (!context) {
    throw new Error('useFaviconSetters must be used within FaviconProvider');
  }
  return context;
};

const stateToFileName: Record<FaviconState, string> = {
  default: '',
  done: '-done',
  error: '-error',
  progress: '-progress',
};

interface FaviconDescriptor {
  href: string;
  media?: string;
  rel: 'icon' | 'shortcut icon';
  sizes?: '16x16' | '32x32';
  type: string;
}

const getLegacyFaviconPath = (state: FaviconState, isDev: boolean, size?: '32x32'): string => {
  const devSuffix = isDev ? '-dev' : '';
  const stateSuffix = stateToFileName[state];
  const sizeSuffix = size ? `-${size}` : '';
  return `/favicon${sizeSuffix}${stateSuffix}${devSuffix}.ico`;
};

const getBrandFaviconPath = (scheme: 'dark' | 'light', size: '16x16' | '32x32') =>
  `/favicon-${size}${scheme === 'dark' ? '-dark' : ''}.png`;

const getPreferredScheme = (): 'dark' | 'light' => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getFaviconDescriptors = (state: FaviconState, isDev: boolean): FaviconDescriptor[] => {
  if (isCustomBranding && state === 'default') {
    const scheme = getPreferredScheme();

    return [
      {
        href: getBrandFaviconPath('light', '16x16'),
        media: '(prefers-color-scheme: light)',
        rel: 'icon',
        sizes: '16x16',
        type: 'image/png',
      },
      {
        href: getBrandFaviconPath('light', '32x32'),
        media: '(prefers-color-scheme: light)',
        rel: 'icon',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        href: getBrandFaviconPath('dark', '16x16'),
        media: '(prefers-color-scheme: dark)',
        rel: 'icon',
        sizes: '16x16',
        type: 'image/png',
      },
      {
        href: getBrandFaviconPath('dark', '32x32'),
        media: '(prefers-color-scheme: dark)',
        rel: 'icon',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        href: getBrandFaviconPath(scheme, '32x32'),
        rel: 'shortcut icon',
        sizes: '32x32',
        type: 'image/png',
      },
    ];
  }

  return [
    {
      href: getLegacyFaviconPath(state, isDev),
      rel: 'icon',
      type: 'image/x-icon',
    },
    {
      href: getLegacyFaviconPath(state, isDev, '32x32'),
      rel: 'shortcut icon',
      sizes: '32x32',
      type: 'image/x-icon',
    },
  ];
};

const updateFaviconDOM = (state: FaviconState, isDev: boolean) => {
  if (typeof document === 'undefined') return;

  const head = document.head;
  document
    .querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]')
    .forEach((link) => {
      link.remove();
    });

  const cacheBust = Date.now();

  getFaviconDescriptors(state, isDev).forEach(({ href, rel, sizes, type, media }) => {
    const newLink = document.createElement('link');
    newLink.rel = rel;
    newLink.href = `${href}${href.includes('?') ? '&' : '?'}v=${cacheBust}`;
    newLink.type = type;

    if (sizes) newLink.sizes = sizes;
    if (media) newLink.media = media;

    head.append(newLink);
  });
};

const defaultIsDev = process.env.NODE_ENV === 'development';

export const FaviconProvider = memo<{ children: ReactNode }>(({ children }) => {
  const [currentState, setCurrentState] = useState<FaviconState>('default');
  const [isDevMode, setIsDevModeState] = useState<boolean>(defaultIsDev);

  useEffect(() => {
    updateFaviconDOM(currentState, isDevMode);
  }, [currentState, isDevMode]);

  useEffect(() => {
    if (!isCustomBranding || currentState !== 'default' || typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => updateFaviconDOM('default', isDevMode);

    if ('addEventListener' in mediaQuery) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [currentState, isDevMode]);

  const setFavicon = useCallback((state: FaviconState) => {
    setCurrentState(state);
  }, []);

  const setIsDevMode = useCallback((isDev: boolean) => {
    setIsDevModeState(isDev);
  }, []);

  const stateValue = useMemo(() => ({ currentState, isDevMode }), [currentState, isDevMode]);

  const settersValue = useMemo(() => ({ setFavicon, setIsDevMode }), [setFavicon, setIsDevMode]);

  return (
    <FaviconStateContext value={stateValue}>
      <FaviconSettersContext value={settersValue}>{children}</FaviconSettersContext>
    </FaviconStateContext>
  );
});

FaviconProvider.displayName = 'FaviconProvider';
