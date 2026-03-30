'use client';

import { type NeutralColors, type PrimaryColors, TooltipGroup } from '@lobehub/ui';
import { StyleProvider, useResponsive } from 'antd-style';
import { domMax, LazyMotion } from 'motion/react';
import { lazy, memo, type PropsWithChildren, Suspense, useEffect, useState } from 'react';

import { LobeAnalyticsProviderWrapper } from '@/components/Analytics/LobeAnalyticsProviderWrapper';
import { DragUploadProvider } from '@/components/DragUploadZone/DragUploadProvider';
import { isDesktop } from '@/const/version';
import AuthProvider from '@/layout/AuthProvider';
import AppTheme from '@/layout/GlobalProvider/AppTheme';
import { FaviconProvider } from '@/layout/GlobalProvider/FaviconProvider';
import { GroupWizardProvider } from '@/layout/GlobalProvider/GroupWizardProvider';
import ImportSettings from '@/layout/GlobalProvider/ImportSettings';
import NextThemeProvider from '@/layout/GlobalProvider/NextThemeProvider';
import QueryProvider from '@/layout/GlobalProvider/Query';
import ServerVersionOutdatedAlert from '@/layout/GlobalProvider/ServerVersionOutdatedAlert';
import StoreInitialization from '@/layout/GlobalProvider/StoreInitialization';
import { OBSIDIAN_THEME_PRIMARY } from '@/layout/GlobalProvider/themeShared';
import { ServerConfigStoreProvider } from '@/store/serverConfig/Provider';
import type { SPAServerConfig } from '@/types/spaServerConfig';

import Locale from './Locale';

/** Default accent: obsidian mono preset, neutral slate. */
const DEFAULT_THEME_PRIMARY = OBSIDIAN_THEME_PRIMARY as PrimaryColors;
const DEFAULT_THEME_NEUTRAL: NeutralColors = 'slate';

const ModalHost = lazy(() => import('@lobehub/ui/base-ui').then((m) => ({ default: m.ModalHost })));
const ToastHost = lazy(() => import('@lobehub/ui').then((m) => ({ default: m.ToastHost })));
const ContextMenuHost = lazy(() =>
  import('@lobehub/ui').then((m) => ({ default: m.ContextMenuHost })),
);

const SPAGlobalProvider = memo<PropsWithChildren>(({ children }) => {
  const [isAppReady, setIsAppReady] = useState(false);

  // Keep the static loading screen mounted until the initial React fallback disappears.
  // This prevents the startup chain from flashing through multiple visible loading stages.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const waitForInitialContent = () => {
      if (cancelled) return;

      const loadingScreen = document.getElementById('loading-screen');
      if (!loadingScreen) {
        setIsAppReady(true);
        return;
      }

      const activeBrandLoading = document.querySelector('[data-brand-loading="true"]');

      if (activeBrandLoading) {
        timer = setTimeout(waitForInitialContent, 120);
        return;
      }

      setIsAppReady(true);
    };

    timer = setTimeout(waitForInitialContent, 120);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!isAppReady) return;

    const loadingScreen = document.getElementById('loading-screen');
    if (!loadingScreen) return;

    // Add fade-out transition before removing
    loadingScreen.style.transition = 'opacity 0.3s ease-out';
    loadingScreen.style.opacity = '0';

    // Remove after transition completes
    const removeTimer = setTimeout(() => {
      loadingScreen.remove();
    }, 300);

    return () => {
      clearTimeout(removeTimer);
    };
  }, [isAppReady]);

  const { mobile } = useResponsive();
  const serverConfig: SPAServerConfig | undefined = window.__SERVER_CONFIG__;

  const locale = document.documentElement.lang || 'en-US';
  const buildVariantIsMobile =
    serverConfig?.isMobile ?? (typeof __MOBILE__ !== 'undefined' ? __MOBILE__ : false);
  const isMobile = typeof mobile === 'boolean' ? mobile : buildVariantIsMobile;

  return (
    <Locale defaultLang={locale}>
      <NextThemeProvider>
        <AppTheme
          defaultNeutralColor={DEFAULT_THEME_NEUTRAL}
          defaultPrimaryColor={DEFAULT_THEME_PRIMARY}
        >
          <ServerConfigStoreProvider
            featureFlags={serverConfig?.featureFlags}
            isMobile={isMobile}
            serverConfig={serverConfig?.config}
          >
            <QueryProvider>
              <AuthProvider>
                <StoreInitialization />

                {isDesktop && <ServerVersionOutdatedAlert />}
                <FaviconProvider>
                  <GroupWizardProvider>
                    <DragUploadProvider>
                      <LazyMotion features={domMax}>
                        <TooltipGroup layoutAnimation={false}>
                          <StyleProvider speedy={import.meta.env.PROD}>
                            <LobeAnalyticsProviderWrapper>{children}</LobeAnalyticsProviderWrapper>
                          </StyleProvider>
                        </TooltipGroup>
                        <Suspense>
                          <ModalHost />
                          <ToastHost />
                          <ContextMenuHost />
                        </Suspense>
                      </LazyMotion>
                    </DragUploadProvider>
                  </GroupWizardProvider>
                </FaviconProvider>
              </AuthProvider>
            </QueryProvider>
            <Suspense>
              <ImportSettings />
              {/* DevPanel disabled in SPA: depends on node:fs */}
            </Suspense>
          </ServerConfigStoreProvider>
        </AppTheme>
      </NextThemeProvider>
    </Locale>
  );
});

SPAGlobalProvider.displayName = 'SPAGlobalProvider';

export default SPAGlobalProvider;
