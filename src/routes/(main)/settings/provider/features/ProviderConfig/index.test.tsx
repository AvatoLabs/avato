/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProviderConfig from './index';

const mockMessageError = vi.hoisted(() => vi.fn());
const mockFormSetFieldsValue = vi.hoisted(() => vi.fn());
const mockFormGetFieldsValue = vi.hoisted(() => vi.fn(() => ({ keyVaults: { apiKey: 'sk-test' } })));
const aiInfraStoreState = vi.hoisted(() => ({
  data: {
    checkModel: 'gpt-4o',
    enabled: true,
    id: 'openai',
    keyVaults: {},
    name: 'OpenAI',
    settings: {},
    source: 'builtin',
  },
  isLoading: false,
  providerConfig: {},
  providerConfigUpdating: false,
  updateAiProviderConfig: vi.fn(),
}));

vi.mock('@lobehub/icons', () => ({
  ProviderCombine: () => null,
}));

vi.mock('@lobehub/ui', () => {
  const Form = ({ children, items }: any) => (
    <div>
      {children}
      {items?.map((item: any, index: number) => (
        <div key={index}>
          {Array.isArray(item.children)
            ? item.children.map((child: any, childIndex: number) => (
                <div key={childIndex}>{child.children}</div>
              ))
            : item.children}
        </div>
      ))}
    </div>
  );
  Form.useForm = () => [
    {
      getFieldsValue: mockFormGetFieldsValue,
      setFieldsValue: mockFormSetFieldsValue,
    },
  ];

  return {
    Avatar: () => null,
    Center: ({ children }: any) => <div>{children}</div>,
    Flexbox: ({ children }: any) => <div>{children}</div>,
    Form,
    Icon: () => null,
    Skeleton: {
      Button: () => <div>skeleton</div>,
    },
    Tooltip: ({ children }: any) => <div>{children}</div>,
    stopPropagation: () => undefined,
  };
});

vi.mock('ahooks', () => ({
  useDebounceFn: (fn: any) => ({
    run: fn,
  }),
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: mockMessageError,
      },
    }),
  },
  Form: {
    useWatch: () => undefined,
  },
  Switch: () => null,
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    aceGcm: 'ace-gcm',
    form: 'form',
    help: 'help',
    switchLoading: 'switch-loading',
  }),
  cssVar: {
    colorTextTertiary: '#999',
  },
  cx: (...classNames: string[]) => classNames.filter(Boolean).join(' '),
  responsive: {
    sm: '@media (min-width: 0px)',
  },
}));

vi.mock('react-i18next', () => ({
  Trans: ({ i18nKey }: any) => <span>{i18nKey}</span>,
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/FormInput', () => ({
  FormInput: () => null,
  FormPassword: () => null,
}));

vi.mock('@/components/Skeleton', () => ({
  SkeletonInput: () => <div>skeleton-input</div>,
  SkeletonSwitch: () => <div>skeleton-switch</div>,
}));

vi.mock('@/libs/trpc/client', () => ({
  lambdaQuery: {
    oauthDeviceFlow: {
      getAuthStatus: {
        useQuery: () => ({ data: undefined }),
      },
    },
  },
}));

vi.mock('@/store/aiInfra', () => {
  const useAiInfraStore = (selector: any) =>
    selector({
      updateAiProviderConfig: aiInfraStoreState.updateAiProviderConfig,
    });

  useAiInfraStore.getState = () => ({
    refreshAiProviderDetail: vi.fn(),
    refreshAiProviderRuntimeState: vi.fn(),
  });

  return {
    aiProviderSelectors: {
      isAiProviderConfigLoading: () => () => aiInfraStoreState.isLoading,
      isProviderConfigUpdating: () => () => aiInfraStoreState.providerConfigUpdating,
      isProviderEnabled: () => () => aiInfraStoreState.data.enabled,
      providerConfigById: () => () => aiInfraStoreState.providerConfig,
      providerDetailById: () => () => aiInfraStoreState.data,
    },
    useAiInfraStore,
  };
});

vi.mock('./Checker', () => ({
  default: ({ onBeforeCheck }: any) => (
    <button
      type="button"
      onClick={() => {
        void onBeforeCheck().catch(() => {});
      }}
    >
      trigger-before-check
    </button>
  ),
}));

vi.mock('./EnableSwitch', () => ({
  default: () => null,
}));

vi.mock('./OAuthDeviceFlowAuth', () => ({
  default: () => null,
}));

vi.mock('./UpdateProviderInfo', () => ({
  default: () => null,
}));

describe('ProviderConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiInfraStoreState.isLoading = false;
    aiInfraStoreState.providerConfigUpdating = false;
  });

  it('shows an error when preparing a connection check fails', async () => {
    const error = new Error('prepare connection check failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    aiInfraStoreState.updateAiProviderConfig.mockRejectedValue(error);

    render(
      <ProviderConfig
        checkModel="gpt-4o"
        enabled={true}
        id="openai"
        name="OpenAI"
        settings={{ showApiKey: false, showChecker: true }}
        source={'builtin' as any}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'trigger-before-check' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('providerModels.config.updateError');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to prepare provider connection check:',
      error,
    );
    expect(mockFormGetFieldsValue).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
