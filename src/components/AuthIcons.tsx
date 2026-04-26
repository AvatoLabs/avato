import { Apple, Aws, Google, Microsoft } from '@lobehub/icons';
import {
  Auth0,
  Authelia,
  Authentik,
  Casdoor,
  Cloudflare,
  Github,
  Logto,
  MicrosoftEntra,
  Zitadel,
} from '@lobehub/ui/icons';
import { User } from 'lucide-react';

const Feishu = ({ size = 36 }: { size?: number }) => (
  <svg
    aria-hidden
    fill="none"
    height={size}
    viewBox="0 0 36 36"
    width={size}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect fill="#3370FF" height="14" rx="7" width="14" x="11" y="2" />
    <rect fill="#00D6B9" height="14" rx="7" width="14" x="20" y="11" />
    <rect fill="#7B67EE" height="14" rx="7" width="14" x="11" y="20" />
    <rect fill="#00B3FF" height="14" rx="7" width="14" x="2" y="11" />
    <circle cx="18" cy="18" fill="white" r="5" />
  </svg>
);

const iconComponents: { [key: string]: any } = {
  'apple': Apple,
  'auth0': Auth0,
  'authelia': Authelia.Color,
  'authentik': Authentik.Color,
  'casdoor': Casdoor.Color,
  'cloudflare': Cloudflare.Color,
  'cognito': Aws.Color,
  'feishu': Feishu,
  'github': Github,
  'google': Google.Color,
  'logto': Logto.Color,
  'microsoft': Microsoft.Color,
  'microsoft-entra-id': MicrosoftEntra.Color,
  'zitadel': Zitadel.Color,
};

/**
 * Get the auth icons component for the given provider id
 */
const AuthIcons = (id: string, size = 36) => {
  const IconComponent = iconComponents[id];
  if (IconComponent) {
    return <IconComponent size={size} />;
  }
  // Fallback to generic user icon for unknown providers
  return <User size={size} />;
};

export default AuthIcons;
