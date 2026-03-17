import { NextResponse } from 'next/server';
import urlJoin from 'url-join';

import { authEnv } from '@/envs/auth';
import { defaultScopes } from '@/libs/oidc-provider/config';
import { getOIDCProvider } from '@/server/services/oidc/oidcProvider';

const getDiscoveryDocument = async () => {
  const provider = await getOIDCProvider();
  const issuer = provider.issuer;

  return {
    authorization_endpoint: urlJoin(issuer, 'auth'),
    claims_supported: ['sub', 'name', 'picture', 'email', 'email_verified'],
    code_challenge_methods_supported: ['S256'],
    device_authorization_endpoint: urlJoin(issuer, 'device/auth'),
    end_session_endpoint: urlJoin(issuer, 'session/end'),
    grant_types_supported: [
      'authorization_code',
      'refresh_token',
      'urn:ietf:params:oauth:grant-type:device_code',
    ],
    id_token_signing_alg_values_supported: ['RS256'],
    issuer,
    jwks_uri: urlJoin(issuer, 'jwks'),
    response_types_supported: ['code'],
    scopes_supported: defaultScopes,
    subject_types_supported: ['public'],
    token_endpoint: urlJoin(issuer, 'token'),
    token_endpoint_auth_methods_supported: ['none'],
  };
};

export const GET = async () => {
  if (!authEnv.ENABLE_OIDC) {
    return new NextResponse('OIDC is not enabled', { status: 404 });
  }

  return NextResponse.json(await getDiscoveryDocument());
};
