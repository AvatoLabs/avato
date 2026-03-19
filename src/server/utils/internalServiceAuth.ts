const getInternalServiceSecret = () => process.env.KEY_VAULTS_SECRET;

export const buildInternalServiceAuthHeaders = (): Record<string, string> => {
  const secret = getInternalServiceSecret();

  if (!secret) {
    throw new Error('KEY_VAULTS_SECRET is required for internal service authentication.');
  }

  return {
    Authorization: `Bearer ${secret}`,
  };
};

export const isValidInternalServiceAuth = (authorization?: string | null): boolean => {
  const secret = getInternalServiceSecret();

  if (!secret || !authorization) return false;

  return authorization === `Bearer ${secret}`;
};
