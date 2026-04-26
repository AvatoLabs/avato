export const shouldShowTRPCNetworkErrorNotification = ({
  explicitShowNotification,
  isDesktopRuntime,
  operationType,
}: {
  explicitShowNotification?: boolean;
  isDesktopRuntime: boolean;
  operationType?: string;
}) => {
  if (typeof explicitShowNotification === 'boolean') return explicitShowNotification;

  // Desktop keeps background SWR/tRPC queries alive for sync, discovery and
  // server state. Transient query fetch failures should update local UI state,
  // not surface as global request-failed toasts.
  if (isDesktopRuntime && operationType === 'query') return false;

  return true;
};
