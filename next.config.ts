import { defineConfig } from './src/libs/next/config/define-config';

const isVercel = !!process.env.VERCEL_ENV;

// Exclusions that should apply to all builds (Vercel and Docker)
const outputFileTracingExcludes = {
  '*': [
    'node_modules/.pnpm/@napi-rs+canvas-*-musl*',
    'node_modules/.pnpm/@img+sharp-libvips-*musl*',
    // Exclude SPA/desktop/mobile build artifacts from serverless functions
    'public/spa/**',
    'dist/desktop/**',
    'dist/mobile/**',
    'apps/desktop/**',
    'packages/database/migrations/**',
  ],
};

const vercelConfig = {
  // Vercel serverless optimization: exclude musl binaries from all routes
  // Vercel uses Amazon Linux (glibc), not Alpine Linux (musl)
  // This saves ~45MB (29MB canvas-musl + 16MB sharp-musl) per serverless function
  outputFileTracingExcludes,
};

const immutableSpaAssetHeaders = [
  {
    key: 'Cache-Control',
    value: 'public, max-age=31536000, immutable',
  },
  {
    key: 'CDN-Cache-Control',
    value: 'public, max-age=31536000, immutable',
  },
];

const nextConfig = defineConfig({
  headers: ['assets', 'vendor', 'i18n', 'provider'].map((directory) => ({
    headers: immutableSpaAssetHeaders,
    source: `/spa/${directory}/:path*`,
  })),
  // Always apply exclusions for Docker builds too
  outputFileTracingExcludes,
  ...(isVercel ? vercelConfig : {}),
});

export default nextConfig;
