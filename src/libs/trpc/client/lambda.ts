import { type TRPCLink } from '@trpc/client';
import { createTRPCClient, httpBatchLink, httpLink, splitLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { observable } from '@trpc/server/observable';
import debug from 'debug';
import { type ModelProvider } from 'model-bank';
import superjson from 'superjson';

import { withElectronProtocolIfElectron } from '@/const/protocol';
import { isDesktop } from '@/const/version';
import { type LambdaRouter } from '@/server/routers/lambda';
import { getUserStoreState } from '@/store/user/store';

import { shouldShowTRPCNetworkErrorNotification } from './errorNotification';

const log = debug('lobe-image:lambda-client');

// 401 error debouncing: prevent showing multiple login notifications in short time
let last401Time = 0;
const MIN_401_INTERVAL = 5000; // 5 seconds
let lastInfraErrorAt = 0;
let lastInfraErrorKey = '';
const MIN_INFRA_ERROR_INTERVAL = 3000;

const isInfrastructureStatus = (status?: number) =>
  typeof status !== 'number' || status === 408 || status === 429 || status >= 500;
const isRetryableClientStatus = (status?: number) => status === 408 || status === 429;

// handle error
const errorHandlingLink: TRPCLink<LambdaRouter> = () => {
  return ({ op, next }) =>
    observable((observer) =>
      next(op).subscribe({
        complete: () => observer.complete(),
        error: async (err) => {
          // Check if this is an abort error and should be ignored
          const isAbortError =
            err.message.includes('aborted') ||
            err.name === 'AbortError' ||
            err.cause?.name === 'AbortError' ||
            err.message.includes('signal is aborted without reason');

          const showError = shouldShowTRPCNetworkErrorNotification({
            explicitShowNotification: op.context?.showNotification as boolean | undefined,
            isDesktopRuntime: isDesktop,
            operationType: op.type,
          });
          const status = err.data?.httpStatus as number;

          // Don't show notifications for abort errors
          if (!isAbortError) {
            switch (status) {
              case 401: {
                // Debounce: only show login notification once every 5 seconds
                const now = Date.now();
                if (now - last401Time > MIN_401_INTERVAL) {
                  last401Time = now;
                  // Desktop app doesn't have the web auth routes like `/signin`,
                  // so skip the login redirect/notification there.
                  if (showError && !isDesktop) {
                    const { isSignedIn, logout } = getUserStoreState();
                    // If user is still marked as signed in but got 401,
                    // session is invalid - clear client state first
                    if (isSignedIn) {
                      await logout();
                    }
                    const { loginRequired } =
                      await import('@/components/Error/loginRequiredNotification');
                    loginRequired.redirect();
                  }
                }
                // Mark error as non-retryable to prevent SWR infinite retry loop
                err.meta = { ...err.meta, shouldRetry: false };
                break;
              }

              default: {
                if (
                  typeof status === 'number' &&
                  status >= 400 &&
                  status < 500 &&
                  !isRetryableClientStatus(status)
                ) {
                  err.meta = { ...err.meta, shouldRetry: false };
                }

                if (showError && isInfrastructureStatus(status)) {
                  const normalizedStatus = typeof status === 'number' ? status : 0;
                  const errorKey = `${normalizedStatus}:${err.message}`;
                  const now = Date.now();

                  if (
                    errorKey !== lastInfraErrorKey ||
                    now - lastInfraErrorAt > MIN_INFRA_ERROR_INTERVAL
                  ) {
                    lastInfraErrorAt = now;
                    lastInfraErrorKey = errorKey;

                    const { fetchErrorNotification } =
                      await import('@/components/Error/fetchErrorNotification');

                    fetchErrorNotification.error({
                      errorMessage: err.message,
                      status: normalizedStatus,
                    });
                  }
                }

                console.error(err);
              }
            }
          }

          observer.error(err);
        },
        next: (value) => observer.next(value),
      }),
    );
};

// 2. Shared link options
const linkOptions = {
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    // Ensure credentials are included to send cookies (like mp_token)

    const fetchOptions: RequestInit = {
      ...init,
      credentials: 'include',
    };

    if (isDesktop) {
      const res = await fetch(input as string, fetchOptions);

      if (res) return res;
    }

    return await fetch(input, fetchOptions);
  },
  headers: async () => {
    // dynamic import to avoid circular dependency
    const { createHeaderWithAuth } = await import('@/services/_auth');

    let provider: ModelProvider | undefined;
    // for image page, we need to get the provider from the store
    log('Getting provider from store for image page: %s', location.pathname);
    if (location.pathname === '/image') {
      const { getImageStoreState } = await import('@/store/image');
      const { imageGenerationConfigSelectors } =
        await import('@/store/image/slices/generationConfig/selectors');
      provider = imageGenerationConfigSelectors.provider(getImageStoreState()) as ModelProvider;
      log('Getting provider from store for image page: %s', provider);
    }

    // Only include provider in JWT for image operations
    // For other operations (like knowledge base embedding), let server use its own config
    const headers = await createHeaderWithAuth(provider ? { provider } : undefined);
    log('Headers: %O', headers);
    return headers;
  },
  transformer: superjson,
  url: withElectronProtocolIfElectron('/trpc/lambda'),
};

// Procedures that should skip batching for faster initial load
const initialLoadProcedures = new Set(['user.getUserState', 'config.getGlobalConfig']);
const slowProcedures = new Set(['market.getAssistantList']);
const SKIP_BATCH_PROCEDURES = new Set([...initialLoadProcedures, ...slowProcedures]);

// 3. splitLink to conditionally disable batching
const customSplitLink = splitLink({
  condition: (op) => SKIP_BATCH_PROCEDURES.has(op.path),
  false: httpBatchLink({ ...linkOptions, maxURLLength: 2083 }),
  true: httpLink(linkOptions),
});

// 4. assembly links
const links = [errorHandlingLink, customSplitLink];

export const lambdaClient = createTRPCClient<LambdaRouter>({
  links,
});

export const lambdaQuery = createTRPCReact<LambdaRouter>();

export const lambdaQueryClient = lambdaQuery.createClient({ links });
